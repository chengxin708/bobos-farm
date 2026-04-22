import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/availability/for-date?date=YYYY-MM-DD
 *
 * Returns each active yurt with an isAvailable flag for the given date,
 * plus the max capacity still free for self-serve booking. Customer-facing
 * booking flows use maxAvailableCapacity to cap the guest picker: once the
 * larger yurts are booked, a party that wouldn't fit in the remaining
 * smaller yurt(s) has to become an inquiry.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const activeYurts = await prisma.yurt.findMany({
      where: { status: "ACTIVE" },
      orderBy: { capacity: "desc" },
      select: { id: true, name: true, capacity: true },
    });

    const closures = await prisma.yurtAvailability.findMany({
      where: { date: dateObj, isOpen: false },
      select: { yurtId: true },
    });
    const closedYurtIds = new Set(closures.map((c) => c.yurtId));

    const reservations = await prisma.reservation.findMany({
      where: {
        date: dateObj,
        OR: [
          { status: { in: ["PAYMENT_SUBMITTED", "CONFIRMED"] } },
          { status: "PENDING_PAYMENT", holdByAdmin: true },
        ],
      },
      select: { yurtId: true, packageCount: true },
    });
    const occupiedYurtIds = new Set(
      reservations.map((r) => r.yurtId).filter((id): id is string => !!id),
    );
    // Unassigned reservations (admin Hold / auto-unassigned) consume generic
    // yurt slots without naming a specific yurt. We conservatively treat
    // them as consuming the largest still-free yurt(s) so the customer-side
    // cap never under-counts.
    const unassignedSlots = reservations
      .filter((r) => !r.yurtId)
      .reduce((acc, r) => acc + (r.packageCount ?? 1), 0);

    const yurts = activeYurts.map((y) => ({
      id: y.id,
      name: y.name,
      capacity: y.capacity,
      isAvailable: !closedYurtIds.has(y.id) && !occupiedYurtIds.has(y.id),
    }));

    // Burn through the largest remaining yurts first so the advertised cap
    // reflects what's really still pickable by a self-serve customer.
    const freeYurtsDesc = yurts
      .filter((y) => y.isAvailable)
      .sort((a, b) => b.capacity - a.capacity)
      .slice(unassignedSlots)
    const maxAvailableCapacity = freeYurtsDesc.reduce(
      (acc, y) => Math.max(acc, y.capacity),
      0,
    )

    return NextResponse.json({
      date,
      yurts,
      maxAvailableCapacity,
    });
  } catch (error) {
    console.error("Failed to fetch per-date yurt availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
