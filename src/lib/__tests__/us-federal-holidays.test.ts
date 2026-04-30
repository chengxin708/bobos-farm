import { getFederalHolidays } from '../us-federal-holidays';

/** Format a UTC midnight Date as "YYYY-MM-DD" using its UTC components. */
function isoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function findById(holidays: ReturnType<typeof getFederalHolidays>, idPrefix: string) {
  return holidays.find((h) => h.id.startsWith(idPrefix));
}

describe('getFederalHolidays — shape & ordering', () => {
  it('returns 11 entries for any year', () => {
    expect(getFederalHolidays(2026)).toHaveLength(11);
    expect(getFederalHolidays(2027)).toHaveLength(11);
    expect(getFederalHolidays(2028)).toHaveLength(11);
  });

  it('entries are sorted ascending by date', () => {
    const list = getFederalHolidays(2026);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].date.getTime()).toBeGreaterThanOrEqual(list[i - 1].date.getTime());
    }
  });

  it('every entry has a UTC midnight date (00:00:00.000Z)', () => {
    for (const h of getFederalHolidays(2026)) {
      expect(h.date.getUTCHours()).toBe(0);
      expect(h.date.getUTCMinutes()).toBe(0);
      expect(h.date.getUTCSeconds()).toBe(0);
      expect(h.date.getUTCMilliseconds()).toBe(0);
    }
  });
});

describe('getFederalHolidays — weekend observance', () => {
  it('2026 Independence Day (Jul 4 = Sat) → observed Fri Jul 3', () => {
    const h = findById(getFederalHolidays(2026), 'independence-day-')!;
    expect(h).toBeDefined();
    expect(isoUtc(h.date)).toBe('2026-07-03');
    expect(h.dayOfWeek).toBe(5); // Friday
    expect(h.isObserved).toBe(true);
    expect(h.actualDate).toBeDefined();
    expect(isoUtc(h.actualDate!)).toBe('2026-07-04');
  });

  it('2027 Christmas (Dec 25 = Sat) → observed Fri Dec 24', () => {
    const h = findById(getFederalHolidays(2027), 'christmas-day-')!;
    expect(isoUtc(h.date)).toBe('2027-12-24');
    expect(h.dayOfWeek).toBe(5);
    expect(h.isObserved).toBe(true);
    expect(isoUtc(h.actualDate!)).toBe('2027-12-25');
  });

  it("2028 New Year's Day (Jan 1 = Sat) → observed Fri Dec 31 2027 (cross-year shift)", () => {
    const h = findById(getFederalHolidays(2028), 'new-years-day-')!;
    expect(h.nameEn).toBe("New Year's Day");
    expect(isoUtc(h.date)).toBe('2027-12-31');
    expect(h.dayOfWeek).toBe(5); // Friday
    expect(h.isObserved).toBe(true);
    expect(isoUtc(h.actualDate!)).toBe('2028-01-01');
  });

  it('2026 Christmas (Dec 25 = Fri) → no shift, isObserved=false', () => {
    const h = findById(getFederalHolidays(2026), 'christmas-day-')!;
    expect(isoUtc(h.date)).toBe('2026-12-25');
    expect(h.dayOfWeek).toBe(5);
    expect(h.isObserved).toBe(false);
    expect(h.actualDate).toBeUndefined();
  });

  it('2026 New Year (Jan 1 = Thu) → no shift', () => {
    const h = findById(getFederalHolidays(2026), 'new-years-day-')!;
    expect(isoUtc(h.date)).toBe('2026-01-01');
    expect(h.dayOfWeek).toBe(4); // Thursday
    expect(h.isObserved).toBe(false);
  });
});

describe('getFederalHolidays — floating holidays', () => {
  it('2026 MLK Day = 3rd Mon of Jan = 2026-01-19', () => {
    const h = findById(getFederalHolidays(2026), 'mlk-day-')!;
    expect(isoUtc(h.date)).toBe('2026-01-19');
    expect(h.dayOfWeek).toBe(1);
  });

  it('2026 Presidents’ Day = 3rd Mon of Feb = 2026-02-16', () => {
    const h = findById(getFederalHolidays(2026), 'presidents-day-')!;
    expect(isoUtc(h.date)).toBe('2026-02-16');
    expect(h.dayOfWeek).toBe(1);
  });

  it('2026 Memorial Day = last Mon of May = 2026-05-25', () => {
    const h = findById(getFederalHolidays(2026), 'memorial-day-')!;
    expect(isoUtc(h.date)).toBe('2026-05-25');
    expect(h.dayOfWeek).toBe(1);
  });

  it('2026 Labor Day = 1st Mon of Sept = 2026-09-07', () => {
    const h = findById(getFederalHolidays(2026), 'labor-day-')!;
    expect(isoUtc(h.date)).toBe('2026-09-07');
    expect(h.dayOfWeek).toBe(1);
  });

  it('2026 Columbus Day = 2nd Mon of Oct = 2026-10-12', () => {
    const h = findById(getFederalHolidays(2026), 'columbus-day-')!;
    expect(isoUtc(h.date)).toBe('2026-10-12');
    expect(h.dayOfWeek).toBe(1);
  });

  it('2026 Thanksgiving = 4th Thu of Nov = 2026-11-26', () => {
    const h = findById(getFederalHolidays(2026), 'thanksgiving-day-')!;
    expect(isoUtc(h.date)).toBe('2026-11-26');
    expect(h.dayOfWeek).toBe(4);
  });
});

describe('getFederalHolidays — Juneteenth/Veterans observance', () => {
  it('2026 Juneteenth (Jun 19 = Fri) → no shift', () => {
    const h = findById(getFederalHolidays(2026), 'juneteenth-')!;
    expect(isoUtc(h.date)).toBe('2026-06-19');
    expect(h.dayOfWeek).toBe(5);
    expect(h.isObserved).toBe(false);
  });

  it('2026 Veterans Day (Nov 11 = Wed) → no shift', () => {
    const h = findById(getFederalHolidays(2026), 'veterans-day-')!;
    expect(isoUtc(h.date)).toBe('2026-11-11');
    expect(h.dayOfWeek).toBe(3);
    expect(h.isObserved).toBe(false);
  });
});
