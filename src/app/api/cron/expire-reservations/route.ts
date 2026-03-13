import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Always enforce CRON_SECRET in all environments (including local dev)
    const configuredSecret = process.env.CRON_SECRET;
    if (!configuredSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      );
    }
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${configuredSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find all reservations that are PENDING_PAYMENT and past their deadline
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING_PAYMENT",
        paymentDeadline: { lt: now },
      },
      select: { id: true, userId: true, yurtId: true, date: true },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        success: true,
        expired: 0,
        message: "No reservations to expire",
      });
    }

    // Update all expired reservations
    const result = await prisma.reservation.updateMany({
      where: {
        status: "PENDING_PAYMENT",
        paymentDeadline: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // Log activity for each expired reservation
    const activityLogs = expiredReservations.map((reservation) =>
      prisma.activityLog.create({
        data: {
          userId: null,
          action: "RESERVATION_EXPIRED",
          targetType: "Reservation",
          targetId: reservation.id,
          details: {
            reason: "Payment deadline passed",
            yurtId: reservation.yurtId,
            date: reservation.date,
          },
        },
      })
    );

    await prisma.$transaction(activityLogs);

    return NextResponse.json({
      success: true,
      expired: result.count,
      message: `Expired ${result.count} reservation(s)`,
    });
  } catch (error) {
    console.error("Failed to expire reservations:", error);
    return NextResponse.json(
      { error: "Failed to expire reservations" },
      { status: 500 }
    );
  }
}
