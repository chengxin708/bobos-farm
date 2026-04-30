// Pure helpers for operating-day resolution. No DB or server imports;
// safe to use in client components.

export type OperatingDayMode = 'OPEN' | 'PRIVATE_EVENT' | 'CLOSED';

const ET_TZ = 'America/New_York';

/** Day-of-week in America/New_York for a given UTC instant. 0=Sun, 6=Sat. */
function etDayOfWeek(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, weekday: 'short' });
  const wk = fmt.format(date);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wk] ?? -1;
}

/** True iff `date` falls on Saturday or Sunday in America/New_York. */
export function isWeekendET(date: Date): boolean {
  const dow = etDayOfWeek(date);
  return dow === 0 || dow === 6;
}

/** Year-Month-Day key in ET, used to look up rows in the operatingDayMap. */
export function etDateKey(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(date); // e.g. "2026-05-02"
}

export interface OperatingModeResult {
  mode: OperatingDayMode;
  isPublic: boolean;
  isWeekend: boolean;
}

/**
 * Resolve the effective operating mode for `date`, given an optional
 * map of explicit overrides keyed by ET date string ("YYYY-MM-DD").
 *
 * Default rule: weekend → OPEN, weekday → CLOSED.
 * Override (any DOW): the row's mode wins.
 * `isPublic` is true only for OPEN — PRIVATE_EVENT and CLOSED both
 * read as "not bookable by the customer".
 */
export function effectiveOperatingMode(
  date: Date,
  operatingDayMap: Map<string, OperatingDayMode>,
): OperatingModeResult {
  const isWeekend = isWeekendET(date);
  const key = etDateKey(date);
  const override = operatingDayMap.get(key);
  const mode: OperatingDayMode = override ?? (isWeekend ? 'OPEN' : 'CLOSED');
  return {
    mode,
    isPublic: mode === 'OPEN',
    isWeekend,
  };
}
