import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { runBestFitDecreasing } from "@/lib/yurt-assignment";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  // Get all reservations in range
  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gte: start, lte: end },
      status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
    },
    select: { date: true, guestCount: true, yurtId: true },
  });

  // Get total capacity
  const activeYurts = await prisma.yurt.findMany({
    where: { status: "ACTIVE" },
    select: { capacity: true },
  });
  const totalCapacity = activeYurts.reduce((sum, y) => sum + y.capacity, 0);

  // Group by date
  const dateMap: Record<string, {
    totalGuests: number;
    totalCapacity: number;
    reservationCount: number;
    assignedCount: number;
    unassignedCount: number;
    hasAnomaly: boolean;
  }> = {};

  for (const r of reservations) {
    const dateKey = r.date.toISOString().split("T")[0];
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {
        totalGuests: 0,
        totalCapacity: totalCapacity,
        reservationCount: 0,
        assignedCount: 0,
        unassignedCount: 0,
        hasAnomaly: false,
      };
    }
    dateMap[dateKey].totalGuests += r.guestCount;
    dateMap[dateKey].reservationCount++;
    if (r.yurtId) {
      dateMap[dateKey].assignedCount++;
    } else {
      dateMap[dateKey].unassignedCount++;
    }
  }

  // Check anomalies for dates with reservations
  for (const dateKey of Object.keys(dateMap)) {
    const d = new Date(dateKey + "T00:00:00Z");
    const plan = await runBestFitDecreasing(d);
    dateMap[dateKey].hasAnomaly = plan.anomalies.length > 0;
  }

  return NextResponse.json(dateMap);
}
