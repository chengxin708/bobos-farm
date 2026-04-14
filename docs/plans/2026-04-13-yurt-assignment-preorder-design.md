# Smart Yurt Assignment + Admin Pre-Order + Calendar Redesign

**Date:** 2026-04-13
**Status:** Approved (v3 — with calendar redesign)

## Overview

Three features: (1) Smart yurt assignment with T-3 auto-allocation and full simulation at booking, (2) Admin calendar redesign to support deferred assignment model, (3) Admin can pre-order dishes on behalf of customers.

## Feature A: Smart Yurt Assignment

### Booking Flow (Changed)

**Before:** Customer selects date + yurt at booking, yurt assigned immediately.
**After:** Customer selects date + guest count only. Yurt assigned automatically at T-3.

- Customer sees: "Your yurt will be assigned 3 days before your reservation."
- Availability check at booking: **full Best-Fit Decreasing simulation** — if adding this reservation creates an unassignable situation, booking is rejected.
- **Exception:** If reservation date is within T-3 window (≤ 3 days away), assign immediately and send notification immediately.

### Schema Changes

```prisma
model Reservation {
  yurtId          String?      // nullable: null = not yet assigned
  yurtAssignedAt  DateTime?    // when yurt was auto/manually assigned
  yurtNotifiedAt  DateTime?    // when customer was emailed about assignment
  // REMOVE: @@unique([yurtId, date])
}
```

### Cancellation Policy

- Before T-3: customer can cancel
- T-3 and after: cancellation blocked for customers
- Admin can cancel anytime

### Assignment Algorithm: Best-Fit Decreasing

```
Input: all non-CANCELLED/EXPIRED reservations for target date
Steps:
  1. Get all ACTIVE yurts, exclude date-specific closures, sort by capacity ASC
  2. Sort reservations by guestCount DESC (largest groups first)
  3. Preserve admin manual assignments (yurtId already set → mark yurt as used)
  4. For each unassigned reservation: assign smallest available yurt where capacity >= guestCount
  5. Unassignable reservations → anomaly
```

### Booking-Time Validation (Full Simulation)

