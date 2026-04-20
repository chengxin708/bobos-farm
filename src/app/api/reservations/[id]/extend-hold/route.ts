import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { sendPaymentDeadlineExtended } from "@/lib/email";
import { EXTEND_HOURS, computeExtendedDeadline } from "@/lib/extend-hold";

const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.local";

/**
 * Extend the paymentDeadline of an admin proxy hold by 24h.
 *
 * - Admin-only.
 * - Only valid for holdByAdmin=true + status=PENDING_PAYMENT.
 * - If the customer has a real (non-placeholder) email, send a short
 *   notification. Placeholders get nothing — admin communicates out of
 *   band.
 * - Writes HOLD_EXTENDED activity log with the running count of
 *   extensions for UI warnings past 3.
 */
export async function POST(
  _req: NextRequest,
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

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        yurt: { select: { name: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (!existing.holdByAdmin) {
      return NextResponse.json(
        { error: "Only admin holds can be extended", reason: "not_hold" },
        { status: 400 },
      );
    }
    if (existing.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { error: "Only pending-payment holds can be extended", reason: "wrong_status" },
        { status: 400 },
      );
    }

    const newDeadline = computeExtendedDeadline(existing.paymentDeadline, new Date());

    const extendCount = (await prisma.activityLog.count({
      where: { targetType: "Reservation", targetId: id, action: "HOLD_EXTENDED" },
    })) + 1;

    const updated = await prisma.reservation.update({
      where: { id },
      data: { paymentDeadline: newDeadline },
      select: { id: true, paymentDeadline: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "HOLD_EXTENDED",
        targetType: "Reservation",
        targetId: id,
        details: {
          newDeadline: newDeadline.toISOString(),
          extendedByHours: EXTEND_HOURS,
          extendCount,
        },
      },
    });

    // Fire-and-forget email to real-email customers.
    if (existing.user.email && !existing.user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
      void sendPaymentDeadlineExtended(existing.user.email, {
        reservationId: id,
        date: existing.date,
        yurtName: existing.yurt?.name ?? "Pending assignment",
        newDeadline,
      });
    }

    return NextResponse.json({
      success: true,
      paymentDeadline: updated.paymentDeadline,
      extendCount,
    });
  } catch (error) {
    console.error("Failed to extend hold:", error);
    return NextResponse.json(
      { error: "Failed to extend hold" },
      { status: 500 }
    );
  }
}
