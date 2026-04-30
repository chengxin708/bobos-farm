import {
  effectiveOperatingMode,
  etDateKey,
  isWeekendET,
  type OperatingDayMode,
} from '../operating-day-pure';
import { computeAvailabilityProbe } from '../yurt-assignment-pure';

describe('isWeekendET', () => {
  it('Saturday in UTC is Saturday in ET → weekend', () => {
    // 2026-05-02 is a Saturday
    expect(isWeekendET(new Date('2026-05-02T12:00:00Z'))).toBe(true);
  });
  it('Sunday in UTC is Sunday in ET → weekend', () => {
    expect(isWeekendET(new Date('2026-05-03T12:00:00Z'))).toBe(true);
  });
  it('Monday in UTC is Monday in ET → not weekend', () => {
    expect(isWeekendET(new Date('2026-05-04T12:00:00Z'))).toBe(false);
  });
  it('Late Friday UTC midnight = Thursday ET evening → not weekend (still Thursday)', () => {
    // 2026-05-08T00:00:00Z = Thu May 7 8pm ET → DOW=4 (Thu) → not weekend
    expect(isWeekendET(new Date('2026-05-08T00:00:00Z'))).toBe(false);
  });
  it('Early Saturday UTC = late Friday ET → still Friday → not weekend', () => {
    // 2026-05-09T03:00:00Z = Fri May 8 11pm ET → DOW=5 (Fri) → not weekend
    expect(isWeekendET(new Date('2026-05-09T03:00:00Z'))).toBe(false);
  });
});

describe('isWeekendET DST + all-DOW sweep', () => {
  // 2026-03-08 is the spring-forward Sunday in ET (02:00 EST → 03:00 EDT)
  it('handles spring-forward Sunday (DST start)', () => {
    expect(isWeekendET(new Date('2026-03-08T07:00:00Z'))).toBe(true); // 2am EST / 3am EDT, still Sunday
  });
  // 2026-11-01 is the fall-back Sunday in ET (02:00 EDT → 01:00 EST)
  it('handles fall-back Sunday (DST end)', () => {
    expect(isWeekendET(new Date('2026-11-01T06:00:00Z'))).toBe(true); // 2am EDT / 1am EST, still Sunday
  });

  // All seven days, noon UTC = morning ET, same calendar date in both zones.
  // 2026-05-03 (Sun) … 2026-05-09 (Sat)
  const days = [
    { iso: '2026-05-03T12:00:00Z', label: 'Sun', weekend: true },
    { iso: '2026-05-04T12:00:00Z', label: 'Mon', weekend: false },
    { iso: '2026-05-05T12:00:00Z', label: 'Tue', weekend: false },
    { iso: '2026-05-06T12:00:00Z', label: 'Wed', weekend: false },
    { iso: '2026-05-07T12:00:00Z', label: 'Thu', weekend: false },
    { iso: '2026-05-08T12:00:00Z', label: 'Fri', weekend: false },
    { iso: '2026-05-09T12:00:00Z', label: 'Sat', weekend: true },
  ];
  for (const d of days) {
    it(`${d.label} (${d.iso}) → weekend=${d.weekend}`, () => {
      expect(isWeekendET(new Date(d.iso))).toBe(d.weekend);
    });
  }
});

describe('etDateKey', () => {
  it('returns the ET calendar date for a UTC instant', () => {
    // 2026-05-04T03:00:00Z = May 3 11pm ET (Sunday)
    expect(etDateKey(new Date('2026-05-04T03:00:00Z'))).toBe('2026-05-03');
  });
  it('pads month/day to 2 digits', () => {
    expect(etDateKey(new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});

describe('effectiveOperatingMode', () => {
  const empty = new Map<string, OperatingDayMode>();

  // NOTE: tests use T12:00:00Z (noon UTC = ~8am ET) so the UTC date and
  // the ET date are identical. Using T00:00:00Z would shift the ET date
  // back one day and conflate the tests with the DST/midnight boundary
  // already covered in the isWeekendET suite.

  it('weekend with no row → OPEN', () => {
    const r = effectiveOperatingMode(new Date('2026-05-02T12:00:00Z'), empty);
    expect(r.mode).toBe('OPEN');
    expect(r.isPublic).toBe(true);
    expect(r.isWeekend).toBe(true);
  });

  it('weekday with no row → CLOSED', () => {
    const r = effectiveOperatingMode(new Date('2026-05-04T12:00:00Z'), empty);
    expect(r.mode).toBe('CLOSED');
    expect(r.isPublic).toBe(false);
    expect(r.isWeekend).toBe(false);
  });

  it('weekday with row OPEN → OPEN', () => {
    const map = new Map<string, OperatingDayMode>([['2026-07-03', 'OPEN']]);
    // 2026-07-03 is a Friday (weekday)
    const r = effectiveOperatingMode(new Date('2026-07-03T12:00:00Z'), map);
    expect(r.mode).toBe('OPEN');
    expect(r.isPublic).toBe(true);
  });

  it('weekday with row PRIVATE_EVENT → PRIVATE_EVENT, not public', () => {
    const map = new Map<string, OperatingDayMode>([['2026-05-04', 'PRIVATE_EVENT']]);
    const r = effectiveOperatingMode(new Date('2026-05-04T12:00:00Z'), map);
    expect(r.mode).toBe('PRIVATE_EVENT');
    expect(r.isPublic).toBe(false);
  });

  it('weekend with row CLOSED → CLOSED, not public', () => {
    const map = new Map<string, OperatingDayMode>([['2026-05-02', 'CLOSED']]);
    const r = effectiveOperatingMode(new Date('2026-05-02T12:00:00Z'), map);
    expect(r.mode).toBe('CLOSED');
    expect(r.isPublic).toBe(false);
  });

  it('weekend with row PRIVATE_EVENT → PRIVATE_EVENT, not public', () => {
    const map = new Map<string, OperatingDayMode>([['2026-05-02', 'PRIVATE_EVENT']]);
    const r = effectiveOperatingMode(new Date('2026-05-02T12:00:00Z'), map);
    expect(r.mode).toBe('PRIVATE_EVENT');
    expect(r.isPublic).toBe(false);
  });
});

describe('Operating mode + probe interaction', () => {
  // Yurt #1 capacity = 30 (per dynamic-yurt-allocation merged baseline).
  const YURTS = [
    { id: 'yurt-1', name: '#1', capacity: 30 },
    { id: 'yurt-2', name: '#2', capacity: 24 },
    { id: 'yurt-3', name: '#3', capacity: 16 },
  ];

  it('weekend with no row + probe says canFit → returns canFit', () => {
    const map = new Map<string, OperatingDayMode>();
    const date = new Date('2026-05-02T12:00:00Z'); // Saturday in ET
    const opMode = effectiveOperatingMode(date, map);
    expect(opMode.isPublic).toBe(true);
    const probe = computeAvailabilityProbe(YURTS, [], 20);
    expect(probe.canFit).toBe(true);
  });

  it('weekday with no row → effectiveOperatingMode says not public', () => {
    const map = new Map<string, OperatingDayMode>();
    const date = new Date('2026-05-04T12:00:00Z'); // Monday in ET
    const opMode = effectiveOperatingMode(date, map);
    expect(opMode.isPublic).toBe(false);
    expect(opMode.mode).toBe('CLOSED');
  });
});
