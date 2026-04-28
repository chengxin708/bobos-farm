/**
 * Pure validation for the admin "convert inquiry" / "create proxy
 * reservation" yurt-selection step. The actual yurt rows come from
 * `prisma.yurt.findMany`; this function only checks the post-fetch
 * invariants so it can be tested without a DB.
 *
 * Error strings match what the API route returns verbatim — keep them
 * in sync if the route's user-visible copy changes.
 */

export interface YurtRow {
  id: string;
  capacity: number;
  status: string;
}

export type ValidateYurtSelectionResult =
  | { ok: true; uniqueRequestedIds: string[]; totalCapacity: number }
  | { ok: false; error: string };

export function validateYurtSelection(args: {
  requestedYurtIds: string[];
  foundYurts: YurtRow[];
  guestCount: number;
}): ValidateYurtSelectionResult {
  const uniqueRequestedIds = Array.from(new Set(args.requestedYurtIds));

  if (uniqueRequestedIds.length === 0) {
    return { ok: false, error: "At least one yurt is required" };
  }
  if (args.foundYurts.length !== uniqueRequestedIds.length) {
    return { ok: false, error: "One or more yurts not found" };
  }
  if (args.foundYurts.some((y) => y.status !== "ACTIVE")) {
    return { ok: false, error: "Selected yurt is not active" };
  }
  const totalCapacity = args.foundYurts.reduce((s, y) => s + y.capacity, 0);
  if (args.guestCount > totalCapacity) {
    return {
      ok: false,
      error: "Guest count exceeds combined capacity of selected yurts",
    };
  }
  return { ok: true, uniqueRequestedIds, totalCapacity };
}
