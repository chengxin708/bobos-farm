import {
  computeAvailabilityProbe,
  type DeterministicReservationInput,
} from '../yurt-assignment-pure';

const YURTS = [
  { id: 'yurt-1', name: '#1', capacity: 30 },
  { id: 'yurt-2', name: '#2', capacity: 24 },
  { id: 'yurt-3', name: '#3', capacity: 16 },
];

function res(
  id: string,
  guestCount: number,
  yurtId: string | null = null,
  manuallyAssigned = false,
): DeterministicReservationInput {
  return {
    id,
    guestCount,
    yurtId,
    manuallyAssigned,
    createdAt: new Date('2026-04-20T00:00:00Z'),
  };
}

describe('computeAvailabilityProbe', () => {
  it('empty date: any party 1-30 fits', () => {
    const probe = computeAvailabilityProbe(YURTS, [], 20);
    expect(probe.canFit).toBe(true);
    expect(probe.allYurtsFullForCount).toBe(false);
  });

  it('rejects party > max capacity (>30)', () => {
    const probe = computeAvailabilityProbe(YURTS, [], 31);
    expect(probe.canFit).toBe(false);
    expect(probe.allYurtsFullForCount).toBe(true);
    expect(probe.anomalyReason).toBe('exceeds_max_capacity');
  });

  it('two ≤16 parties already assigned, third 8-person can still fit', () => {
    const existing = [
      res('A', 16, 'yurt-3', true),
      res('B', 24, 'yurt-2', false),
    ];
    const probe = computeAvailabilityProbe(YURTS, existing, 8);
    expect(probe.canFit).toBe(true);
  });

  it('all three rooms taken, no fit for new party', () => {
    const existing = [
      res('A', 28, 'yurt-1', true),
      res('B', 20, 'yurt-2', true),
      res('C', 14, 'yurt-3', true),
    ];
    const probe = computeAvailabilityProbe(YURTS, existing, 6);
    expect(probe.canFit).toBe(false);
    expect(probe.allYurtsFullForCount).toBe(true);
  });

  it('two manuallyAssigned rooms taken, new big party (28) fits in remaining #1', () => {
    const existing = [
      res('A', 14, 'yurt-3', true),
      res('B', 20, 'yurt-2', true),
    ];
    const probe = computeAvailabilityProbe(YURTS, existing, 28);
    expect(probe.canFit).toBe(true);
  });

  it('non-manual assignments can reshuffle to make room', () => {
    // Existing: small party in #1 (auto-assigned), now a 28-person wants in
    // #1 is the only room that fits 28, but the existing 12-person in #1
    // can shift to #3 → feasible.
    const existing = [res('A', 12, 'yurt-1', false)];
    const probe = computeAvailabilityProbe(YURTS, existing, 28);
    expect(probe.canFit).toBe(true);
  });

  it('cannot reshuffle past a manuallyAssigned wall', () => {
    // 12-person manually pinned to #1; 28-person needs #1 but it's locked.
    const existing = [res('A', 12, 'yurt-1', true)];
    const probe = computeAvailabilityProbe(YURTS, existing, 28);
    expect(probe.canFit).toBe(false);
  });
});
