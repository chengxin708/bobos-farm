# Auto Room Assignment Design

## Date: 2026-04-15

## Core Principle

**Don't let small groups occupy large room resources.** Large rooms should be reserved for larger groups. Assign immediately only when the assignment is certain; otherwise wait.

## Room Configuration

| Room | Capacity | Alias |
|------|----------|-------|
| #1   | 28       | 大    |
| #2   | 24       | 中    |
| #3   | 16       | 小    |

## Assignment Rules

### Immediate Assignment (deterministic by capacity)

| Guest Count | Action | Reason |
|-------------|--------|--------|
| 25-28       | Assign #1 immediately | Only #1 fits, no ambiguity |
| ≤16 AND #3 available | Assign #3 immediately | Smallest room, always correct choice |

### Pending (ambiguous)

| Guest Count | Action | Reason |
|-------------|--------|--------|
| 17-24       | Always pending initially | Could be #2 or #1, don't waste big room |
| ≤16 but #3 occupied | Pending | Could be #2 or #1, depends on other bookings |

### Constraint Propagation (cascade)

After every assignment, iterate over all pending reservations for that date:

```
loop:
  for each pending reservation:
    candidates = rooms where capacity >= guestCount AND not occupied
    if candidates == 1 → assign, mark changed
    if candidates == 0 → anomaly
  if no changes → break
```

This handles cascading: assigning one room may force another pending reservation into its only remaining option.

### T-7 Fallback

7 days before the reservation date, BFD (Best-Fit Decreasing) force-assigns all remaining pending reservations. If any cannot be assigned, notify admin for manual intervention.

### Admin Override

Admin can manually assign any room at any time. Manual assignments are preserved by constraint propagation (treated as locked).

## Trigger Points

| Event | Triggered By | Action |
|-------|-------------|--------|
| New reservation created | Customer / Admin | Run deterministic check + constraint propagation |
| Reservation cancelled | Customer / Admin | Release room → constraint propagation on freed capacity |
| Reservation expired (payment timeout) | System | Release room → constraint propagation |
| Admin modifies guest count or date | Admin | Release old assignment → re-run for both old and new date |
| Admin manual room assignment | Admin | Lock assignment → constraint propagation for cascade |
| T-7 cron | System | BFD force-assign remaining, notify admin of anomalies |

## Booking Validation (capacity check)

When a customer tries to book, use BFD simulation to check if the new group can be accommodated:

```
function canBook(date, guestCount):
  rooms = available rooms for date (active + not closed)
  existing = all active reservations (assigned + pending)
  simulate BFD with existing + virtual(guestCount)
  return anomalies.length == 0
```

This ensures: if #1 is occupied by a 26-person group, new bookings are capped at 24 (max of remaining rooms that fit).

## Scenario Walkthrough

### Basic scenarios

| Arrival Order | Process | Final Assignment |
|--------------|---------|-----------------|
| A=25 | → #1 (forced) | A=#1 |
| A=25, B=20 | A→#1, cascade: B only fits #2 → #2 | A=#1, B=#2 |
| B=20 | pending (could be #2 or #1) | B=pending |
| B=20, then A=25 | B pending → A→#1 → cascade: B→#2 | A=#1, B=#2 |
| A=15 | → #3 (≤16, #3 available) | A=#3 |
| A=15, B=20 | A→#3, B pending | A=#3, B=pending |
| A=15, B=20, C=25 | A→#3, C→#1, cascade: B→#2 | A=#3, C=#1, B=#2 |
| A=20, B=20 | both pending | T-7 BFD |
| A=15, B=15 | A→#3, B pending (#3 taken) | A=#3, B=T-7 |
| A=18 | pending | T-7 |
| A=18, B=25 | B→#1, cascade: A→#2 | B=#1, A=#2 |

### Cancellation scenarios

| Scenario | Process |
|----------|---------|
| A=25(#1), B=20(#2). A cancels. | #1 released. B stays in #2 (already assigned). |
| A=25(#1), B=20(pending). A cancels. | #1 released. B now has candidates {#2,#1} → still 2 → stays pending. |
| A=25(#1), B=20(pending), C=15(#3). A cancels. | #1 released. B candidates {#2,#1} → 2 → stays pending. |

## Timeline

```
Booking created ──────────── T-7 ──────────── T-2 ──────── Event day
     │                        │                 │
     └ Deterministic check    └ BFD force       └ Notification email
       + constraint             assign            to customer
       propagation              remaining         (room number)
                                Anomaly → notify admin
```

## Key Dates

- **T-7**: Auto-assignment deadline (BFD fallback) + cancellation refund deadline
- **T-2**: Customer notification email with room assignment
- Customer cannot modify reservations, only cancel and rebook
- Admin can modify at any time

## Files to Change

| File | Change |
|------|--------|
| `src/lib/yurt-assignment.ts` | New `tryDeterministicAssignment()` function |
| `src/app/api/reservations/route.ts` | Trigger assignment after creation |
| `src/app/api/reservations/[id]/route.ts` | Trigger on cancel, admin modify, manual assign |
| `src/app/api/cron/assign-yurts/route.ts` | Change from T-3 to T-7 |
| Booking UI (date/guest picker) | Dynamic max capacity based on simulation |
