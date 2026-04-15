import { prisma } from "@/lib/prisma";
import { sendPushToAdmins } from "@/lib/push";

// ─── Types ───────────────────────────────────────────────────────────

export interface AssignmentResult {
  reservationId: string;
  yurtId: string;
  yurtName: string;
  guestCount: number;
}

export interface Anomaly {
  reservationId: string;
  guestCount: number;
  reason: "exceeds_max_capacity" | "no_yurt_available";
}

export interface AssignmentPlan {
  assignments: AssignmentResult[];
  anomalies: Anomaly[];
}

// ─── Deterministic Assignment Types ─────────────────────────────────

export interface DeterministicReservationInput {
  id: string;
  guestCount: number;
  yurtId: string | null;
  manuallyAssigned: boolean;
  createdAt: Date;
}

export interface DeterministicResult {
  assignments: AssignmentResult[];
  pending: string[];
  anomalies: Anomaly[];
}

// ─── Internal pure function (no DB queries) ──────────────────────────

interface YurtInput {
  id: string;
  name: string;
  capacity: number;
}

interface ReservationInput {
  id: string;
  guestCount: number;
  yurtId: string | null;
}

/**
 * Pure Best-Fit Decreasing algorithm. Accepts data directly — no side effects.
 *
 * 1. Sort yurts by capacity ASC
 * 2. Sort reservations by guestCount DESC
 * 3. Preserve existing yurtId assignments (admin manual overrides)
 * 4. For each unassigned reservation: find smallest available yurt with capacity >= guestCount
 * 5. Unassignable reservations -> anomaly
 */
