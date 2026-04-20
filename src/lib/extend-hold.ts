export const EXTEND_HOURS = 24;

/**
 * New deadline after an admin "extend hold" click. If the existing
 * deadline is already in the past (overdue hold), extend from now
 * instead of piling more overdue time on top of it.
 */
export function computeExtendedDeadline(
  current: Date | string | null,
  now: Date = new Date(),
): Date {
  const currentDate = current
    ? typeof current === "string"
      ? new Date(current)
      : current
    : null;
  const base = currentDate && currentDate.getTime() > now.getTime() ? currentDate : now;
  return new Date(base.getTime() + EXTEND_HOURS * 60 * 60 * 1000);
}
