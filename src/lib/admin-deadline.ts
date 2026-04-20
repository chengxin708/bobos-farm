/**
 * Compute the paymentDeadline for an admin-created proxy reservation.
 * Used by the admin branch of POST /api/reservations and covered by
 * jest so the deadline math is testable without a DB.
 *
 * - Past date (historical record): no deadline — reservation is already
 *   COMPLETED.
 * - $0 deposit (skipPayment): no deadline — reservation is already
 *   CONFIRMED.
 * - Otherwise: now + hours.
 */
export function computeAdminPaymentDeadline(args: {
  now: Date;
  hours: number;
  isPastDate: boolean;
  skipPayment: boolean;
}): Date | null {
  const { now, hours, isPastDate, skipPayment } = args;
  if (isPastDate || skipPayment) return null;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

/** Parse the `admin_deposit_deadline_hours` setting with a 48h fallback. */
export function resolveAdminDeadlineHours(raw: string | undefined): number {
  if (!raw) return 48;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 48;
  return n;
}
