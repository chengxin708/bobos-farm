import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { createClaimToken } from "@/lib/claim-token";
import { resolveAdminDeadlineHours, computeAdminPaymentDeadline } from "@/lib/admin-deadline";
import { isYurtDateConflict } from "@/lib/reservation-errors";

const convertSchema = z.object({
  yurtIds: z.array(z.string().min(1)).min(1, "At least one yurt is required"),
  guestCount: z.number().int().positive(),
  date: z.string().min(1).refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid date",
  }),
  customDeposit: z.number().min(0).optional(),
});

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function generateConfirmationCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const existing = await prisma.reservation.findUnique({ where: { confirmationCode: code } });
    if (!existing) return code;
  }
  return `BF-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Admin turns an Inquiry into a multi-yurt reservation. Reuses the
 * admin-branch logic from POST /api/reservations but pulls guest/date
 * details from the inquiry and ties the new reservation back into
 * Inquiry.reservationId + status=CONVERTED so the customer's inquiry
 * list reflects the outcome.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;

    const body = await req.json();
    const parsed = convertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { yurtIds, guestCount, date, customDeposit } = parsed.data;
    const uniqueYurtIds = Array.from(new Set(yurtIds));
    const reservationDate = new Date(date);

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (inquiry.reservationId) {
      return NextResponse.json(
        { error: "Inquiry already converted" },
        { status: 409 },
      );
    }

    // Yurt validation
    const yurts = await prisma.yurt.findMany({
      where: { id: { in: uniqueYurtIds } },
      select: { id: true, name: true, capacity: true, status: true },
    });
    if (yurts.length !== uniqueYurtIds.length) {
      return NextResponse.json({ error: "One or more yurts not found" }, { status: 400 });
    }
    if (yurts.some((y) => y.status !== "ACTIVE")) {
      return NextResponse.json({ error: "Selected yurt is not active" }, { status: 400 });
    }
    const totalCapacity = yurts.reduce((s, y) => s + y.capacity, 0);
    if (guestCount > totalCapacity) {
      return NextResponse.json(
        { error: "Guest count exceeds combined capacity of selected yurts" },
        { status: 400 },
      );
    }
    const conflicts = await prisma.reservation.findFirst({
      where: {
        yurtId: { in: uniqueYurtIds },
        date: reservationDate,
        status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
      },
    });
    if (conflicts) {
      return NextResponse.json(
        { error: "One or more yurts are already booked for this date" },
        { status: 409 },
      );
    }

    // Deposit + deadline
    const adminSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ["deposit_amount", "admin_deposit_deadline_hours"] } },
    });
    const settingsMap: Record<string, string> = {};
    for (const s of adminSettings) settingsMap[s.key] = s.value;
    const systemDeposit = settingsMap.deposit_amount ? parseFloat(settingsMap.deposit_amount) : 300;
    const depositAmount = customDeposit ?? systemDeposit * uniqueYurtIds.length;
    const hours = resolveAdminDeadlineHours(settingsMap.admin_deposit_deadline_hours);
    const adminPaymentDeadline = computeAdminPaymentDeadline({
      now: new Date(),
      hours,
      isPastDate: false,
      skipPayment: depositAmount === 0,
    });

    const confirmationCode = await generateConfirmationCode();
    const primaryYurtId = uniqueYurtIds[0];

    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          confirmationCode,
          userId: inquiry.userId,
          yurtId: primaryYurtId,
          date: reservationDate,
          guestCount,
          holdByAdmin: true,
          depositAmount,
          status: depositAmount === 0 ? "CONFIRMED" : "PENDING_PAYMENT",
          depositStatus: depositAmount === 0 ? "CONFIRMED" : "UNPAID",
          depositConfirmedAt: depositAmount === 0 ? now : null,
          paymentDeadline: adminPaymentDeadline,
          packageCount: uniqueYurtIds.length,
          yurtAssignedAt: now,
        },
      });

      for (let i = 0; i < uniqueYurtIds.length; i++) {
        const ry = await tx.reservationYurt.create({
          data: {
            reservationId: reservation.id,
            yurtId: uniqueYurtIds[i],
            sortOrder: i,
          },
        });
        await tx.order.create({
          data: {
            reservationId: reservation.id,
            reservationYurtId: ry.id,
            status: "DRAFT",
            estimatedTotal: 0,
          },
        });
      }

      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: {
          reservationId: reservation.id,
          status: "CONVERTED",
          convertedAt: now,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: "INQUIRY_CONVERTED",
          targetType: "Inquiry",
          targetId: inquiry.id,
          details: { reservationId: reservation.id, yurtIds: uniqueYurtIds, guestCount },
        },
      });

      return reservation;
    });

    // Always issue a claim token — even if the customer is signed in
    // already, admin may still share a link for them to bookmark.
    await createClaimToken(prisma, created.id);

    return NextResponse.json({ reservation: created }, { status: 201 });
  } catch (error) {
    if (isYurtDateConflict(error)) {
      return NextResponse.json(
        { error: "This yurt is already booked for this date" },
        { status: 409 },
      );
    }
    console.error("Failed to convert inquiry:", error);
    return NextResponse.json({ error: "Failed to convert inquiry" }, { status: 500 });
  }
}
