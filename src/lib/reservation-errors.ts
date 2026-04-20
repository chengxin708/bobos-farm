/**
 * True if `error` is the Prisma unique-constraint violation thrown by the
 * `reservation_yurt_date_active` partial index (guards against two active
 * reservations holding the same yurt+date concurrently).
 */
export function isYurtDateConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (typeof target === "string") {
    return target.includes("reservation_yurt_date_active");
  }
  if (Array.isArray(target)) {
    return target.some(
      (t) => typeof t === "string" && t.includes("reservation_yurt_date_active"),
    );
  }
  return false;
}
