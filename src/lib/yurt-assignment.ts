import { prisma } from "@/lib/prisma";
import { sendPushToAdmins } from "@/lib/push";
import { syncReservationYurt } from "@/lib/reservation-yurt-sync";
import { loadOperatingDayMap } from "./operating-day";
import { effectiveOperatingMode } from "./operating-day-pure";
import {
  computeAvailabilityProbe,
  computeBestFitDecreasing,
  computeDeterministicAssignment,
  type AssignmentResult,
  type Anomaly,
  type AssignmentPlan,
  type AvailabilityProbeResult,
  type DeterministicReservationInput,
  type DeterministicResult,
  type YurtInput,
} from "./yurt-assignment-pure";

// Re-export pure types and functions for consumers
export type { AssignmentResult, Anomaly, AssignmentPlan, DeterministicReservationInput, DeterministicResult };
export { computeDeterministicAssignment } from "./yurt-assignment-pure";
export type { OptimizationSuggestion } from "./yurt-assignment-pure";
export { computeOptimizationSuggestion } from "./yurt-assignment-pure";

interface ReservationInput {
  id: string;
  guestCount: number;
  yurtId: string | null;
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
      status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
    },
    select: { id: true, guestCount: true, yurtId: true },
    orderBy: { guestCount: "desc" },
  });

  return reservations;
}

/** Fetch non-CANCELLED/EXPIRED reservations with deterministic fields. */
async function getActiveReservationsFull(
  targetDate: Date
): Promise<DeterministicReservationInput[]> {
  const reservations = await prisma.reservation.findMany({
    where: {
      date: targetDate,
      status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
    },
    select: {
      id: true,
      guestCount: true,
      yurtId: true,
      manuallyAssigned: true,
      createdAt: true,
    },
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
 * Returns true if `date` is on or within `freezeDays` from `now`.
 *
 * Uses UTC math because reservation.date is stored at UTC midnight
 * (Prisma); local-time setHours would skew across DST and non-UTC
 * servers. This intentionally diverges from the plan's local-time
 * pseudocode in docs/plans/2026-04-29-dynamic-yurt-allocation-plan.md.
 *
 * `freezeDays` is the operational lock window — within that horizon,
 * customers can't modify, deposits aren't refunded on cancel, and
 * ops have already prepared per the current allocation. The single
 * source of truth is `cancellation_window_days` in SystemSetting
 * (default 7); production callers should pass that value in. This
 * function stays pure / parameterized for testability.
 */
export function isWithinFreeze(
  date: Date,
  freezeDays: number,
  now: Date = new Date()
): boolean {
  const horizon = new Date(now);
  horizon.setUTCHours(0, 0, 0, 0);
  horizon.setUTCDate(horizon.getUTCDate() + freezeDays);
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  return target.getTime() <= horizon.getTime();
}

/**
 * Load the freeze window from settings. Same key as the reservation
 * cancellation window (operationally they're the same concept).
 * Falls back to 7 if the setting is missing or unparseable.
 */
export async function getFreezeDays(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "cancellation_window_days" },
  });
  if (!setting?.value) return 7;
  const parsed = parseInt(setting.value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 7;
}

/**
 * Run deterministic assignment for a target date.
 * Fetches data, computes assignments, writes newly assigned yurtIds to DB,
 * and notifies admins of anomalies.
 */
export async function tryDeterministicAssignment(
  targetDate: Date
): Promise<DeterministicResult | null> {
  const freezeDays = await getFreezeDays();
  if (isWithinFreeze(targetDate, freezeDays)) {
    return null; // T-7 freeze: ops have prepared, do not auto-shuffle.
  }

  const [availableYurts, reservations] = await Promise.all([
    getAvailableYurts(targetDate),
    getActiveReservationsFull(targetDate),
  ]);

  const result = computeDeterministicAssignment(availableYurts, reservations);

  // Find newly assigned reservations (had no yurtId before)
  const previouslyUnassigned = new Set(
    reservations.filter((r) => !r.yurtId).map((r) => r.id)
  );

  const newlyAssigned = result.assignments.filter((a) =>
    previouslyUnassigned.has(a.reservationId)
  );

  if (newlyAssigned.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const a of newlyAssigned) {
        await tx.reservation.update({
          where: { id: a.reservationId },
          data: { yurtId: a.yurtId, yurtAssignedAt: new Date() },
        });
        await syncReservationYurt(tx, a.reservationId, a.yurtId);
      }
    });
  }

  // Notify admins of anomalies
  if (result.anomalies.length > 0) {
    const dateStr = targetDate.toISOString().split("T")[0];
    await sendPushToAdmins({
      title: "Yurt Assignment Issue",
      body: `${dateStr}: ${result.anomalies.length} reservation(s) cannot be auto-assigned`,
      url: `/admin/calendar?date=${dateStr}`,
      tag: `yurt-anomaly-${dateStr}`,
    });
  }

  return result;
}

/**
 * Server-side wrapper: load active yurts + non-cancelled reservations
 * for `date`, ask the pure probe whether a new party of `guestCount`
 * can fit. Used by /api/availability/check.
 *
 * Short-circuits to `anomalyReason: 'closed_day'` when the requested
 * date isn't an operating day (default-closed weekday with no row, or
 * any explicit CLOSED / PRIVATE_EVENT override). The customer flow
 * uses this to redirect to the inquiry form instead of running the
 * yurt-fit probe against a date that isn't bookable.
 */
export async function checkAvailabilityForDate(
  date: Date,
  guestCount: number,
): Promise<AvailabilityProbeResult> {
  // Reservation/YurtAvailability rows are stored at UTC midnight, so
  // the Prisma date-equality queries below need that exact instant.
  // effectiveOperatingMode reads the ET calendar via etDateKey, and a
  // UTC-midnight Date lands at 8pm previous-day ET — that would shift
  // a Monday request to Sunday and miss the closed-day default. Build
  // a sibling Date at noon UTC (~8am ET, same calendar day in both
  // zones) just for the operating-mode resolution.
  const opModeAnchor = new Date(date);
  opModeAnchor.setUTCHours(12, 0, 0, 0);
  const operatingMap = await loadOperatingDayMap(date, date);
  const opMode = effectiveOperatingMode(opModeAnchor, operatingMap);
  if (!opMode.isPublic) {
    return {
      canFit: false,
      hypotheticalYurtId: null,
      allYurtsFullForCount: true,
      anomalyReason: "closed_day",
    };
  }
  const [yurts, existing] = await Promise.all([
    getAvailableYurts(date),
    getActiveReservationsFull(date),
  ]);
  return computeAvailabilityProbe(yurts, existing, guestCount);
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
      status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
      yurtId: { not: null },
    },
    select: { id: true },
  });
  const alreadyAssignedIds = new Set(existingReservations.map((r) => r.id));

  // Update newly assigned reservations
  const newlyAssigned = plan.assignments.filter(
    (a) => !alreadyAssignedIds.has(a.reservationId),
  );

  if (newlyAssigned.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const a of newlyAssigned) {
        await tx.reservation.update({
          where: { id: a.reservationId },
          data: { yurtId: a.yurtId, yurtAssignedAt: new Date() },
        });
        await syncReservationYurt(tx, a.reservationId, a.yurtId);
      }
    });
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
