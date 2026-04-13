import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/availability/slots?startDate=2026-04-01&endDate=2026-04-30
 *
 * Returns per-date slot availability for the calendar.
 * - total: number of active yurts (that are not admin-closed on that date)
 * - occupied: reservations with status PAYMENT_SUBMITTED or CONFIRMED
 * - available: total - occupied
 *
 * PENDING_PAYMENT reservations do NOT occupy slots.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Get all active yurts
    const activeYurts = await prisma.yurt.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const activeYurtCount = activeYurts.length;
    const activeYurtIds = new Set(activeYurts.map((y) => y.id));

    // Get admin-set closures in the date range
    const closures = await prisma.yurtAvailability.findMany({
      where: {
        date: { gte: startDateObj, lte: endDateObj },
        isOpen: false,
      },
      select: { yurtId: true, date: true },
    });

    // Group closures by date
    const closuresByDate: Record<string, Set<string>> = {};
    for (const c of closures) {
      const dateKey = c.date.toISOString().slice(0, 10);
      if (!closuresByDate[dateKey]) closuresByDate[dateKey] = new Set();
      // Only count closures for currently active yurts
      if (activeYurtIds.has(c.yurtId)) {
        closuresByDate[dateKey].add(c.yurtId);
      }
    }

    // Get occupying reservations (PAYMENT_SUBMITTED + CONFIRMED) in the date range
    const reservations = await prisma.reservation.findMany({
      where: {
        date: { gte: startDateObj, lte: endDateObj },
        status: { in: ["PAYMENT_SUBMITTED", "CONFIRMED"] },
      },
      select: { yurtId: true, date: true },
    });

    // Group reservations by date
    const reservationsByDate: Record<string, Set<string>> = {};
    for (const r of reservations) {
      const dateKey = r.date.toISOString().slice(0, 10);
      if (!reservationsByDate[dateKey]) reservationsByDate[dateKey] = new Set();
      reservationsByDate[dateKey].add(r.yurtId);
    }

    // Build response: iterate each day in the range
    const result: Record<string, { total: number; occupied: number; available: number }> = {};
    const current = new Date(startDateObj);

    while (current <= endDateObj) {
      const dateKey = current.toISOString().slice(0, 10);
      const closedCount = closuresByDate[dateKey]?.size || 0;
      const total = activeYurtCount - closedCount;
      const occupied = reservationsByDate[dateKey]?.size || 0;
      const available = Math.max(0, total - occupied);

      result[dateKey] = { total, occupied, available };

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch availability slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability slots" },
      { status: 500 }
    );
  }
}