1. Add new reservation to date's existing reservations
2. Run Best-Fit Decreasing simulation
3. If ANY anomaly → **reject** with "This date cannot accommodate your group size"
4. If no anomaly → accept (don't assign yurtId unless within T-3)

### Anomaly Detection Triggers

1. **Reservation created** — reject if unassignable
2. **Reservation cancelled** — recheck, clear anomaly if resolved
3. **Reservation rescheduled** — recheck both old and new dates
4. **Yurt status changed** (ACTIVE ↔ MAINTENANCE) — recheck affected dates
5. **YurtAvailability changed** (date opened/closed) — recheck that date

### T-3 Window Bookings (≤ 3 days away)

- Run simulation → if assignable → immediately assign yurtId + send email
- Don't wait for cron

### Cron Jobs

**1. `/api/cron/assign-yurts` — Daily at midnight ET**
- Target: today + 3 days
- Skip dates with anomalies
- Run Best-Fit Decreasing, write yurtId + yurtAssignedAt

**2. `/api/cron/notify-assignments` — Daily at 10:00 AM ET**
- Send `sendYurtAssigned` to reservations where yurtAssignedAt set but yurtNotifiedAt null
- Set yurtNotifiedAt

### Admin Manual Assignment — Notification Timing

- Admin assigns yurt → writes yurtId + yurtAssignedAt, does NOT send email
- If reservation date ≤ T-2 → send email immediately
- Otherwise → email via T-2 10AM cron

### T-3 Post-Assignment: Guest Count Modification

- new count �� current yurt capacity → allow
- new count > current yurt capacity → reject, contact admin

### Rescheduling

- Old date: clear yurtId/yurtAssignedAt/yurtNotifiedAt, recheck anomalies
- New date > T-3: no assignment
- New date ≤ T-3: immediate assignment
- Both dates: anomaly check

### Yurt Status/Availability Changes

- Recheck all future affected dates
- Notify admin if new anomalies

---

## Feature B: Admin Calendar Redesign

Industry best practice: **Tape Chart + Unassigned Queue** (hotel PMS / SevenRooms model).

### Week View (Desktop) — Primary View

```
┌──────────────────────────────────────────────────────┐
│  Calendar          Week ◉ Month ○    ← → Today      │
├───────────┬────────┬────────┬────────┬────────┬──────┤
│           │ Mon    │ Tue    │ Wed    │ Thu    │ Fri  │
│           │ 3/15   │ 3/16   │ 3/17   │ 3/18   │ 3/19 │
├───────────┼────────┼────────┼────────┼────────┼──────┤
│ Golden    │        │ 李10人 │        │        │      │
│ (15)      │        │   ✓    │        │        │      │
├───────────┼────────┼────────┼────────┼────────┼──────┤
│ Sunset    │        │        │ 张20人 │        │      │
│ (25)      │        │        │   ✓    │        │      │
├───────────┼────────┼────────┼────────┼────────┼──────┤
│ Willow    │        │        │        │        │      │
│ (35)      │        │        │        │        │      │
├───────────┼────────┼────────┼────────┼────────┼──────┤
│ 📋 待分配  │ 王20人 │        │ 陈8人  │        │      │
│           │ 赵15人 │        │        │        │      │
├───────────┼────────┼────────┼────────┼────────┼──────┤
│           │ 35/75  │ 10/75  │ 28/75  │        │      │
│           │ ▓▓▓░░  │ ▓░░░░  │ ▓▓░░░  │        │      │
│           │ ●●待分配│ ✓全分配 │ ●待分配 │        │      │
└───────────┴────────┴────────┴────────┴────────┴──────┘
```

**Layout:**
- Left column: yurt names with capacity in parentheses
- Yurt rows: assigned reservations (guest name + count + status badge)
- "待分配" row: unassigned reservations, stacked vertically per date
- Bottom row per date: capacity bar (used/total) + assignment status indicator

**Status indicators:**
- ✓ 绿色 = 全部已分配 (all assigned)
- ● 黄色 = 有待分配 (some unassigned)
- ⚠ 红色 = 异常 (anomaly — needs manual handling)

**Interactions:**
- Click empty yurt cell → create reservation (admin specifies yurt + date)
- Click assigned reservation → open detail sidebar (same as current)
- Click unassigned reservation → open detail sidebar with "Assign Yurt" action
- Click capacity bar → expand date summary overlay

**Closed yurts:** Diagonal stripe pattern in cell (same as current), not clickable.

**Detail Sidebar (400px, right):**
- Same as current ReservationDetail
- For unassigned reservations: show "Assign Yurt" dropdown at top
- For assigned: show current yurt with "Change Yurt" option

### Month View (Desktop) — Overview Heat Map

```
┌──────────────────────────────────────────┐
│  March 2026          ← → Today           │
├──────┬──────┬──────┬──────┬──────┬──────┤
│ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │
├──────┼──────┼──────┼──────┼──────┼──────┤
│      │  1   │  2   │  3   │  4   │  5   │
│      │      │      │ 2预订 │      │ 1预订 │
│      │      │      │ ▓▓░░  │      │ ▓░░░  │
│      │      │      │ ✓    │      │ ●    │
├──────┼──────┼──────┼──────┼──────┼──────┤
│  6   │  7   │  8   │  9   │ 10   │ 11   │
│      │ 3预订 │      │      │ 2预订 │      │
│      │ ▓▓▓▓  │      │      │ ▓▓░░  │      │
│      │ ⚠    │      │      │ ●    │      │
└──────┴──────┴──────┴──────┴──────┴──────┘
```

**Each date cell shows:**
- Reservation count (e.g. "2预订")
- Capacity bar (mini progress bar)
- Assignment status: ✓ green / ● yellow / ⚠ red
- Empty dates: no content, light background

**Interactions:**
- Click date cell → switch to Week View, scroll to that week
- Hover → tooltip with details (guest names, assignment status)

### Mobile — Week + Day Detail

**Week selector + day selector:** Same as current.

**Day detail (changed):**

```
┌──────────────────────────┐
│  3/15 Monday             │
│  容量: 35/75  ●● 待分配   │
│  ▓▓▓▓▓▓▓░░░░░░░ 47%     │
├──────────────────────────┤
│  ┌─ Golden Meadow (15) ─┐│
│  │  空                   ││
│  └───────────────────────┘│
│  ┌─ Sunset Ridge (25) ──┐│
│  │  空                   ││
│  └───────────────────────┘│
│  ┌─ Willow Creek (35) ──┐│
│  │  空                   ││
│  └───────────────────────┘│
├──────────────────────────┤
│  📋 待分配 (2)            │
│  ┌───────────────────────┐│
│  │ 王先生  20人  待付款   ││
│  └───────────────────────┘│
│  ┌───────────────────────┐│
│  │ 赵女士  15人  已确认   ││
│  └───────────────────────┘│
└──────────────────────────┘
```

**Layout:**
- Top: date heading + capacity bar + assignment status
- Yurt cards: shows assigned reservation or "空" (empty)
- "待分配" section: lists unassigned reservations for this date
- Tap any card → full-screen reservation detail overlay

**Anomaly indicator:** If date has anomalies, capacity bar is red with ⚠ icon and explanation text.

### Calendar API Enhancement

New endpoint or enhance existing:
```
GET /api/calendar-summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Returns per-date summary:
```json
{
  "2026-03-15": {
    "totalGuests": 35,
    "totalCapacity": 75,
    "reservationCount": 2,
    "assignedCount": 0,
    "unassignedCount": 2,
    "anomaly": false
  }
}
```

Used by Month View for efficient rendering without fetching all reservation details.

---

## Feature C: Admin Pre-Order on Behalf of Customers

### Entry Point

Admin reservation detail → "Pre-order for Customer" button → `/pre-order?reservationId=xxx`

### API Change

`POST /api/orders`: Admin bypasses CONFIRMED status requirement.

### Pre-Order Page

- Admin skips ownership check
- Banner: "You are ordering on behalf of [customer name]"

---

## Files Changed

### Feature A (Yurt Assignment)

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | yurtId optional, add tracking fields, remove unique |
| `src/lib/yurt-assignment.ts` | Create | Best-Fit Decreasing + simulation + anomaly detection |
| `src/app/api/reservations/route.ts` | Modify | Full simulation at booking, immediate assign if ≤T-3 |
| `src/app/api/reservations/[id]/route.ts` | Modify | T-3 cancel block, guest count validation, reschedule, assign notification timing |
| `src/app/api/yurts/route.ts` | Modify | Anomaly recheck on status change |
| `src/app/api/yurts/[id]/route.ts` | Modify | Same |
| `src/app/api/cron/assign-yurts/route.ts` | Create | Midnight ET cron |
| `src/app/api/cron/notify-assignments/route.ts` | Create | 10AM ET cron |
| Customer booking/reservation UI | Modify | Remove yurt selection, show pending |

### Feature B (Calendar Redesign)

| File | Action | Description |
|------|--------|-------------|
| `src/components/admin/calendar/CalendarDesktop.tsx` | Rewrite | Tape chart + unassigned queue + capacity bars |
| `src/components/admin/calendar/CalendarMobile.tsx` | Rewrite | Day detail with yurt cards + unassigned section |
| `src/app/api/calendar-summary/route.ts` | Create | Per-date summary endpoint for month view |
| `src/components/admin/dashboard/UpcomingAssignments.tsx` | Create | Dashboard card |
| `src/components/admin/reservations/ReservationDetail.tsx` | Modify | Add "Assign Yurt" action for unassigned |
| `messages/en.json` | Modify | New calendar i18n keys |
| `messages/zh.json` | Modify | Same |

### Feature C (Admin Pre-Order)

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/orders/route.ts` | Modify | Bypass status check for admin |
| `src/app/(customer)/pre-order/page.tsx` | Modify | Allow admin, show banner |
| `src/components/admin/reservations/ReservationDetail.tsx` | Modify | Add pre-order button |
