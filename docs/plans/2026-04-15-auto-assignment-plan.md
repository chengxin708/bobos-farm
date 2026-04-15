# Auto Room Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace T-3 batch assignment with real-time deterministic assignment that triggers on every booking change, keeping large rooms available for large groups.

**Architecture:** New `tryDeterministicAssignment(date)` function in `yurt-assignment.ts` runs 3 phases (immediate → single-candidate propagation → group determinism). Called after every reservation create/cancel/modify/manual-assign. Existing BFD algorithm retained for T-7 fallback and booking validation.

**Tech Stack:** Prisma ORM, Next.js API routes, Jest for unit tests

**Design doc:** `docs/plans/2026-04-15-auto-assignment-design.md`

---

### Task 1: Unit Tests for Deterministic Assignment (pure function)

**Files:**
- Create: `src/lib/__tests__/yurt-assignment.test.ts`

**Step 1: Write the test file**

```typescript
import { computeDeterministicAssignment } from '../yurt-assignment';

const ROOMS = [
  { id: 'room-1', name: '#1', capacity: 28 },
  { id: 'room-2', name: '#2', capacity: 24 },
  { id: 'room-3', name: '#3', capacity: 16 },
];

describe('computeDeterministicAssignment', () => {
  // Phase 1: Immediate deterministic
  test('25-28 guests → assign #1 immediately', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'r1', guestCount: 26, yurtId: null, createdAt: new Date('2026-01-01') },
    ]);
    expect(result.assignments).toEqual([
      expect.objectContaining({ reservationId: 'r1', yurtId: 'room-1' }),
    ]);
    expect(result.pending).toHaveLength(0);
  });

  test('≤16 guests → assign #3 immediately', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'r1', guestCount: 15, yurtId: null, createdAt: new Date('2026-01-01') },
    ]);
    expect(result.assignments).toEqual([
      expect.objectContaining({ reservationId: 'r1', yurtId: 'room-3' }),
    ]);
  });

  test('17-24 guests alone → pending', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'r1', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-01') },
    ]);
    expect(result.assignments).toHaveLength(0);
    expect(result.pending).toEqual(['r1']);
  });

  // Phase 2: Cascade
  test('25 + 20 → #1 + cascade #2', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'r1', guestCount: 25, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'r2', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-02') },
    ]);
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'r1', yurtId: 'room-1' }),
    );
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'r2', yurtId: 'room-2' }),
    );
    expect(result.pending).toHaveLength(0);
  });

  test('20 pending, then 25 arrives → cascade assigns 20→#2', () => {
    // Simulates: B=20 was pending, A=25 arrives on same date
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'rB', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'rA', guestCount: 25, yurtId: null, createdAt: new Date('2026-01-02') },
    ]);
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rA', yurtId: 'room-1' }),
    );
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rB', yurtId: 'room-2' }),
    );
  });

  // Phase 3: Group determinism (N pending == N rooms)
  test('20 + 20 → Phase 3: first→#1, second→#2', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'rA', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'rB', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-02') },
    ]);
    // FIFO: first arrival → biggest room
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rA', yurtId: 'room-1' }),
    );
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rB', yurtId: 'room-2' }),
    );
  });

  test('15 + 20 + 18 → #3 + Phase 3: 20→#1, 18→#2', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'rA', guestCount: 15, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'rB', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-02') },
      { id: 'rC', guestCount: 18, yurtId: null, createdAt: new Date('2026-01-03') },
    ]);
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rA', yurtId: 'room-3' }),
    );
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rB', yurtId: 'room-1' }),
    );
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rC', yurtId: 'room-2' }),
    );
  });

  // Pending stays pending
  test('15 + 20 → #3 assigned, 20 pending (1 pending, 2 rooms)', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'rA', guestCount: 15, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'rB', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-02') },
    ]);
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rA', yurtId: 'room-3' }),
    );
    expect(result.pending).toEqual(['rB']);
  });

  // Admin override preserved
  test('preserves existing admin assignment', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'r1', guestCount: 20, yurtId: 'room-1', createdAt: new Date('2026-01-01') },
      { id: 'r2', guestCount: 18, yurtId: null, createdAt: new Date('2026-01-02') },
    ]);
    // r1 locked to #1, r2 candidates = {#2} → assign #2
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'r1', yurtId: 'room-1' }),
    );
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'r2', yurtId: 'room-2' }),
    );
  });

  // ≤16 but #3 occupied → pending
  test('15(#3) + 12 → 12 pending (not assigned to #2 or #1)', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'rA', guestCount: 15, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'rB', guestCount: 12, yurtId: null, createdAt: new Date('2026-01-02') },
    ]);
    expect(result.assignments).toContainEqual(
      expect.objectContaining({ reservationId: 'rA', yurtId: 'room-3' }),
    );
    expect(result.pending).toEqual(['rB']);
  });

  // Anomaly
  test('>28 guests → anomaly', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'r1', guestCount: 30, yurtId: null, createdAt: new Date('2026-01-01') },
    ]);
    expect(result.anomalies).toContainEqual(
      expect.objectContaining({ reservationId: 'r1', reason: 'exceeds_max_capacity' }),
    );
  });

  // Full house
  test('25 + 20 + 15 → all assigned, no pending', () => {
    const result = computeDeterministicAssignment(ROOMS, [
      { id: 'rA', guestCount: 25, yurtId: null, createdAt: new Date('2026-01-01') },
      { id: 'rB', guestCount: 20, yurtId: null, createdAt: new Date('2026-01-02') },
      { id: 'rC', guestCount: 15, yurtId: null, createdAt: new Date('2026-01-03') },
    ]);
    expect(result.assignments).toHaveLength(3);
    expect(result.pending).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts --no-cache`
