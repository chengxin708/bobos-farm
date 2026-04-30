/**
 * US federal holiday calculator. Pure: no DB, no I/O. Returns one entry
 * per holiday for a given calendar year. For fixed-date holidays that
 * fall on a weekend, the entry's `date` is the federal observed date
 * (Sat → previous Friday, Sun → following Monday) and `actualDate` is
 * set to the actual calendar date. All dates are UTC midnight Date
 * instances so the calendar date is stable across viewer timezones.
 */

export interface FederalHoliday {
  /** Stable id like "new-years-day-2026" */
  id: string;
  nameEn: string;
  nameZh: string;
  /** Observed date (UTC midnight). For fixed holidays falling on Sat/Sun, this is the federal observed date. */
  date: Date;
  /** Day of week of `date`, 0=Sun..6=Sat, computed in UTC. */
  dayOfWeek: number;
  /** True if `date` differs from the actual calendar date because of weekend observance. */
  isObserved: boolean;
  /** When `isObserved`, the actual calendar date (UTC midnight). */
  actualDate?: Date;
}

const FIXED = [
  { month: 1,  day: 1,  id: 'new-years-day',    nameEn: "New Year's Day",  nameZh: '元旦' },
  { month: 6,  day: 19, id: 'juneteenth',       nameEn: 'Juneteenth',      nameZh: '六月节' },
  { month: 7,  day: 4,  id: 'independence-day', nameEn: 'Independence Day',nameZh: '独立日' },
  { month: 11, day: 11, id: 'veterans-day',     nameEn: 'Veterans Day',    nameZh: '退伍军人节' },
  { month: 12, day: 25, id: 'christmas-day',    nameEn: 'Christmas Day',   nameZh: '圣诞节' },
] as const;

const FLOATING = [
  { month: 1,  nth: 3,      weekday: 1, id: 'mlk-day',          nameEn: 'Martin Luther King Jr. Day', nameZh: '马丁·路德·金纪念日' },
  { month: 2,  nth: 3,      weekday: 1, id: 'presidents-day',   nameEn: "Presidents' Day",            nameZh: '总统日' },
  { month: 5,  nth: 'last', weekday: 1, id: 'memorial-day',     nameEn: 'Memorial Day',                nameZh: '阵亡将士纪念日' },
  { month: 9,  nth: 1,      weekday: 1, id: 'labor-day',        nameEn: 'Labor Day',                   nameZh: '劳动节' },
  { month: 10, nth: 2,      weekday: 1, id: 'columbus-day',     nameEn: 'Columbus Day',                nameZh: '哥伦布日' },
  { month: 11, nth: 4,      weekday: 4, id: 'thanksgiving-day', nameEn: 'Thanksgiving Day',            nameZh: '感恩节' },
] as const;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function nthWeekdayOfMonth(year: number, month: number, nth: number, weekday: number): Date {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utcDate(year, month, 1 + offset + (nth - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  // utcDate(year, month + 1, 0) → 0th day of next month = last day of this month
  const lastDayOfMonth = utcDate(year, month + 1, 0).getUTCDate();
  const last = utcDate(year, month, lastDayOfMonth);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return utcDate(year, month, lastDayOfMonth - offset);
}

function observedShift(d: Date): Date {
  const dow = d.getUTCDay();
  if (dow === 6) return new Date(d.getTime() - 86_400_000); // Sat → Fri
  if (dow === 0) return new Date(d.getTime() + 86_400_000); // Sun → Mon
  return d;
}

export function getFederalHolidays(year: number): FederalHoliday[] {
  const out: FederalHoliday[] = [];
  for (const f of FIXED) {
    const actual = utcDate(year, f.month, f.day);
    const observed = observedShift(actual);
    const isObserved = observed.getTime() !== actual.getTime();
    out.push({
      id: `${f.id}-${year}`,
      nameEn: f.nameEn,
      nameZh: f.nameZh,
      date: observed,
      dayOfWeek: observed.getUTCDay(),
      isObserved,
      actualDate: isObserved ? actual : undefined,
    });
  }
  for (const fl of FLOATING) {
    const date = fl.nth === 'last'
      ? lastWeekdayOfMonth(year, fl.month, fl.weekday)
      : nthWeekdayOfMonth(year, fl.month, fl.nth, fl.weekday);
    out.push({
      id: `${fl.id}-${year}`,
      nameEn: fl.nameEn,
      nameZh: fl.nameZh,
      date,
      dayOfWeek: date.getUTCDay(),
      isObserved: false,
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
