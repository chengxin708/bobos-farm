import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { tryDeterministicAssignment } from "@/lib/yurt-assignment";

const swapSchema = z.object({
  reservationIdA: z.string().min(1),
  reservationIdB: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = swapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { reservationIdA, reservationIdB } = parsed.data;

  if (reservationIdA === reservationIdB) {
    return NextResponse.json(
      { error: "Cannot swap a reservation with itself" },
      { status: 400 }
    );
  }

  // Fetch both reservations
  const [resA, resB] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: reservationIdA },
      select: { id: true, date: true, yurtId: true, status: true },
    }),
    prisma.reservation.findUnique({
      where: { id: reservationIdB },
      select: { id: true, date: true, yurtId: true, status: true },
    }),
  ]);

  if (!resA || !resB) {
    return NextResponse.json(
      { error: "One or both reservations not found" },
      { status: 404 }
    );
  }

  // Both must be on the same date
  const dateA = new Date(resA.date).toISOString().slice(0, 10);
  const dateB = new Date(resB.date).toISOString().slice(0, 10);
  if (dateA !== dateB) {
    return NextResponse.json(
      { error: "Reservations must be on the same date to swap" },
      { status: 400 }
    );
  }

  // At least one must have a yurt — pending↔pending swap is meaningless
  if (!resA.yurtId && !resB.yurtId) {
    return NextResponse.json(
      { error: "At least one reservation must have a room assigned" },
      { status: 400 }
    );
  }

  // Both must be active
  const inactive = ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"];
  if (inactive.includes(resA.status) || inactive.includes(resB.status)) {
    return NextResponse.json(
      { error: "Cannot swap cancelled or expired reservations" },
      { status: 400 }
    );
  }

  // Atomic swap — yurtIds exchange (one side may end up null)
  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationIdA },
      data: {
        yurtId: resB.yurtId,
        yurtAssignedAt: resB.yurtId ? new Date() : null,
        manuallyAssigned: !!resB.yurtId,
      },
    }),
    prisma.reservation.update({
      where: { id: reservationIdB },
      data: {
        yurtId: resA.yurtId,
        yurtAssignedAt: resA.yurtId ? new Date() : null,
        manuallyAssigned: !!resA.yurtId,
      },
    }),
  ]);

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "YURT_SWAPPED",
      targetType: "Reservation",
      targetId: reservationIdA,
      details: {
        reservationIdA,
        reservationIdB,
        yurtA: resA.yurtId,
        yurtB: resB.yurtId,
        date: dateA,
      },
    },
  });

  // Cascade: reassign other reservations on this date
  void tryDeterministicAssignment(new Date(resA.date));

  return NextResponse.json({ success: true });
}
