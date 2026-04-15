# Auto Room Assignment Design

## Date: 2026-04-15

## Core Principle

**Don't let small groups occupy large room resources.** Large rooms should be reserved for larger groups. Assign immediately only when the outcome is certain; otherwise wait until it becomes certain or T-7 forces it. Once admin manually intervenes, that assignment is locked — the system will never override it.

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

## Admin Override (manual intervention)

### Locking mechanism

Add `manuallyAssigned Boolean @default(false)` to Reservation schema.

When admin performs ANY of these actions, set `manuallyAssigned = true`:
- Manual room assignment (assign_yurt action)
- Room swap
- Admin edit that changes yurtId

**Locked reservations are NEVER reassigned by Phases 1-3.** They are treated as immutable in the assignment algorithm (same as current behavior of preserving existing yurtId, but now explicitly flagged).

### Room Swap

Admin can swap rooms between two reservations on the same date. This is a single atomic operation:

```
swap(reservationA, reservationB):
  tempYurt = A.yurtId
  A.yurtId = B.yurtId
  B.yurtId = tempYurt
  A.manuallyAssigned = true
  B.manuallyAssigned = true
```

API: `POST /api/reservations/swap` with `{ reservationIdA, reservationIdB }`

UI: In calendar week view, each assigned reservation card has a swap icon. Click → select the other reservation on same date → confirm swap.

## Optimization Suggestions

When the system detects a better assignment arrangement exists, show a notification to admin.

### What is "better"?

Run BFD on all reservations for a date (ignoring current assignments). Compare BFD output with actual current assignments. If BFD produces tighter fits (less wasted capacity), it's "better."

Specifically: `sum(assignedRoom.capacity - guestCount)` is lower in the BFD suggestion.

### When to check

- After every assignment change (create, cancel, swap, admin edit)
- Only for dates that have at least 1 `manuallyAssigned` reservation (otherwise the algorithm already produced the optimal arrangement)

### Frontend notification

Calendar page shows a banner/badge:

```
📋 4/20: 发现更优分配方案 → [查看]
```

Clicking navigates to that date in calendar view with a modal showing:

| 预约 | 当前包房 | 建议包房 | 差异 |
|------|---------|---------|------|
| 张三 (20人) | #1 (28) | #2 (24) | -4 浪费 |
| 李四 (22人) | #2 (24) | #1 (28) | +4 浪费 |

Admin can "apply suggestion" (resets manuallyAssigned) or dismiss.

### Storage

Don't persist suggestions — compute on the fly when rendering calendar. The check is lightweight (3 rooms, max 3 reservations per date).

## Calendar View Enhancements

### Order Status Display

Each reservation card in the calendar shows order info:

```
张三 · 20人 · 已确认
🍽 已点单 $280          ← NEW: order status
```

States:
- No order → show nothing
- Order DRAFT → "📝 草稿"
- Order SUBMITTED/LOCKED → "🍽 已点单 ${estimatedTotal}"
- Order BILLED/PAID → "✅ $${finalTotal}"

Data: Include `order { status, estimatedTotal, finalTotal }` in the reservation API response for calendar queries.

### Reservation API Change

The `/api/reservations?startDate=...&endDate=...` endpoint needs to include order summary:

```prisma
include: {
  order: { select: { status: true, estimatedTotal: true, finalTotal: true } }
}
```

## Admin Venues Page — View Only

Remove all create/edit/delete functionality from the venues admin page. Admin can only view room configuration (name, alias, capacity, status). Room configuration changes require developer/seed updates.

Changes:
- Remove "Add Yurt" button
- Remove edit/delete actions on each yurt card
- Remove POST/PATCH/DELETE handlers or gate them (keep for future if needed)

## Trigger Points

| Event | Triggered By | Action |
|-------|-------------|--------|
| New reservation created | Customer / Admin | Run Phases 1-3 for that date |
| Reservation cancelled | Customer / Admin | Release room → run Phases 1-3 (skip `manuallyAssigned` reservations) |
| Reservation expired | System | Release room → run Phases 1-3 |
| Admin modifies guest count or date | Admin | Release old assignment → run Phases 1-3 for both dates |
| Admin manual room assignment | Admin | Lock (`manuallyAssigned=true`) → run Phases 2-3 for cascade |
| Admin room swap | Admin | Lock both → run Phases 2-3 for cascade |
| T-7 daily cron | System | Phase 4: BFD force-assign remaining, notify admin of anomalies |