Expected: FAIL — `computeDeterministicAssignment` not exported yet

**Step 3: Commit test file**

```bash
git add src/lib/__tests__/yurt-assignment.test.ts
git commit -m "test: add unit tests for deterministic room assignment"
```

---

### Task 2: Implement `computeDeterministicAssignment` Pure Function

**Files:**
- Modify: `src/lib/yurt-assignment.ts`

**Step 1: Add types and export the new pure function**

Add after the existing `ReservationInput` interface (~line 35):

```typescript
interface DeterministicReservationInput {
  id: string;
  guestCount: number;
  yurtId: string | null; // null = unassigned, non-null = locked (admin override)
  createdAt: Date;       // for FIFO ordering in Phase 3
}

interface DeterministicResult {
  assignments: AssignmentResult[];  // reuse existing type
  pending: string[];                // reservation IDs still unassigned
  anomalies: Anomaly[];             // reuse existing type
}
```

Add the function after `computeBestFitDecreasing` (~line 135):

```typescript
/**
 * Deterministic room assignment with 3 phases.
 * Pure function — no DB access, no side effects.
 *
 * Phase 1: Immediate (25-28→#1, ≤16→#3 if available)
 * Phase 2: Single-candidate cascade (iterate until stable)
 * Phase 3: Group determinism (N pending == N candidate rooms → FIFO assign, big room first)
 */
export function computeDeterministicAssignment(
  availableYurts: YurtInput[],
  reservations: DeterministicReservationInput[]
): DeterministicResult {
  const assignments: AssignmentResult[] = [];
  const anomalies: Anomaly[] = [];
  const usedYurtIds = new Set<string>();

  // Build lookup
  const yurtMap = new Map(availableYurts.map((y) => [y.id, y]));
  const sortedYurts = [...availableYurts].sort((a, b) => a.capacity - b.capacity);
  const maxCapacity = sortedYurts.length > 0 ? sortedYurts[sortedYurts.length - 1].capacity : 0;
  const smallestYurt = sortedYurts.length > 0 ? sortedYurts[0] : null;

  // Separate locked (admin-assigned) vs unassigned
  const locked: DeterministicReservationInput[] = [];
  const unassigned: DeterministicReservationInput[] = [];

  for (const res of reservations) {
    if (res.yurtId) {
      locked.push(res);
    } else {
      unassigned.push(res);
    }
  }

  // Lock existing assignments
  for (const res of locked) {
    const yurt = yurtMap.get(res.yurtId!);
    if (yurt) {
      assignments.push({
        reservationId: res.id,
        yurtId: yurt.id,
        yurtName: yurt.name,
        guestCount: res.guestCount,
      });
      usedYurtIds.add(yurt.id);
    }
  }

  // Helper: get candidate rooms for a reservation
  function getCandidates(guestCount: number): YurtInput[] {
    return sortedYurts.filter(
      (y) => y.capacity >= guestCount && !usedYurtIds.has(y.id)
    );
  }

  // Helper: assign a reservation to a room
  function assign(resId: string, guestCount: number, yurt: YurtInput) {
    assignments.push({
      reservationId: resId,
      yurtId: yurt.id,
      yurtName: yurt.name,
      guestCount,
    });
    usedYurtIds.add(yurt.id);
  }

  // Track pending set (mutated through phases)
  let pendingSet = [...unassigned];

  // ── Phase 1: Immediate deterministic ──
  const stillPending: DeterministicReservationInput[] = [];
  for (const res of pendingSet) {
    if (res.guestCount > maxCapacity) {
      anomalies.push({ reservationId: res.id, guestCount: res.guestCount, reason: 'exceeds_max_capacity' });
      continue;
    }
    // 25-28 → #1 (only room that fits, assuming room config)
    // Generalized: if only 1 candidate, assign
    const candidates = getCandidates(res.guestCount);
    if (candidates.length === 1) {
      assign(res.id, res.guestCount, candidates[0]);
      continue;
    }
    // ≤ smallest room capacity AND smallest room available → assign smallest
    if (smallestYurt && res.guestCount <= smallestYurt.capacity && !usedYurtIds.has(smallestYurt.id)) {
      assign(res.id, res.guestCount, smallestYurt);
      continue;
    }
    stillPending.push(res);
  }
  pendingSet = stillPending;

  // ── Phase 2: Single-candidate propagation ──
  let changed = true;
  while (changed) {
    changed = false;
    const nextPending: DeterministicReservationInput[] = [];
    for (const res of pendingSet) {
      const candidates = getCandidates(res.guestCount);
      if (candidates.length === 0) {
        anomalies.push({ reservationId: res.id, guestCount: res.guestCount, reason: 'no_yurt_available' });
        changed = true;
        continue;
      }
      if (candidates.length === 1) {
        assign(res.id, res.guestCount, candidates[0]);
        changed = true;
        continue;
      }
      nextPending.push(res);
    }
    pendingSet = nextPending;
  }

  // ── Phase 3: Group determinism ──
  if (pendingSet.length > 0) {
    // Collect all candidate rooms across all pending reservations
    const allCandidateIds = new Set<string>();
    for (const res of pendingSet) {
      for (const c of getCandidates(res.guestCount)) {
        allCandidateIds.add(c.id);
      }
    }

    if (pendingSet.length === allCandidateIds.size) {
      // N pending == N candidate rooms → all forced
      // FIFO order (by createdAt), biggest room first
      const sorted = [...pendingSet].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      const candidateRooms = sortedYurts
        .filter((y) => allCandidateIds.has(y.id))
        .sort((a, b) => b.capacity - a.capacity); // DESC by capacity

      for (let i = 0; i < sorted.length; i++) {
        assign(sorted[i].id, sorted[i].guestCount, candidateRooms[i]);
      }
      pendingSet = [];
    }
  }

  return {
    assignments,
    pending: pendingSet.map((r) => r.id),
    anomalies,
  };
}
```

