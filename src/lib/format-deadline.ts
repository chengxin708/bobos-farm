/**
 * Format a paymentDeadline for display as a short countdown chip.
 * Returns keys that callers map to localized strings (avoids embedding
 * language in the lib), plus a value for number of hours/minutes.
 *
 * Buckets:
 *   overdue           deadline < now (absolute lateness, no "about to expire" warning)
 *   dueSoonMinutes    0–60 minutes remain
 *   dueSoonHours      1–24 hours remain (warning tone)
 *   normal            >24 hours remain
 */
export type DeadlineStatus = "overdue" | "dueSoonMinutes" | "dueSoonHours" | "normal";

export interface DeadlineFormat {
  status: DeadlineStatus;
  overdue: boolean;
  totalMinutes: number;
  hours: number;
  minutes: number;
}

export function formatDeadline(deadline: Date | string, now: Date = new Date()): DeadlineFormat {
  const target = typeof deadline === "string" ? new Date(deadline) : deadline;
  const diffMs = target.getTime() - now.getTime();
  const overdue = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.floor(absMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let status: DeadlineStatus;
  if (overdue) status = "overdue";
  else if (hours < 1) status = "dueSoonMinutes";
  else if (hours < 24) status = "dueSoonHours";
  else status = "normal";

  return { status, overdue, totalMinutes, hours, minutes };
}
