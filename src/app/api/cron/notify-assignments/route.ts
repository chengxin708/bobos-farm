import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendYurtAssigned } from "@/lib/email";
import { timingSafeEqual } from "crypto";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find reservations assigned but not yet notified
  const reservations = await prisma.reservation.findMany({
    where: {
      yurtId: { not: null },
      yurtAssignedAt: { not: null },
      yurtNotifiedAt: null,
      status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
    },
    include: {
      user: { select: { email: true } },
      yurt: { select: { name: true, description: true } },
    },
  });

  let notified = 0;

  for (const r of reservations) {
    if (!r.user.email || !r.yurt) continue;

    await sendYurtAssigned(r.user.email, {
      date: r.date,
      yurtName: r.yurt.name,
      yurtDescription: r.yurt.description || undefined,
      guestCount: r.guestCount,
      reservationId: r.id,
    });

    await prisma.reservation.update({
      where: { id: r.id },
      data: { yurtNotifiedAt: new Date() },
    });

    notified++;
  }

  return NextResponse.json({ notified });
}