**Step 2: Run tests**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts --no-cache`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/lib/yurt-assignment.ts
git commit -m "feat: implement computeDeterministicAssignment pure function (3 phases)"
```

---

### Task 3: Add `tryDeterministicAssignment` DB Wrapper

**Files:**
- Modify: `src/lib/yurt-assignment.ts`

**Step 1: Add the DB-aware wrapper function**

Add after `assignYurtsForDate` (~line 288):

```typescript
/**
 * Run deterministic assignment for a target date.
 * Fetches data from DB, runs the pure algorithm, writes newly assigned rooms.
 * Returns the result for logging/response.
 */
export async function tryDeterministicAssignment(
  targetDate: Date
): Promise<DeterministicResult> {
  const [availableYurts, rawReservations] = await Promise.all([
    getAvailableYurts(targetDate),
    prisma.reservation.findMany({
      where: {
        date: targetDate,
        status: { notIn: ["CANCELLED", "EXPIRED"] },
      },
      select: { id: true, guestCount: true, yurtId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const reservations: DeterministicReservationInput[] = rawReservations.map((r) => ({
    id: r.id,
    guestCount: r.guestCount,
    yurtId: r.yurtId,
    createdAt: r.createdAt,
  }));

  const result = computeDeterministicAssignment(availableYurts, reservations);

  // Find newly assigned reservations (were null, now assigned)
  const alreadyAssignedIds = new Set(
    rawReservations.filter((r) => r.yurtId !== null).map((r) => r.id)
  );
  const newAssignments = result.assignments.filter(
    (a) => !alreadyAssignedIds.has(a.reservationId)
  );

  // Write to DB
  if (newAssignments.length > 0) {
    const updates = newAssignments.map((a) =>
      prisma.reservation.update({
        where: { id: a.reservationId },
        data: {
          yurtId: a.yurtId,
          yurtAssignedAt: new Date(),
        },
      })
    );
    await prisma.$transaction(updates);
  }

  // Notify admins of anomalies
  if (result.anomalies.length > 0) {
    const dateStr = targetDate.toISOString().split("T")[0];
    await sendPushToAdmins({
      title: "Room Assignment Issue",
      body: `${dateStr}: ${result.anomalies.length} reservation(s) cannot be auto-assigned`,
      url: `/admin/calendar?date=${dateStr}`,
      tag: `yurt-anomaly-${dateStr}`,
    });
  }

  return result;
}
```

