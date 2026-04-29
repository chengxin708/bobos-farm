import {
  computeDeterministicAssignment,
  DeterministicReservationInput,
  DeterministicResult,
} from '../yurt-assignment-pure';

// ─── Test fixtures ──────────────────────────────────────────────────

const YURTS = [
  { id: 'yurt-1', name: '#1', capacity: 30 },
  { id: 'yurt-2', name: '#2', capacity: 24 },
  { id: 'yurt-3', name: '#3', capacity: 16 },
];

function makeRes(
  id: string,
  guestCount: number,
  overrides: Partial<DeterministicReservationInput> = {}
): DeterministicReservationInput {
  return {
    id,
    guestCount,
    yurtId: null,
    manuallyAssigned: false,
    createdAt: new Date('2026-04-20T00:00:00Z'),
    ...overrides,
  };
}

function findAssignment(result: DeterministicResult, resId: string) {
  return result.assignments.find((a) => a.reservationId === resId);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('computeDeterministicAssignment', () => {
  // 1. 25-30 → #1 immediately
  it('assigns 25-30 guests to #1 (only room that fits)', () => {
    const res = [makeRes('A', 26)];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(1);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    expect(result.pending).toHaveLength(0);
  });

  // 2. ≤16 → #3 immediately
  it('assigns ≤16 guests to #3 (smallest room)', () => {
    const res = [makeRes('A', 15)];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(1);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-3');
    expect(result.pending).toHaveLength(0);
  });

  // 3. 17-24 alone → pending
  it('leaves 17-24 guests pending (ambiguous)', () => {
    const res = [makeRes('A', 20)];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(0);
    expect(result.pending).toContain('A');
  });

  // 4. 25 + 20 → cascade #2
  it('cascades: 25→#1, then 20→#2 (single candidate)', () => {
    const res = [
      makeRes('A', 25, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 20, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(2);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-2');
    expect(result.pending).toHaveLength(0);
  });

  // 5. 20 + 20 → Phase 3: same size, FIFO tiebreak
  it('Phase 3: same guest count uses FIFO (first→#1, second→#2)', () => {
    const res = [
      makeRes('A', 20, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 20, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(2);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-2');
    expect(result.pending).toHaveLength(0);
  });

  // 6. 21 + 20 → Phase 3: 21>20, so 21→#1, 20→#2
  it('Phase 3: larger group gets bigger room (21→#1, 20→#2)', () => {
    const res = [
      makeRes('A', 21, { createdAt: new Date('2026-04-20T09:00:00Z') }),
      makeRes('B', 20, { createdAt: new Date('2026-04-20T08:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(2);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-2');
    expect(result.pending).toHaveLength(0);
  });

  // 7. 15 + 20 + 18 → #3 + Phase 3: 20>18, so 20→#1, 18→#2
  it('15→#3, then Phase 3: 20→#1, 18→#2', () => {
    const res = [
      makeRes('A', 15, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 20, { createdAt: new Date('2026-04-20T09:00:00Z') }),
      makeRes('C', 18, { createdAt: new Date('2026-04-20T10:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(3);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-3');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'C')?.yurtId).toBe('yurt-2');
    expect(result.pending).toHaveLength(0);
  });

  // 8. 15 + 20 → #3 assigned, 20 pending
  it('15→#3, 20 stays pending (1 pending, 2 rooms available → skip)', () => {
    const res = [
      makeRes('A', 15, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 20, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(1);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-3');
    expect(result.pending).toContain('B');
  });

  // 9. Admin override preserved (manuallyAssigned skipped)
  it('preserves manuallyAssigned reservations (never reassigns)', () => {
    const res = [
      makeRes('A', 20, {
        yurtId: 'yurt-1',
        manuallyAssigned: true,
        createdAt: new Date('2026-04-20T08:00:00Z'),
      }),
      makeRes('B', 25, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    // A stays locked to #1
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    // B=25 can only fit #1 (taken) → single candidate #2? No, #2 cap=24 < 25
    // Actually B=25 needs >=25 capacity. #1 taken. No room fits. → anomaly
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].reservationId).toBe('B');
  });

  // 10. 15(#3) + 12 → 12 pending
  it('15→#3, then 12 stays pending (≤16 but #3 occupied)', () => {
    const res = [
      makeRes('A', 15, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 12, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-3');
    // B=12, #3 occupied. B goes pending (1 pending, 2 rooms → skip Phase 3)
    expect(result.pending).toContain('B');
  });

  // 11. >30 → anomaly
  it('marks >30 guests as anomaly (exceeds max capacity)', () => {
    const res = [makeRes('A', 31)];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(0);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].reason).toBe('exceeds_max_capacity');
  });

  // 12. Full house: 25 + 20 + 15 → all assigned
  it('full house: 25→#1, 15→#3, cascade 20→#2', () => {
    const res = [
      makeRes('A', 25, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 20, { createdAt: new Date('2026-04-20T09:00:00Z') }),
      makeRes('C', 15, { createdAt: new Date('2026-04-20T10:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(3);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-2');
    expect(findAssignment(result, 'C')?.yurtId).toBe('yurt-3');
    expect(result.pending).toHaveLength(0);
    expect(result.anomalies).toHaveLength(0);
  });

  // Additional: existing (non-manual) yurtId is preserved
  it('preserves existing non-manual yurtId assignments', () => {
    const res = [
      makeRes('A', 20, { yurtId: 'yurt-2', manuallyAssigned: false }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-2');
    expect(result.pending).toHaveLength(0);
  });

  // Design doc scenario: B=20 first, A=25 second → same result
  it('order-independent: B=20 then A=25 → A=#1, B=#2', () => {
    const res = [
      makeRes('B', 20, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('A', 25, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-2');
  });

  // Design doc scenario: 15+18+21 → 15→#3, Phase 3: 21→#1, 18→#2
  it('15+18+21: 15→#3, 21→#1, 18→#2', () => {
    const res = [
      makeRes('A', 15, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 18, { createdAt: new Date('2026-04-20T09:00:00Z') }),
      makeRes('C', 21, { createdAt: new Date('2026-04-20T10:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(result.assignments).toHaveLength(3);
    expect(findAssignment(result, 'A')?.yurtId).toBe('yurt-3');
    expect(findAssignment(result, 'C')?.yurtId).toBe('yurt-1');
    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-2');
  });
});