## Booking Validation

When a customer books, simulate whether the date can accommodate the new group:

```
function canBook(date, guestCount):
  rooms = available rooms for date (active + not closed)
  existing = all active reservations on date (assigned + pending)
  plan = BFD(rooms, existing + virtual(guestCount))
  return plan.anomalies.length == 0
```

## Scenario Walkthrough

### Single reservation

| Arrival | Process | Result |
|---------|---------|--------|
| A=25 | Phase 1: 25-28 → #1 | A=#1 |
| A=15 | Phase 1: ≤16, #3 open → #3 | A=#3 |
| A=20 | Phase 1: 17-24 → pending | A=pending |

### Two reservations

| Arrival Order | Process | Result |
|--------------|---------|--------|
| A=25, then B=20 | A→#1 (Ph1), cascade B→#2 (Ph2) | A=#1, B=#2 |
| B=20, then A=25 | B pending, A→#1 (Ph1), cascade B→#2 (Ph2) | A=#1, B=#2 |
| A=20, then B=20 | Both pending (Ph1-2 skip), Ph3: 2==2 → A→#1, B→#2 | A=#1, B=#2 |
| A=20, then B=18 | Both pending, Ph3: 2==2 → A→#1, B→#2 | A=#1, B=#2 |
| A=15, then B=20 | A→#3 (Ph1), B pending (1 pending, 2 rooms → skip) | A=#3, B=pending |

### Three reservations

| Arrival Order | Process | Result |
|--------------|---------|--------|
| A=15, B=20, C=25 | A→#3, C→#1, cascade B→#2 | A=#3, C=#1, B=#2 |
| A=15, B=20, C=18 | A→#3, B+C pending, Ph3: 2==2 → B→#1, C→#2 | A=#3, B=#1, C=#2 |
| A=25, B=15, C=20 | A→#1, B→#3, cascade C→#2 | A=#1, B=#3, C=#2 |

### Admin override

| Scenario | Process |
|----------|---------|
| Admin assigns B=20 to #1 | B.manuallyAssigned=true, B locked to #1 |
| System later tries to reassign B | Skipped (manuallyAssigned=true) |
| Admin swaps A(#1) ↔ B(#2) | Both locked, yurtIds exchanged |
| Optimization detected | Frontend shows "发现更优方案" banner |

### Cancellation

| Scenario | Process |
|----------|---------|
| A=25(#1), B=20(#2). A cancels. | #1 released. B stays in #2 (already assigned, not reassigned). |
| A=25(#1), B=20(pending). A cancels. | #1 released. B candidates={#2,#1} → 2 → stays pending. |

## Key Dates

- **T-7**: Auto-assignment deadline (BFD fallback) + cancellation refund deadline
- **T-2**: Customer notification email with room assignment
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
| `prisma/schema.prisma` | Add `manuallyAssigned` field to Reservation |
| `src/lib/yurt-assignment.ts` | New `computeDeterministicAssignment()` + `tryDeterministicAssignment()` |
| `src/app/api/reservations/route.ts` | Trigger assignment after creation |
| `src/app/api/reservations/[id]/route.ts` | Trigger on cancel/modify/assign, set manuallyAssigned, T-7 policy |
| `src/app/api/reservations/swap/route.ts` | NEW: swap endpoint |
| `src/app/api/cron/assign-yurts/route.ts` | Change T-3 → T-7 |
| `src/app/api/reservations/route.ts` (GET) | Include order summary in response |
| `src/components/admin/calendar/CalendarDesktop.tsx` | Order status display, swap UI, optimization banner |
| `src/components/admin/calendar/CalendarMobile.tsx` | Order status display, swap UI |
| `src/app/(admin)/admin/venues/page.tsx` | Remove create/edit/delete, view only |
