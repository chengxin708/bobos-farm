// Pure functions for yurt assignment — no DB or server imports.
// Safe to use in client components.

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

export interface YurtInput {
  id: string;
  name: string;
  capacity: number;
}

interface ReservationInput {
  id: string;
  guestCount: number;
  yurtId: string | null;
}

export interface OptimizationSuggestion {
  currentWaste: number;
  suggestedWaste: number;
  moves: {
    reservationId: string;
    fromYurtId: string;
    toYurtId: string;
  }[];
}

// ─── Best-Fit Decreasing ────────────────────────────────────────────

export function computeBestFitDecreasing(
  availableYurts: YurtInput[],
  reservations: ReservationInput[]
): AssignmentPlan {
  const assignments: AssignmentResult[] = [];
  const anomalies: Anomaly[] = [];

  const sortedYurts = [...availableYurts].sort((a, b) => a.capacity - b.capacity);
  const yurtMap = new Map(sortedYurts.map((y) => [y.id, y]));
  const usedYurtIds = new Set<string>();

  const sortedReservations = [...reservations].sort(
    (a, b) => b.guestCount - a.guestCount
  );

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
    }
  }

  const maxCapacity =
    sortedYurts.length > 0
      ? sortedYurts[sortedYurts.length - 1].capacity
      : 0;

  for (const res of sortedReservations) {
    if (res.yurtId) continue;

    if (res.guestCount > maxCapacity) {
      anomalies.push({
        reservationId: res.id,
        guestCount: res.guestCount,
        reason: "exceeds_max_capacity",
      });
      continue;
    }

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

  // Phase 0: Lock existing yurtId assignments
  for (const res of reservations) {
    if (res.yurtId) {
      const yurt = yurtMap.get(res.yurtId);
      if (yurt) assignRes(res, yurt);
    }
  }

  // Unassigned, sorted by createdAt ASC (FIFO)
  let unassigned = reservations
    .filter((r) => !r.yurtId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Filter exceeds_max_capacity
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

  // Phase 1a: Single-candidate
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

  // Phase 1b: Smallest-room optimization
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

  // Phase 3: Group determinism
  if (pendingRes.length > 0) {
    const minGuestCount = Math.min(...pendingRes.map((r) => r.guestCount));
    const candidateRooms = getAvailableRoomsFor(minGuestCount);

    if (pendingRes.length === candidateRooms.length) {
      const sortedPending = [...pendingRes].sort((a, b) => {
        if (b.guestCount !== a.guestCount) return b.guestCount - a.guestCount;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
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

// ─── Optimization Suggestion ────────────────────────────────────────

export function computeOptimizationSuggestion(
  availableYurts: YurtInput[],
  currentAssignments: {
    reservationId: string;
    yurtId: string;
    guestCount: number;
  }[]
): OptimizationSuggestion | null {
  if (currentAssignments.length === 0) return null;

  const yurtMap = new Map(availableYurts.map((y) => [y.id, y]));

  let currentWaste = 0;
  for (const a of currentAssignments) {
    const yurt = yurtMap.get(a.yurtId);
    if (yurt) currentWaste += yurt.capacity - a.guestCount;
  }

  const bfdInput: ReservationInput[] = currentAssignments.map((a) => ({
    id: a.reservationId,
    guestCount: a.guestCount,
    yurtId: null,
  }));
  const bfdPlan = computeBestFitDecreasing(availableYurts, bfdInput);

  let suggestedWaste = 0;
  for (const a of bfdPlan.assignments) {
    const yurt = yurtMap.get(a.yurtId);
    if (yurt) suggestedWaste += yurt.capacity - a.guestCount;
  }

  if (suggestedWaste >= currentWaste) return null;

  const currentMap = new Map(
    currentAssignments.map((a) => [a.reservationId, a.yurtId])
  );
  const moves: OptimizationSuggestion["moves"] = [];
  for (const a of bfdPlan.assignments) {
    const currentYurtId = currentMap.get(a.reservationId);
    if (currentYurtId && currentYurtId !== a.yurtId) {
      moves.push({
        reservationId: a.reservationId,
        fromYurtId: currentYurtId,
        toYurtId: a.yurtId,
      });
    }
  }

  if (moves.length === 0) return null;

  return { currentWaste, suggestedWaste, moves };
}