function computeBestFitDecreasing(
  availableYurts: YurtInput[],
  reservations: ReservationInput[]
): AssignmentPlan {
  const assignments: AssignmentResult[] = [];
  const anomalies: Anomaly[] = [];

  // Sort yurts by capacity ASC (for best-fit: smallest sufficient yurt)
  const sortedYurts = [...availableYurts].sort((a, b) => a.capacity - b.capacity);

  // Build a lookup map for yurt data
  const yurtMap = new Map(sortedYurts.map((y) => [y.id, y]));

  // Track which yurts are already used
  const usedYurtIds = new Set<string>();

  // Sort reservations by guestCount DESC (largest first = decreasing)
  const sortedReservations = [...reservations].sort(
    (a, b) => b.guestCount - a.guestCount
  );

  // Phase 1: Lock in existing assignments (admin manual overrides)
  for (const res of sortedReservations) {
    if (res.yurtId) {
      const yurt = yurtMap.get(res.yurtId);
      if (yurt) {
        assignments.push({
          reservationId: res.id,
          yurtId: yurt.id,
          yurtName: yurt.name,
          guestCount: res.guestCount,
        });
        usedYurtIds.add(yurt.id);
      }
      // If the yurt is not in availableYurts (e.g. closed for the day),
      // the admin override stands but we don't add it to assignments
      // since we can't confirm the yurt details — this is an edge case
      // where admin intentionally assigned a closed yurt.
    }
  }

  // Determine max capacity across all available yurts
  const maxCapacity =
    sortedYurts.length > 0
      ? sortedYurts[sortedYurts.length - 1].capacity
      : 0;

  // Phase 2: Assign unassigned reservations using Best-Fit Decreasing
  for (const res of sortedReservations) {
    if (res.yurtId) continue; // Already handled in Phase 1

    // Check if guestCount exceeds the largest available yurt
    if (res.guestCount > maxCapacity) {
      anomalies.push({
        reservationId: res.id,
        guestCount: res.guestCount,
        reason: "exceeds_max_capacity",
      });
      continue;
    }

    // Find the smallest available yurt that fits (best-fit)
    let assigned = false;
    for (const yurt of sortedYurts) {
      if (usedYurtIds.has(yurt.id)) continue;
      if (yurt.capacity >= res.guestCount) {
        assignments.push({
          reservationId: res.id,
          yurtId: yurt.id,
          yurtName: yurt.name,
          guestCount: res.guestCount,
        });
        usedYurtIds.add(yurt.id);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      anomalies.push({
        reservationId: res.id,
        guestCount: res.guestCount,
        reason: "no_yurt_available",
      });
    }
  }

  return { assignments, anomalies };
}

// ─── Deterministic Assignment (3 phases) ────────────────────────────

/**
 * Pure deterministic assignment algorithm.
 *
 * Phase 1: Immediate deterministic — single-candidate + smallest-room optimization
 * Phase 2: Single-candidate propagation (cascade loop)
 * Phase 3: Group determinism — N pending == N rooms → assign by size
 */
export function computeDeterministicAssignment(
  availableYurts: YurtInput[],
  reservations: DeterministicReservationInput[]
): DeterministicResult {
  const assignments: AssignmentResult[] = [];
  const anomalies: Anomaly[] = [];

  const yurtMap = new Map(availableYurts.map((y) => [y.id, y]));
  const usedYurtIds = new Set<string>();
  const maxCapacity =
    availableYurts.length > 0
      ? Math.max(...availableYurts.map((y) => y.capacity))
      : 0;
  const sortedYurtsAsc = [...availableYurts].sort(
    (a, b) => a.capacity - b.capacity
  );

  function assignRes(res: DeterministicReservationInput, yurt: YurtInput) {
    assignments.push({
      reservationId: res.id,
      yurtId: yurt.id,
      yurtName: yurt.name,
      guestCount: res.guestCount,
    });
    usedYurtIds.add(yurt.id);
  }

  function getAvailableRoomsFor(guestCount: number): YurtInput[] {
    return sortedYurtsAsc.filter(
      (y) => !usedYurtIds.has(y.id) && y.capacity >= guestCount
    );
  }

  // Phase 0: Lock existing yurtId assignments (manuallyAssigned or auto-assigned)
  for (const res of reservations) {
    if (res.yurtId) {
      const yurt = yurtMap.get(res.yurtId);
      if (yurt) {
        assignRes(res, yurt);
      }
    }
  }

  // Get unassigned reservations, sorted by createdAt ASC (FIFO)
  let unassigned = reservations
    .filter((r) => !r.yurtId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Filter out exceeds_max_capacity
  const withinCapacity: DeterministicReservationInput[] = [];
  for (const res of unassigned) {
    if (res.guestCount > maxCapacity) {
      anomalies.push({
        reservationId: res.id,
        guestCount: res.guestCount,
        reason: "exceeds_max_capacity",
      });
    } else {
      withinCapacity.push(res);
    }
  }
  unassigned = withinCapacity;

  // Phase 1a: Single-candidate (e.g., 25-28 → only #1 fits)
  const afterPhase1a: DeterministicReservationInput[] = [];
  for (const res of unassigned) {
    const candidates = getAvailableRoomsFor(res.guestCount);
    if (candidates.length === 1) {
      assignRes(res, candidates[0]);
    } else if (candidates.length === 0) {
      anomalies.push({
        reservationId: res.id,
        guestCount: res.guestCount,
        reason: "no_yurt_available",
      });
    } else {
      afterPhase1a.push(res);
    }
  }

  // Phase 1b: Smallest-room optimization (≤16 → #3)
  const smallestRoom = sortedYurtsAsc[0];
  const afterPhase1: DeterministicReservationInput[] = [];
  for (const res of afterPhase1a) {
    if (
      smallestRoom &&
      !usedYurtIds.has(smallestRoom.id) &&
      res.guestCount <= smallestRoom.capacity
    ) {
      assignRes(res, smallestRoom);
    } else {
      afterPhase1.push(res);
    }
  }

  // Phase 2: Single-candidate propagation (cascade)
  let pendingRes = [...afterPhase1];
  let changed = true;
  while (changed) {
    changed = false;
    const stillPending: DeterministicReservationInput[] = [];
    for (const res of pendingRes) {
      const candidates = getAvailableRoomsFor(res.guestCount);
      if (candidates.length === 1) {
        assignRes(res, candidates[0]);
        changed = true;
      } else if (candidates.length === 0) {
        anomalies.push({
          reservationId: res.id,
          guestCount: res.guestCount,
          reason: "no_yurt_available",
        });
        changed = true;
      } else {
        stillPending.push(res);
      }
    }
    pendingRes = stillPending;
  }

  // Phase 3: Group determinism (N pending == N candidate rooms)
  if (pendingRes.length > 0) {
    const minGuestCount = Math.min(...pendingRes.map((r) => r.guestCount));
    const candidateRooms = getAvailableRoomsFor(minGuestCount);

    if (pendingRes.length === candidateRooms.length) {
      // Sort pending by guestCount DESC, then createdAt ASC (FIFO tiebreak)
      const sortedPending = [...pendingRes].sort((a, b) => {
        if (b.guestCount !== a.guestCount) return b.guestCount - a.guestCount;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      // Sort candidate rooms by capacity DESC
      const sortedRooms = [...candidateRooms].sort(
        (a, b) => b.capacity - a.capacity
      );

      for (let i = 0; i < sortedPending.length; i++) {
        assignRes(sortedPending[i], sortedRooms[i]);
      }
      pendingRes = [];
    }
  }

  return {
    assignments,
    pending: pendingRes.map((r) => r.id),
    anomalies,
  };
}

// ─── DB helpers ──────────────────────────────────────────────────────

/** Fetch ACTIVE yurts available on a given date (excludes date-specific closures). */
async function getAvailableYurts(targetDate: Date): Promise<YurtInput[]> {
  // Get all ACTIVE yurts
  const yurts = await prisma.yurt.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, capacity: true },
    orderBy: { capacity: "asc" },
  });

  // Get date-specific closures
  const closures = await prisma.yurtAvailability.findMany({
    where: {
      date: targetDate,
      isOpen: false,
    },
    select: { yurtId: true },
  });

  const closedIds = new Set(closures.map((c) => c.yurtId));

  return yurts.filter((y) => !closedIds.has(y.id));
}

/** Fetch non-CANCELLED/EXPIRED reservations for a given date. */
async function getActiveReservations(
  targetDate: Date
): Promise<ReservationInput[]> {
  const reservations = await prisma.reservation.findMany({
    where: {
      date: targetDate,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
    },
    select: { id: true, guestCount: true, yurtId: true },
    orderBy: { guestCount: "desc" },
  });

  return reservations;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Run the Best-Fit Decreasing algorithm for a target date.
 * Pure simulation — no DB writes.
 */
export async function runBestFitDecreasing(
  targetDate: Date
): Promise<AssignmentPlan> {
  const [availableYurts, reservations] = await Promise.all([
    getAvailableYurts(targetDate),
    getActiveReservations(targetDate),
  ]);

  return computeBestFitDecreasing(availableYurts, reservations);
}

/**
 * Simulate adding a new reservation to check if a date can accommodate it.
 * Used at booking time to validate capacity before confirming.
 *
 * Uses the internal pure function to avoid duplicate DB queries.
 */
export async function simulateWithNewReservation(
  targetDate: Date,
  newGuestCount: number
): Promise<{ assignable: boolean }> {
  const [availableYurts, existingReservations] = await Promise.all([
    getAvailableYurts(targetDate),
    getActiveReservations(targetDate),
  ]);

  // Add a virtual reservation (no yurtId = unassigned)
  const virtualReservations: ReservationInput[] = [
    ...existingReservations,
    { id: "__virtual__", guestCount: newGuestCount, yurtId: null },
  ];

  const plan = computeBestFitDecreasing(availableYurts, virtualReservations);

  return { assignable: plan.anomalies.length === 0 };
}

/**
 * Check for assignment anomalies on a target date and notify admins if any.
 */
export async function checkDateAnomalies(targetDate: Date): Promise<void> {
  const plan = await runBestFitDecreasing(targetDate);

  if (plan.anomalies.length > 0) {
    const dateStr = targetDate.toISOString().split("T")[0];
    await sendPushToAdmins({
      title: "Yurt Assignment Issue",
      body: `${dateStr}: ${plan.anomalies.length} reservation(s) cannot be auto-assigned`,
      url: `/admin/calendar?date=${dateStr}`,
      tag: `yurt-anomaly-${dateStr}`,
    });
  }
}

/**
 * Execute yurt assignments for a target date.
 * Writes to DB for newly assigned reservations and notifies admins of anomalies.
 */
export async function assignYurtsForDate(
  targetDate: Date
): Promise<AssignmentPlan> {
  const plan = await runBestFitDecreasing(targetDate);

  // Build a set of reservation IDs that already had a yurtId (admin overrides)
  // We only need to update reservations that were newly assigned by the algorithm
  const existingReservations = await prisma.reservation.findMany({
    where: {
      date: targetDate,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      yurtId: { not: null },
    },
    select: { id: true },
  });
  const alreadyAssignedIds = new Set(existingReservations.map((r) => r.id));

  // Update newly assigned reservations
  const updates = plan.assignments
    .filter((a) => !alreadyAssignedIds.has(a.reservationId))
    .map((a) =>
      prisma.reservation.update({
        where: { id: a.reservationId },
        data: {
          yurtId: a.yurtId,
          yurtAssignedAt: new Date(),
        },
      })
    );

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  // Notify admins of anomalies
  if (plan.anomalies.length > 0) {
    const dateStr = targetDate.toISOString().split("T")[0];
    await sendPushToAdmins({
      title: "Yurt Assignment Issue",
      body: `${dateStr}: ${plan.anomalies.length} reservation(s) cannot be auto-assigned`,
      url: `/admin/calendar?date=${dateStr}`,
      tag: `yurt-anomaly-${dateStr}`,
    });
  }

  return plan;
}
