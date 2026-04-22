import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/availability/slots?startDate=2026-04-01&endDate=2026-04-30
 *
 * Returns per-date slot availability for the calendar.
 * - total: number of active yurts (that are not admin-closed on that date)
 * - occupied: reservations with status PAYMENT_SUBMITTED or CONFIRMED,
 *   plus admin-held PENDING_PAYMENT reservations (holdByAdmin=true)
 * - available: total - occupied
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

    // Get occupying reservations. We include BOTH yurt-assigned reservations
    // and unassigned ones (admin Hold / auto that failed to deterministically
    // place) so the customer-facing calendar reflects the true remaining
    // capacity. Admins can still over-allocate via Hold in the admin POST
    // path; that's a deliberate decision surfaced as an admin warning, but
    // the customer should never see those dates as bookable.
    const reservations = await prisma.reservation.findMany({
      where: {
        date: { gte: startDateObj, lte: endDateObj },
        OR: [
          { status: { in: ["PAYMENT_SUBMITTED", "CONFIRMED"] } },
          { status: "PENDING_PAYMENT", holdByAdmin: true },
        ],
      },
      select: { yurtId: true, date: true, packageCount: true },
    });

    // Per-date occupancy. Yurt-assigned reservations occupy that specific
    // yurt; unassigned reservations consume `packageCount || 1` generic yurt
    // slots. Cap at activeYurtCount so an admin over-allocation (say 5
    // reservations on a 3-yurt date) shows as "full" rather than going
    // negative.
    const assignedByDate: Record<string, Set<string>> = {};
    const unassignedSlotsByDate: Record<string, number> = {};
    for (const r of reservations) {
      const dateKey = r.date.toISOString().slice(0, 10);
      if (r.yurtId && activeYurtIds.has(r.yurtId)) {
        if (!assignedByDate[dateKey]) assignedByDate[dateKey] = new Set();
        assignedByDate[dateKey].add(r.yurtId);
      } else if (!r.yurtId) {
        unassignedSlotsByDate[dateKey] =
          (unassignedSlotsByDate[dateKey] ?? 0) + (r.packageCount ?? 1);
      }
    }

    const result: Record<string, { total: number; occupied: number; available: number }> = {};
    const current = new Date(startDateObj);

    while (current <= endDateObj) {
      const dateKey = current.toISOString().slice(0, 10);
      const closedCount = closuresByDate[dateKey]?.size || 0;
      const total = activeYurtCount - closedCount;
      const assignedCount = assignedByDate[dateKey]?.size || 0;
      const unassignedCount = unassignedSlotsByDate[dateKey] || 0;
      const occupied = Math.min(total, assignedCount + unassignedCount);
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