**Step 2: Export the new types from the module**

At the top of the file, update exports so `DeterministicReservationInput` and `DeterministicResult` are exported (they're used by the function signature which is already exported).

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/yurt-assignment.ts
git commit -m "feat: add tryDeterministicAssignment DB wrapper"
```

---

### Task 4: Wire Up — Reservation Creation

**Files:**
- Modify: `src/app/api/reservations/route.ts` (~lines 382-407)

**Step 1: Replace T-3 logic with deterministic assignment**

Find the block (~line 382):
```typescript
// T-3 window: if reservation date is ≤3 days away, assign yurt immediately
```

Replace the entire T-3 block with:

```typescript
// Deterministic auto-assignment: runs for every new reservation
if (!requestedYurtId) {
  const result = await tryDeterministicAssignment(reservationDate);
  // Refresh reservation to get updated yurtId
  const updated = await prisma.reservation.findUnique({
    where: { id: reservation.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      yurt: { select: { id: true, name: true, capacity: true } },
    },
  });
  if (updated) {
    Object.assign(reservation, updated);
  }
}
```

Also update the import at top of file: add `tryDeterministicAssignment` alongside existing imports from `@/lib/yurt-assignment`.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/reservations/route.ts
git commit -m "feat: trigger deterministic assignment on reservation creation"
```

---

### Task 5: Wire Up — Cancellation

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts` (cancel action, ~line 150)

**Step 1: Add deterministic assignment after cancellation**

After the cancel update completes and activity log is created, add:

```typescript
// Re-run deterministic assignment for freed capacity
void tryDeterministicAssignment(new Date(reservation.date));
```

Also update the cancel policy from T-3 to T-7 (~line 177):
```typescript
if (cancelDiffDays < 7 && !isAdmin) {
```

And refund eligibility (~line 189):
```typescript
const refundEligible = diffDays >= 7;
```

Update the import at top of file: add `tryDeterministicAssignment`.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/reservations/[id]/route.ts
git commit -m "feat: trigger deterministic assignment on cancel, change policy to T-7"
```

---

### Task 6: Wire Up — Admin Manual Assign & Edit

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts`

**Step 1: Add cascade after manual assign_yurt action**

After the `assign_yurt` handler updates the reservation and logs activity (~line 608), before the notification timing block, add:

```typescript
// Cascade: manual assignment may unlock other pending reservations
void tryDeterministicAssignment(new Date(reservation.date));
```

**Step 2: Add re-assignment after admin edit action**

In the `edit` action handler, after the update completes (~line 735), add:

```typescript
// Re-run assignment for affected date(s)
void tryDeterministicAssignment(new Date(updated.date));
if (dateChanged) {
  void tryDeterministicAssignment(new Date(reservation.date)); // old date too
}
```

**Step 3: Update reschedule handler**

In the reschedule action (~line 458), replace T-3 check with:

```typescript
// Re-run deterministic assignment for both old and new dates
void tryDeterministicAssignment(new Date(reservation.date)); // old date
void tryDeterministicAssignment(newReservationDate); // new date
```

Remove the old `checkDateAnomalies` calls and T-3 conditional.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/app/api/reservations/[id]/route.ts
git commit -m "feat: trigger deterministic assignment on admin assign/edit/reschedule"
```

---

### Task 7: Update Cron Job — T-3 → T-7

**Files:**
- Modify: `src/app/api/cron/assign-yurts/route.ts`

**Step 1: Change target date offset from +3 to +7**

Line 22: change `targetDate.setUTCDate(targetDate.getUTCDate() + 3)` to:

```typescript
targetDate.setUTCDate(targetDate.getUTCDate() + 7);
```

Update the comment on line 18:
```typescript
// Target date = today + 7 days in America/New_York timezone
```

**Step 2: Commit**

```bash
git add src/app/api/cron/assign-yurts/route.ts
git commit -m "feat: change cron assignment deadline from T-3 to T-7"
```

---

### Task 8: Run Full Test Suite & Manual Verification

**Step 1: Run unit tests**

```bash
npx jest --no-cache
```
Expected: ALL PASS

**Step 2: TypeScript compile check**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Manual test via dev server**

1. Start dev server: `npm run dev`
2. Create a 26-person reservation → should auto-assign to #1
3. Create a 15-person reservation for same date → should auto-assign to #3
4. Create a 20-person reservation for same date → should auto-assign to #2 (cascade: only room left)
5. Cancel the 26-person reservation → #1 freed, verify no reassignment of existing
6. Create a 20-person reservation alone on new date → should be pending

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

**Step 5: Push to GitHub**

```bash
git push origin main
```
