import {
  effectiveOperatingMode,
  isWeekendET,
  type OperatingDayMode,
} from '../operating-day-pure';

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
