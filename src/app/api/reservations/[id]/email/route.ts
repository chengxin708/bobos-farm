import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  sendReservationCreated,
  sendPreOrderReminder,
  sendClaimInvitation,
  sendYurtAssigned,
} from "@/lib/email";

const EMAIL_TYPES = [
  "reservation_created",
  "pre_order",
  "claim_invitation",
  "yurt_assigned",
] as const;
type EmailType = (typeof EMAIL_TYPES)[number];

const sendEmailSchema = z.object({
  type: z.enum(EMAIL_TYPES),
});

interface OrderItemRow {
  quantity: number;
  menuItem: { nameEn: string; nameZh: string | null; price: number };
}

function isAllowed(type: EmailType, reservation: {
  status: string;
  date: Date;
  yurtId: string | null;
  order: { status: string } | null;
}): { ok: true } | { ok: false; reason: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = reservation.date < today;

  switch (type) {
    case "reservation_created":
      if (["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"].includes(reservation.status)) {
        return { ok: false, reason: "Reservation is cancelled or expired" };
      }
      return { ok: true };

    case "pre_order":
      if (reservation.status !== "CONFIRMED") {
        return { ok: false, reason: "Reservation must be CONFIRMED" };
      }
      if (isPast) {
        return { ok: false, reason: "Reservation date has passed" };
      }
      return { ok: true };

    case "claim_invitation":
      if (["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"].includes(reservation.status)) {
        return { ok: false, reason: "Reservation is cancelled or expired" };
      }
      return { ok: true };

    case "yurt_assigned":
      if (reservation.status !== "CONFIRMED") {
        return { ok: false, reason: "Reservation must be CONFIRMED" };
      }
      if (!reservation.yurtId) {
        return { ok: false, reason: "No yurt has been assigned" };
      }
      return { ok: true };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check master kill-switch first — give a clear error if disabled
    const enabledSetting = await prisma.systemSetting.findUnique({
      where: { key: "emails_enabled" },
    });
    if (enabledSetting?.value === "false") {
      return NextResponse.json(
        { error: "Email sending is disabled in settings", reason: "emails_disabled" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = sendEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { type } = parsed.data;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        yurt: { select: { id: true, name: true, description: true } },
        order: {
          include: {
            items: {
              include: {
                menuItem: { select: { nameEn: true, nameZh: true, price: true } },
              },
            },
          },
        },
      },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (!reservation.user.email || reservation.user.email.endsWith("@placeholder.local")) {
      return NextResponse.json(
        { error: "Customer has no real email address", reason: "placeholder_email" },
        { status: 400 }
      );
    }

    const allowed = isAllowed(type, {
      status: reservation.status,
      date: reservation.date,
      yurtId: reservation.yurtId,
      order: reservation.order ? { status: reservation.order.status } : null,
    });
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.reason, reason: "not_applicable" }, { status: 400 });
    }

    const to = reservation.user.email;
    let result: { success: boolean; error?: string };

    switch (type) {
      case "reservation_created": {
        result = await sendReservationCreated(to, {
          reservationId: reservation.id,
          date: reservation.date,
          yurtName: reservation.yurt?.name ?? "Pending assignment",
          guestCount: reservation.guestCount,
          depositAmount: reservation.depositAmount,
          paymentDeadline: reservation.paymentDeadline,
        });
        break;
      }
      case "pre_order": {
        const items = (reservation.order?.items ?? []) as OrderItemRow[];
        const orderItems = items.map((it) => ({
          name: it.menuItem.nameZh || it.menuItem.nameEn,
          quantity: it.quantity,
          price: it.menuItem.price,
        }));
        const estimatedTotal = orderItems.reduce((sum, it) => sum + it.quantity * it.price, 0);
        const orderStatus: "NONE" | "DRAFT" | "SUBMITTED" =
          !reservation.order ? "NONE" : reservation.order.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";

        result = await sendPreOrderReminder(to, {
          reservationId: reservation.id,
          date: reservation.date,
          yurtName: reservation.yurt?.name ?? "Pending assignment",
          guestCount: reservation.guestCount,
          orderStatus,
          orderItems,
          estimatedTotal,
        });
        break;
      }
      case "claim_invitation": {
        if (!reservation.confirmationCode) {
          return NextResponse.json({ error: "No confirmation code on this reservation" }, { status: 400 });
        }
        result = await sendClaimInvitation(to, {
          date: reservation.date,
          yurtName: reservation.yurt?.name ?? "Pending assignment",
          guestCount: reservation.guestCount,
          confirmationCode: reservation.confirmationCode,
        });
        break;
      }
      case "yurt_assigned": {
        result = await sendYurtAssigned(to, {
          reservationId: reservation.id,
          date: reservation.date,
          yurtName: reservation.yurt?.name ?? "",
          yurtDescription: reservation.yurt?.description ?? undefined,
          guestCount: reservation.guestCount,
        });
        break;
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send email" },
        { status: 500 }
      );
    }

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "EMAIL_SENT",
        targetType: "Reservation",
        targetId: id,
        details: { type, to, sentAt: new Date().toISOString() },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send manual email:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
