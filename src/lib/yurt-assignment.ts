import { prisma } from "@/lib/prisma";
import { sendPushToAdmins } from "@/lib/push";
import {
  computeBestFitDecreasing,
  computeDeterministicAssignment,
  type AssignmentResult,
  type Anomaly,
  type AssignmentPlan,
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
 * Run deterministic assignment for a target date.
 * Fetches data, computes assignments, writes newly assigned yurtIds to DB,
 * and notifies admins of anomalies.
 */
export async function tryDeterministicAssignment(
  targetDate: Date
): Promise<DeterministicResult> {
  const [availableYurts, reservations] = await Promise.all([
    getAvailableYurts(targetDate),
    getActiveReservationsFull(targetDate),
  ]);

  const result = computeDeterministicAssignment(availableYurts, reservations);

  // Find newly assigned reservations (had no yurtId before)
  const previouslyUnassigned = new Set(
    reservations.filter((r) => !r.yurtId).map((r) => r.id)
  );

  const updates = result.assignments
    .filter((a) => previouslyUnassigned.has(a.reservationId))
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
