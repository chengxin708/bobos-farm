import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCron, runCron } from "@/lib/cron-runner";

export async function GET(req: NextRequest) {
  const authErr = authorizeCron(req);
  if (authErr) return authErr;

  return runCron("expire-reservations", async () => {
    const now = new Date();

    // Only auto-expire customer self-serve holds. Admin-created proxy
    // reservations have a deadline too (for the admin's countdown UI)
    // but are released manually — see 2.4 release-hold action.
    const autoExpireFilter = {
      status: "PENDING_PAYMENT" as const,
      paymentDeadline: { lt: now },
      holdByAdmin: false,
    };

    const expiredReservations = await prisma.reservation.findMany({
      where: autoExpireFilter,
      select: { id: true, userId: true, yurtId: true, date: true },
    });

    if (expiredReservations.length === 0) {
      return { expired: 0, message: "No reservations to expire" };
    }

    const result = await prisma.reservation.updateMany({
      where: autoExpireFilter,
      data: { status: "EXPIRED" },
    });

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
      }),
    );
    await prisma.$transaction(activityLogs);

    return {
      expired: result.count,
      message: `Expired ${result.count} reservation(s)`,
    };
  });
}
