# Dynamic Yurt Allocation + Inquiry-Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make yurt assignment continuously self-adjusting (any non-`manuallyAssigned` row can shift when the date's reservation set changes) and let the customer booking page route directly to the inquiry form when a requested party can't fit on any yurt for the chosen date.

**Architecture:**
- Promote `computeDeterministicAssignment` (already pure) to be the single source of truth for both *assignment* and *availability*. A new `computeAvailabilityProbe` wrapper answers "if a hypothetical guest count N is added to date D, does the day still have a feasible solution?" by appending the hypothetical row and re-running the algorithm.
- Replace Phase 1b's FIFO "≤16 → #3" with **smallest-party-first** to leave headroom for the typical mid-size guest who arrives later.
- Wire `tryDeterministicAssignment(date)` into the reservation **cancel** and **count-change** paths (it already runs on create + swap + cron); now any change re-optimizes that date.
- Customer date+guest selection on `/booking/date` calls a new `/api/availability/check` and, on `canFit=false`, navigates to `/inquiries/new` with date+guests prefilled.

**Tech Stack:** Next.js App Router + Prisma + TypeScript + Jest (unit) + manual Playwright smoke for the customer flow.

**Out of scope:**
- Changing the `manuallyAssigned` lock UI (already exists; leave alone).
- Notifications when an auto-assigned row's yurt shifts (customers don't see yurt # in customer-facing UI today).
- Backfilling historical reservations to the new Phase 1b layout (production data is light enough that the cron + new-booking trigger will sort itself).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/yurt-assignment-pure.ts` | Pure algorithm. **Modify Phase 1b**, **add `computeAvailabilityProbe`** export. |
| `src/lib/__tests__/yurt-assignment.test.ts` | Existing algorithm unit tests. **Update boundary tests** for Phase 1b. |
| `src/lib/__tests__/availability-probe.test.ts` | **NEW** unit tests for `computeAvailabilityProbe`. |
| `src/lib/yurt-assignment.ts` | Server-side wrapper (`tryDeterministicAssignment`, `getActiveReservationsFull`). **Add `checkAvailabilityForDate(date, guests)` server helper.** |
| `src/app/api/availability/check/route.ts` | **NEW** GET endpoint, params `?date=YYYY-MM-DD&guests=N`, returns `{canFit, hypotheticalYurt?, allYurtsFullForCount, anomalyReason?}`. |
| `src/app/api/reservations/[id]/route.ts` | **Modify** — call `tryDeterministicAssignment` after PATCH that changes guestCount and after DELETE/cancel. |
| `src/app/(customer)/booking/date/page.tsx` | **Modify** — when user picks date+guests, call `/api/availability/check`; if `!canFit`, route to `/inquiries/new?date=…&guests=…`. |
| `src/app/(customer)/inquiries/new/page.tsx` | **Modify** — read `date` and `guests` query params, prefill the form. |
| `docs/plans/2026-04-29-dynamic-yurt-allocation-progress.md` | **NEW** — progress log appended as tasks finish. |

---

## Task 1: Phase 1b — replace FIFO with smallest-party-first

Currently when multiple ≤16-seat parties show up on the same date, whoever the algorithm sees first (insertion order from the DB query, which is `createdAt ASC`) takes #3. That fills the smallest room with potentially the largest of the small parties, wasting headroom. Replace with: among the parties left after Phase 1a that fit #3, **assign the smallest** to #3.

**Files:**
- Modify: `src/lib/yurt-assignment-pure.ts:217-230`
- Modify: `src/lib/__tests__/yurt-assignment.test.ts:80-92` and `:124-135`

- [ ] **Step 1: Update test #5 (FIFO assumption)**

The test currently asserts "20+20 → first→#1, second→#2" via FIFO. With smallest-first Phase 1b, this test still passes (Phase 1b only triggers for ≤16 and 20>16, so this test is in Phase 3 territory — keep as-is). **Action: read the test, confirm it still expects the same outcome under the new rule. No edit.**

- [ ] **Step 2: Add a new test capturing the new Phase 1b behavior**

Append to `src/lib/__tests__/yurt-assignment.test.ts` before the closing `});` of the top-level `describe`:

```typescript
  // 1b smallest-first: 16 + 8 → 8 takes #3, 16 stays pending (or cascades to #2)
  it('Phase 1b: smallest party (8) wins #3 over larger party (16)', () => {
    const res = [
      makeRes('A', 16, { createdAt: new Date('2026-04-20T08:00:00Z') }),
      makeRes('B', 8, { createdAt: new Date('2026-04-20T09:00:00Z') }),
    ];
    const result = computeDeterministicAssignment(YURTS, res);

    expect(findAssignment(result, 'B')?.yurtId).toBe('yurt-3');
    // A=16 fits #1 or #2 — single pending row with 2 candidates → ambiguous
    expect(result.pending).toContain('A');
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts -t "smallest party"`
Expected: **FAIL** — current FIFO logic assigns A (16) → #3 because A is earlier in `unassigned`.

- [ ] **Step 4: Update Phase 1b to smallest-first**

Replace `src/lib/yurt-assignment-pure.ts:217-230` with:

```typescript
  // Phase 1b: Smallest-room optimization — pick the smallest pending party
  // that still fits #3, not the FIFO-first one. Leaves headroom for
  // mid-sized parties to land in #2 instead of crowding #3 to capacity.
  const smallestRoom = sortedYurtsAsc[0];
  const afterPhase1: DeterministicReservationInput[] = [...afterPhase1a];
  if (smallestRoom && !usedYurtIds.has(smallestRoom.id)) {
    const fitsSmallest = afterPhase1
      .map((res, idx) => ({ res, idx }))
      .filter(({ res }) => res.guestCount <= smallestRoom.capacity);
    if (fitsSmallest.length > 0) {
      // Pick smallest guestCount; on tie, FIFO (createdAt ASC).
      fitsSmallest.sort((a, b) => {
        if (a.res.guestCount !== b.res.guestCount) {
          return a.res.guestCount - b.res.guestCount;
        }
        return a.res.createdAt.getTime() - b.res.createdAt.getTime();
      });
      const winner = fitsSmallest[0];
      assignRes(winner.res, smallestRoom);
      afterPhase1.splice(winner.idx, 1);
    }
  }
```

- [ ] **Step 5: Run the new test**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts -t "smallest party"`
Expected: **PASS**.

- [ ] **Step 6: Run the full algorithm test file**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts`
Expected: **all 16 tests pass** (15 existing + 1 new).

If any existing test breaks, the most likely culprit is a `(15+12) → 15 wins #3 by FIFO` assumption. Read the test, decide whether the new outcome is actually correct (it almost always is), and update the assertion. **Do not regress to FIFO** — the smallest-first rule is the user's intent.

- [ ] **Step 7: Commit**

```bash
git add src/lib/yurt-assignment-pure.ts src/lib/__tests__/yurt-assignment.test.ts
git commit -m "feat(yurt-assignment): Phase 1b prefers smallest party for #3

Previously the first ≤16 party in FIFO order won room #3. With multiple
≤16 parties on a date, this could pack the smallest room while leaving
mid-sized parties pending. Switch to: smallest party fits #3 first; on
tie, FIFO. Leaves more headroom for typical mid-size walk-ups.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `computeAvailabilityProbe` pure function

A function that answers "would adding a hypothetical guest count N to date D's existing reservation set produce a feasible solution?" by running the algorithm with the hypothetical row appended and inspecting the result.

**Files:**
- Modify: `src/lib/yurt-assignment-pure.ts` (add export at end)
- Create: `src/lib/__tests__/availability-probe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/availability-probe.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/__tests__/availability-probe.test.ts`
Expected: **FAIL** — `computeAvailabilityProbe` does not exist.

- [ ] **Step 3: Implement `computeAvailabilityProbe`**

Append to `src/lib/yurt-assignment-pure.ts`:

```typescript
// ─── Availability Probe ─────────────────────────────────────────────

export interface AvailabilityProbeResult {
  /** True iff the hypothetical party can be placed on the date. */
  canFit: boolean;
  /**
   * If canFit, which yurt would the hypothetical party land in under
   * the algorithm's current solution? Null when canFit but the row
   * stayed pending (ambiguous between two rooms).
   */
  hypotheticalYurtId: string | null;
  /**
   * Convenience flag for callers that want a simple "all full" yes/no.
   * True iff the hypothetical row produced an anomaly OR
   *         every yurt is taken AND none of the existing rows can shift.
   */
  allYurtsFullForCount: boolean;
  /** When canFit=false, why? */
  anomalyReason?: 'exceeds_max_capacity' | 'no_yurt_available';
}

/**
 * Probe: would adding a hypothetical reservation of `guestCount` to the
 * existing set on a given date produce a feasible solution?
 *
 * Implementation: append a synthetic row with a special id, run the
 * standard deterministic algorithm, inspect whether the synthetic row
 * landed in `assignments` (canFit) or in `anomalies` (does not fit).
 *
 * Manually-assigned existing rows stay pinned (per Phase 0); the
 * algorithm can reshuffle non-manual existing rows to make room.
 */
export function computeAvailabilityProbe(
  availableYurts: YurtInput[],
  existingReservations: DeterministicReservationInput[],
  hypotheticalGuestCount: number,
): AvailabilityProbeResult {
  const HYPOTHETICAL_ID = '__probe__';
  // Newest createdAt so it loses every FIFO tiebreak — we never want
  // the probe to evict an existing customer's natural placement.
  const hypothetical: DeterministicReservationInput = {
    id: HYPOTHETICAL_ID,
    guestCount: hypotheticalGuestCount,
    yurtId: null,
    manuallyAssigned: false,
    createdAt: new Date(8640000000000000),
  };

  const result = computeDeterministicAssignment(availableYurts, [
    ...existingReservations,
    hypothetical,
  ]);

  const probeAssignment = result.assignments.find(
    (a) => a.reservationId === HYPOTHETICAL_ID,
  );
  if (probeAssignment) {
    return {
      canFit: true,
      hypotheticalYurtId: probeAssignment.yurtId,
      allYurtsFullForCount: false,
    };
  }

  const probeAnomaly = result.anomalies.find(
    (a) => a.reservationId === HYPOTHETICAL_ID,
  );
  if (probeAnomaly) {
    return {
      canFit: false,
      hypotheticalYurtId: null,
      allYurtsFullForCount: true,
      anomalyReason: probeAnomaly.reason,
    };
  }

  // Probe is in `pending` — fits in capacity terms but the algorithm
  // couldn't disambiguate. We treat that as canFit=true, no specific
  // room.
  return {
    canFit: true,
    hypotheticalYurtId: null,
    allYurtsFullForCount: false,
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx jest src/lib/__tests__/availability-probe.test.ts`
Expected: **all 7 tests PASS**.

- [ ] **Step 5: Commit**

```bash
git add src/lib/yurt-assignment-pure.ts src/lib/__tests__/availability-probe.test.ts
git commit -m "feat(yurt-assignment): add computeAvailabilityProbe for date-level feasibility

Wraps the existing deterministic algorithm with a hypothetical-row probe.
Used by the availability API to answer 'can guest count N fit on date D?'
without having to re-implement the seat math separately. Respects
manuallyAssigned existing rows as immovable walls.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Server helper + `/api/availability/check` endpoint

A thin server wrapper that loads the date's existing reservations and active yurts, then calls `computeAvailabilityProbe`. A new App Router GET endpoint exposes it.

**Files:**
- Modify: `src/lib/yurt-assignment.ts` (add `checkAvailabilityForDate`)
- Create: `src/app/api/availability/check/route.ts`

- [ ] **Step 1: Read `src/lib/yurt-assignment.ts` to find `getActiveReservationsFull` and the active-yurts loader**

Run: `grep -n "getActiveReservationsFull\|activeYurts\|prisma.yurt.findMany" src/lib/yurt-assignment.ts`

Expected: locate the existing helpers. The new wrapper will reuse them.

- [ ] **Step 2: Add `checkAvailabilityForDate` to `src/lib/yurt-assignment.ts`**

Append (after the existing exports):

```typescript
import {
  computeAvailabilityProbe,
  type AvailabilityProbeResult,
} from "./yurt-assignment-pure";

/**
 * Server-side wrapper: load active yurts + non-cancelled reservations
 * for `date`, ask the pure probe whether a new party of `guestCount`
 * can fit. Used by /api/availability/check.
 */
export async function checkAvailabilityForDate(
  date: Date,
  guestCount: number,
): Promise<AvailabilityProbeResult> {
  const yurts = await getActiveYurts(); // existing helper — adapt name if different
  const existing = await getActiveReservationsFull(date);
  return computeAvailabilityProbe(
    yurts.map((y) => ({ id: y.id, name: y.name, capacity: y.capacity })),
    existing.map((r) => ({
      id: r.id,
      guestCount: r.guestCount,
      yurtId: r.yurtId,
      manuallyAssigned: r.manuallyAssigned,
      createdAt: r.createdAt,
    })),
    guestCount,
  );
}
```

If the active-yurts helper has a different name (e.g. `loadActiveYurts`), adjust the call. If there is no helper, inline a `prisma.yurt.findMany({ where: { status: "ACTIVE" } })` call.

- [ ] **Step 3: Create the route file**

Create `src/app/api/availability/check/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { checkAvailabilityForDate } from "@/lib/yurt-assignment";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const guestsStr = searchParams.get("guests");

  if (!dateStr || !ISO_DATE.test(dateStr)) {
    return NextResponse.json(
      { error: "missing_or_invalid_date", expected: "YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const guestCount = guestsStr ? parseInt(guestsStr, 10) : NaN;
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 200) {
    return NextResponse.json(
      { error: "missing_or_invalid_guests", expected: "integer 1-200" },
      { status: 400 },
    );
  }

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const probe = await checkAvailabilityForDate(date, guestCount);
  return NextResponse.json({
    date: dateStr,
    guests: guestCount,
    canFit: probe.canFit,
    hypotheticalYurtId: probe.hypotheticalYurtId,
    allYurtsFullForCount: probe.allYurtsFullForCount,
    anomalyReason: probe.anomalyReason ?? null,
    /** UI hint: should the booking flow redirect to /inquiries/new? */
    shouldInquire: !probe.canFit,
  });
}
```

- [ ] **Step 4: Smoke-test the endpoint locally**

Start the dev server in another terminal, then:

```bash
curl -s "http://localhost:3000/api/availability/check?date=2026-12-01&guests=20" | jq .
```

Expected output (on a date with no reservations):
```json
{
  "date": "2026-12-01",
  "guests": 20,
  "canFit": true,
  "hypotheticalYurtId": null,
  "allYurtsFullForCount": false,
  "anomalyReason": null,
  "shouldInquire": false
}
```

Then test invalid params:

```bash
curl -s "http://localhost:3000/api/availability/check?date=bogus&guests=20" | jq .
curl -s "http://localhost:3000/api/availability/check?date=2026-12-01&guests=0" | jq .
```

Both should return `400` with a validation error.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/yurt-assignment.ts src/app/api/availability/check/route.ts
git commit -m "feat(availability): GET /api/availability/check endpoint

Returns canFit + shouldInquire flags so the customer booking flow can
route to the inquiry form when no yurt fits the requested party on the
chosen date. Built on the new computeAvailabilityProbe pure function.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Re-run allocation when a reservation changes count or is cancelled (with T-7 freeze guard)

`tryDeterministicAssignment(date)` already runs on reservation create + admin swap + T-7 cron. Two paths still skip it:

1. **PATCH** `src/app/api/reservations/[id]/route.ts` when `guestCount` changes — the row's yurt may no longer be optimal, and other rows on the date may now have a better fit.
2. **DELETE / cancel** path — when a row leaves, the algorithm should re-run so any remaining rows that were "pending" can claim the freed yurt.

**T-7 freeze rule (existing business logic):** Reservations on dates within 7 days are locked — customers cannot modify, only cancel (no refund). The T-7 cron is the **last** auto-pass; after that, operations have prepared seating/food per the assigned yurts and any further re-shuffle would break ops. We therefore add a freeze guard so re-allocation skips dates within 7 days. Cancellations within T-7 leave the empty yurt slot in place; admin can manually fill if needed.

**Files:**
- Modify: `src/lib/yurt-assignment.ts` (add `isWithinFreeze` helper, guard `tryDeterministicAssignment`)
- Modify: `src/lib/__tests__/yurt-assignment.test.ts` or a new test for the wrapper (the freeze is on the wrapper, not the pure algorithm)
- Modify: `src/app/api/reservations/[id]/route.ts`

- [ ] **Step 1: Add `isWithinFreeze` and guard `tryDeterministicAssignment`**

In `src/lib/yurt-assignment.ts`, add:

```typescript
/**
 * Reservations on dates within 7 days are locked: customers can't modify,
 * deposits aren't refunded on cancel, and operations have already prepared
 * for the current yurt allocation. Re-allocation must therefore skip these
 * dates — the T-7 cron is the last auto-pass.
 */
export function isWithinFreeze(date: Date, now: Date = new Date()): boolean {
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setHours(0, 0, 0, 0);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target.getTime() <= sevenDaysFromNow.getTime();
}
```

Then locate `tryDeterministicAssignment` (likely near the top of the same file) and add the guard as the first thing it does:

```typescript
export async function tryDeterministicAssignment(date: Date): Promise<void> {
  if (isWithinFreeze(date)) {
    return; // T-7 freeze: ops have prepared, do not auto-shuffle.
  }
  // ... existing body unchanged
}
```

- [ ] **Step 2: Add a unit test for `isWithinFreeze`**

Create `src/lib/__tests__/freeze-guard.test.ts` (or append to an existing wrapper test file):

```typescript
import { isWithinFreeze } from '../yurt-assignment';

describe('isWithinFreeze', () => {
  const now = new Date('2026-04-29T12:00:00Z');

  it('today → within freeze', () => {
    expect(isWithinFreeze(new Date('2026-04-29T00:00:00Z'), now)).toBe(true);
  });
  it('tomorrow → within freeze', () => {
    expect(isWithinFreeze(new Date('2026-04-30T00:00:00Z'), now)).toBe(true);
  });
  it('exactly 7 days out → within freeze', () => {
    expect(isWithinFreeze(new Date('2026-05-06T00:00:00Z'), now)).toBe(true);
  });
  it('8 days out → past freeze', () => {
    expect(isWithinFreeze(new Date('2026-05-07T00:00:00Z'), now)).toBe(false);
  });
  it('far future → past freeze', () => {
    expect(isWithinFreeze(new Date('2027-01-01T00:00:00Z'), now)).toBe(false);
  });
});
```

Run: `npx jest src/lib/__tests__/freeze-guard.test.ts`
Expected: 5 passing.

- [ ] **Step 3: Locate the PATCH handler**

Run: `grep -n "export async function PATCH\|guestCount" src/app/api/reservations/[id]/route.ts | head -20`

Expected: find the PATCH handler and the line that updates `guestCount`.

- [ ] **Step 4: Add re-allocation after PATCH that changes count**

In the PATCH handler, after the update writes succeed and **before** the response is built, if either `guestCount` or `date` changed, call:

```typescript
import { tryDeterministicAssignment } from "@/lib/yurt-assignment";

// ... inside the handler, after the `prisma.reservation.update(...)` call:
if (guestCountChanged || dateChanged) {
  // Re-run for the new date (and the old one, if it changed).
  await tryDeterministicAssignment(updated.date);
  if (dateChanged && oldDate.getTime() !== updated.date.getTime()) {
    await tryDeterministicAssignment(oldDate);
  }
}
```

Adapt variable names (`guestCountChanged`, `dateChanged`, `oldDate`, `updated`) to whatever the existing handler uses; if it doesn't track these, derive them from `body` and the row read before the update. The freeze guard inside `tryDeterministicAssignment` (Step 1) means it's safe to call for any date — within-T-7 dates simply no-op.

- [ ] **Step 5: Locate the DELETE / cancel path**

Run: `grep -n "DELETE\|cancel\|status.*CANCELLED" src/app/api/reservations/[id]/route.ts | head -10`

Expected: find where reservations transition to `CANCELLED` (via DELETE or via PATCH that sets status). It might be either; both are valid.

- [ ] **Step 6: Add re-allocation after cancellation**

After the cancel write commits, call `tryDeterministicAssignment(reservation.date)` for the date the cancelled reservation was on. This frees its yurt and may unblock a pending row. (Within T-7, the freeze guard makes this a no-op — the empty yurt slot stays empty, which is the desired ops behavior.)

- [ ] **Step 7: Add a regression test**

Find or create `src/app/api/reservations/[id]/__tests__/route.test.ts`. Add:

```typescript
it("re-runs allocation after guestCount change (outside T-7)", async () => {
  // Setup: date D > 7 days out, has res A (16, → #3 by Phase 1b) and res
  // B (20, pending). Action: PATCH A to guestCount=8.
  // Expect: tryDeterministicAssignment was called for D; A still in #3,
  // B still pending (no Phase 1b change for B). Verify via spy or
  // ActivityLog.
});

it("does NOT re-run allocation when date is within T-7", async () => {
  // Setup: date D = today + 3 days (within freeze). Existing res with
  // yurtId set. Action: PATCH guestCount.
  // Expect: tryDeterministicAssignment is invoked but no-ops; existing
  // yurtId unchanged.
});
```

If the existing test infra doesn't support DB integration tests easily, instead verify by manual smoke: start dev server, create two reservations on the same future date (>14 days out so T-7 doesn't apply), PATCH one's `guestCount`, and check the database that yurt assignments updated.

- [ ] **Step 8: Type-check + run targeted tests**

Run: `npx tsc --noEmit && npx jest src/lib/__tests__/freeze-guard.test.ts && npx jest src/app/api/reservations`
Expected: clean + tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/yurt-assignment.ts src/lib/__tests__/freeze-guard.test.ts src/app/api/reservations/[id]/route.ts
git commit -m "feat(reservations): re-allocate yurts after PATCH/cancel; T-7 freeze guard

Closes the gap where reservation edits and cancellations didn't re-run
the deterministic assigner, leaving non-manual rows in stale yurt slots
and freed yurts unclaimed by pending rows on the same date.

Adds an isWithinFreeze() guard so re-allocation skips dates ≤ 7 days
out — T-7 is the existing customer-modification freeze and operations
have already prepared seating/food per the current allocation by then.
The T-7 cron remains the last auto-pass; after that, only admin manual
yurt edits change anything.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Customer booking page → inquiry redirect when no fit

The customer date picker (`/booking/date`) currently disables fully-booked dates with no escape hatch. Wire it to `/api/availability/check` so that when the user picks a date+guest combination that cannot fit any yurt, they're routed to the inquiry form with the date and guest count prefilled.

**Files:**
- Modify: `src/app/(customer)/booking/date/page.tsx`
- Modify: `src/app/(customer)/inquiries/new/page.tsx`

- [ ] **Step 1: Read the current date page to find the "select date + guests → continue" handler**

Run: `grep -n "router.push\|onClick\|onSubmit\|guestCount\|handleContinue" src/app/(customer)/booking/date/page.tsx | head -20`

Expected: locate the function that fires when the user has chosen a valid date + party size and clicks "continue" or equivalent.

- [ ] **Step 2: Replace the continue handler with an availability probe**

Inside that handler, before the existing navigation:

```typescript
const probe = await fetch(
  `/api/availability/check?date=${selectedDateIso}&guests=${guestCount}`,
).then((r) => r.json());

if (probe.shouldInquire) {
  // No yurt fits this party on this date — route to inquiry with prefill.
  router.push(
    `/inquiries/new?date=${selectedDateIso}&guests=${guestCount}&from=booking`,
  );
  return;
}

// Otherwise fall through to the existing "go to package selection" navigation.
```

- [ ] **Step 3: Read the inquiry new page to find the form's initial values**

Run: `grep -n "preferredDate\|guestCount\|defaultValue\|initialValues\|searchParams" src/app/(customer)/inquiries/new/page.tsx | head -20`

Expected: locate the form scaffold.

- [ ] **Step 4: Read query params and prefill**

Add at the top of the page component:

```typescript
import { useSearchParams } from "next/navigation";

// inside the component:
const sp = useSearchParams();
const prefillDate = sp.get("date") ?? "";
const prefillGuests = sp.get("guests") ?? "";
const fromBooking = sp.get("from") === "booking";
```

Pass `prefillDate` and `prefillGuests` into the form's default values. If the form is a controlled component, set initial state from the params.

If `fromBooking` is true, render a small note above the form, e.g. "我们这一天已经满了 / 联系咨询" (i18n keys to be added in the relevant `messages/*.json`).

- [ ] **Step 5: Manual smoke test (Playwright MCP or browser)**

1. Start dev server.
2. Navigate to `/booking/date` as a logged-out user.
3. Pick a date that has 3 reservations totaling all yurts (use an admin-created fixture). Set guests to a number that won't fit.
4. Click continue.
5. **Expected:** redirected to `/inquiries/new?date=…&guests=…&from=booking` with the form prefilled and the "we're full" note visible.

6. Now pick an empty date with reasonable guests.
7. Click continue.
8. **Expected:** existing "go to package selection" flow continues — no redirect.

- [ ] **Step 6: Type-check + i18n parity**

Run: `npx tsc --noEmit && npm run i18n:check` (or whatever the project's i18n parity script is — check `package.json` scripts).
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/(customer)/booking/date/page.tsx src/app/(customer)/inquiries/new/page.tsx
# also add the i18n message files if you touched them
git commit -m "feat(booking): route to inquiry form when no yurt fits the party

Customer date+guest selection now probes /api/availability/check before
navigating to package selection. If no yurt can hold the party on that
date (after considering possible reshuffles of non-manual existing
reservations), the user is redirected to /inquiries/new with the date
and guest count prefilled, plus a 'we're full, please inquire' note.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Final verification + progress doc

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (or `npx jest`)
Expected: all tests pass, no new failures.

- [ ] **Step 2: Run i18n parity, typecheck, lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Manual end-to-end check**

Browser (or Playwright MCP):
1. Logged-out customer → `/booking/date` → empty date + 20 guests → "continue" → goes to package picker (✓).
2. Admin: create 3 reservations on a date that fill all yurts → log out → as customer, pick that date + any guest count → "continue" → goes to `/inquiries/new` with prefills (✓).
3. Admin: cancel one of those 3 reservations → re-pick the same date as customer → "continue" → goes to package picker again (✓ — re-allocation freed the yurt).
4. Admin: PATCH one reservation's guest count from 12 to 28 → check the date's reservation list → other auto-assigned rows shifted as needed (✓).

- [ ] **Step 4: Write the progress doc**

Create `docs/plans/2026-04-29-dynamic-yurt-allocation-progress.md` summarizing:
- Date completed.
- Tasks 1-6 with brief outcome (commit hashes).
- Any deviations from the plan (e.g., `tryDeterministicAssignment` already ran on cancel — Task 4 became a no-op).
- Anything punted (e.g., notification when an auto-assigned customer's yurt shifts post-confirmation — out of scope, file under "v2 considerations").

- [ ] **Step 5: Final commit**

```bash
git add docs/plans/2026-04-29-dynamic-yurt-allocation-progress.md
git commit -m "docs(plans): wrap up dynamic-yurt-allocation progress log

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Risks & Notes for the Implementer

1. **Phase 3 sort still uses createdAt.** The new Phase 1b is smallest-first, but Phase 3 (group determinism for ambiguous mid-sized parties) still falls back to createdAt-ASC for ties. That's intentional — within a group of equally-sized parties, FIFO is the fair tiebreak. Don't "fix" Phase 3 unless asked.

2. **The probe inserts a synthetic row with createdAt=Infinity.** This is so the probe never displaces an existing customer in any FIFO tiebreak. If the algorithm ever introduces a "newest goes first" rule, revisit this constant.

3. **Re-allocation on cancel may produce visible yurt shuffles.** A pending row that was waiting now grabs the freed yurt. That's the desired behavior. If a customer-facing surface shows yurt #s (currently it doesn't), this could surprise users. If the product later decides to show yurt #s, freeze auto-shuffles within e.g. 24h of the date.

4. **The algorithm runs synchronously in the request path.** It's pure and fast (≤3 yurts, ≤a few rows per date) so this is fine. If yurts ever grow to dozens, push to a background job.

5. **No new DB columns.** Everything reuses existing `yurtId` + `manuallyAssigned` + the algorithm. If the implementer is tempted to add a `lastAllocatedAt` or similar, push back — the algorithm is idempotent and the cron is the safety net.
