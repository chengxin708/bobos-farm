# Auto Room Assignment Design

## Date: 2026-04-15

## Core Principle

**Don't let small groups occupy large room resources.** Large rooms should be reserved for larger groups. Assign immediately only when the outcome is certain; otherwise wait until it becomes certain or T-7 forces it.

## Room Configuration

| Room | Capacity | Alias |
|------|----------|-------|
| #1   | 28       | 大    |
| #2   | 24       | 中    |
| #3   | 16       | 小    |

## Assignment Algorithm (4 phases)

Runs after every booking change for the affected date(s).

### Phase 1: Immediate Deterministic (capacity-forced)

| Guest Count | Action | Reason |
|-------------|--------|--------|
| 25-28 | Assign #1 | Only room that fits |
| ≤16 AND #3 available | Assign #3 | Smallest room, always the correct choice |
| ≤16 but #3 occupied | → pending | Ambiguous: could be #2 or #1 |
| 17-24 | → pending | Ambiguous: could be #2 or #1, save big room for big groups |

### Phase 2: Single-Candidate Propagation (cascade)

Iteratively check pending reservations. If a pending reservation has exactly 1 remaining valid room (capacity fits + not occupied), assign it. Repeat until stable.

```
loop:
  changed = false
  for each pending reservation on this date:
    candidates = rooms where capacity >= guestCount AND not occupied
    if candidates.length == 1 → assign to that room, changed = true
    if candidates.length == 0 → mark anomaly
  if !changed → break
```

Example: A=25→#1 (Phase 1), then B=20 pending. B's candidates = {#2} (#1 taken, #3 too small) → single candidate → assign #2.

### Phase 3: Group Determinism (N pending == N rooms)

After Phase 2, if the count of remaining pending reservations equals the count of available rooms that can fit them, all assignments are forced — every room will be used.

Assign in FIFO order (first booked → largest room).

```
pending = remaining pending reservations, sorted by createdAt ASC
candidateRooms = rooms where capacity >= min(pending guestCounts) AND not occupied
if pending.length > 0 AND pending.length == candidateRooms.length:
  sort candidateRooms by capacity DESC
  for i in range(pending.length):
    assign pending[i] → candidateRooms[i]  // first arrival → biggest room
```

Example: A=20(first), B=18(second). Both pending, candidates = {#2, #1}. 2 pending == 2 rooms → forced. A→#1, B→#2.

### Phase 4: T-7 Fallback

7 days before the reservation date, a daily cron job force-assigns all remaining pending reservations using BFD (Best-Fit Decreasing). If any still cannot be assigned, notify admin for manual intervention.

### Admin Override

Admin can manually assign any room at any time. Manual assignments are treated as locked and preserved by Phases 2-3 (they reduce the available room pool but are never reassigned).

Already-assigned reservations are never reassigned by the algorithm. Only admin can move a reservation to a different room.

## Trigger Points

| Event | Triggered By | Action |
|-------|-------------|--------|
| New reservation created | Customer / Admin | Run Phases 1-3 for that date |
| Reservation cancelled | Customer / Admin | Release room → run Phases 1-3 |
| Reservation expired (payment timeout) | System | Release room → run Phases 1-3 |
| Admin modifies guest count or date | Admin | Release old assignment → run Phases 1-3 for both old and new date |
| Admin manual room assignment | Admin | Lock assignment → run Phases 2-3 for cascade |
| T-7 daily cron | System | Phase 4: BFD force-assign, notify admin of anomalies |

## Booking Validation

When a customer books, simulate whether the date can accommodate the new group:

```
function canBook(date, guestCount):
  rooms = available rooms for date (active + not closed)
  existing = all active reservations on date (assigned + pending)
  plan = BFD(rooms, existing + virtual(guestCount))
  return plan.anomalies.length == 0
```

Effect: if #1 is occupied by a 26-person group, max bookable becomes 24. If #1 and #3 are occupied, max bookable is 24 (#2 only). If all occupied, date is full.

## Scenario Walkthrough

### Single reservation

| Arrival | Process | Result |
|---------|---------|--------|
| A=25 | Phase 1: 25-28 → #1 | A=#1 |
| A=15 | Phase 1: ≤16, #3 open → #3 | A=#3 |
| A=20 | Phase 1: 17-24 → pending | A=pending |

### Two reservations (order matters)

| Arrival Order | Process | Result |
|--------------|---------|--------|
| A=25, then B=20 | A→#1 (Ph1), B candidates={#2} → B→#2 (Ph2) | A=#1, B=#2 |
| B=20, then A=25 | B pending, A→#1 (Ph1), cascade B→#2 (Ph2) | A=#1, B=#2 |
| A=20, then B=20 | Both pending (Ph1-2 skip), Ph3: 2==2 → A→#1, B→#2 | A=#1, B=#2 |
| A=20, then B=18 | Both pending, Ph3: 2==2 → A→#1, B→#2 | A=#1, B=#2 |
| B=20 alone, then A=25 later | B pending → A→#1 → cascade B→#2 | A=#1, B=#2 |
| A=15, then B=20 | A→#3 (Ph1), B pending (Ph2-3: 1 pending, 2 rooms → skip) | A=#3, B=pending |

### Three reservations

| Arrival Order | Process | Result |
|--------------|---------|--------|
| A=15, B=20, C=25 | A→#3, C→#1, cascade B→#2 | A=#3, C=#1, B=#2 |
| A=15, B=20, C=18 | A→#3, B+C pending, Ph3: 2==2 → B→#1, C→#2 | A=#3, B=#1, C=#2 |
| A=25, B=15, C=20 | A→#1, B→#3, C candidates={#2} → C→#2 | A=#1, B=#3, C=#2 |
| A=20, B=18, C=22 | All >16, all pending, only 2 rooms fit → anomaly (caught at booking time) | C rejected |

### Cancellation

| Scenario | Process |
|----------|---------|
| A=25(#1), B=20(#2). A cancels. | #1 released. B stays in #2 (already assigned, not reassigned). |
| A=25(#1), B=20(pending). A cancels. | #1 released. Re-run: B candidates={#2,#1} → 2 → stays pending. |
| A=15(#3), B=20(pending), C=18(pending). B cancels. | C alone pending, candidates={#2,#1} → 2 → stays pending. |
| Full day (3 assigned). C cancels. | Room released. New bookings now possible on this date. |

## Key Dates

- **T-7**: Auto-assignment deadline (BFD fallback) + cancellation refund deadline
- **T-2**: Customer notification email with room assignment sent
- Customer can only cancel, not modify (cancel + rebook)
- Admin can modify guest count and date at any time

## Timeline

```
Booking ────────────────── T-7 ──────────── T-2 ──────── Event
  │                         │                │
  └ Phases 1-3              └ Phase 4        └ Email
    assign if certain         BFD fallback     notify customer
    or pending                anomaly →        room number
                              admin alert
```

## Files to Change

| File | Change |
|------|--------|
| `src/lib/yurt-assignment.ts` | New `tryDeterministicAssignment()` with Phases 1-3. Keep existing `computeBestFitDecreasing()` for Phase 4 and validation. |
| `src/app/api/reservations/route.ts` | After creation: call `tryDeterministicAssignment(date)` |
| `src/app/api/reservations/[id]/route.ts` | After cancel/modify/manual-assign: call `tryDeterministicAssignment(date)` |
| `src/app/api/cron/assign-yurts/route.ts` | Change from T-3 to T-7 |
| Booking UI (date/guest count picker) | Show dynamic max capacity per date via `simulateWithNewReservation()` |
