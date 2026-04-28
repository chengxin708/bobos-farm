/**
 * Compute the paymentDeadline for a customer self-serve reservation.
 * Mirrors lib/admin-deadline.ts so both branches share the same unit
 * convention: the setting value is interpreted as HOURS.
 *
 * Historical note: the setting key is `payment_timeout_hours` and earlier
 * code path treated the value as MINUTES (default 720). Unified to HOURS
 * 2026-04-28 so customer (24h) and admin (48h) deadlines speak the same
 * language end-to-end. Existing seeded value "12" now means 12 HOURS,
 * not 12 minutes — a strict improvement for customers.
 */
export function computeCustomerPaymentDeadline(args: {
  now: Date;
  hours: number;
}): Date {
  const { now, hours } = args;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/** Parse the `payment_timeout_hours` setting with a 24h fallback. */
export function resolveCustomerDeadlineHours(raw: string | undefined): number {
  if (!raw) return 24;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 24;
  return n;
}
