import { isWithinFreeze } from '../yurt-assignment';

describe('isWithinFreeze', () => {
  const now = new Date('2026-04-29T12:00:00Z');

  it('today → within freeze', () => {
    expect(isWithinFreeze(new Date('2026-04-29T00:00:00Z'), 7, now)).toBe(true);
  });
  it('tomorrow → within freeze', () => {
    expect(isWithinFreeze(new Date('2026-04-30T00:00:00Z'), 7, now)).toBe(true);
  });
  it('exactly 7 days out → within freeze', () => {
    expect(isWithinFreeze(new Date('2026-05-06T00:00:00Z'), 7, now)).toBe(true);
  });
  it('8 days out → past freeze', () => {
    expect(isWithinFreeze(new Date('2026-05-07T00:00:00Z'), 7, now)).toBe(false);
  });
  it('far future → past freeze', () => {
    expect(isWithinFreeze(new Date('2027-01-01T00:00:00Z'), 7, now)).toBe(false);
  });
  it('respects custom freeze window: 5 days out with 3-day freeze → false', () => {
    expect(isWithinFreeze(new Date('2026-05-04T00:00:00Z'), 3, now)).toBe(false);
  });
  it('respects custom freeze window: 2 days out with 3-day freeze → true', () => {
    expect(isWithinFreeze(new Date('2026-05-01T00:00:00Z'), 3, now)).toBe(true);
  });
});
