# Smart Yurt Assignment + Admin Pre-Order Design

**Date:** 2026-04-13
**Status:** Approved (v2 — with edge case handling)

## Overview

Two features: (1) Smart yurt assignment with T-3 auto-allocation, full simulation at booking, and early anomaly detection, (2) Admin can pre-order dishes on behalf of customers without deposit requirement.

## Feature A: Smart Yurt Assignment

### Booking Flow (Changed)

**Before:** Customer selects date + yurt at booking, yurt assigned immediately.
**After:** Customer selects date + guest count only. Yurt assigned automatically at T-3.

- Customer sees: "Your yurt will be assigned 3 days before your reservation."
- Availability check at booking: **full Best-Fit Decreasing simulation** (not simple sum check) — if adding this reservation creates an unassignable situation, booking is rejected.
- **Exception:** If reservation date is within T-3 window (≤ 3 days away), assign immediately and send notification immediately.

### Schema Changes

```prisma
model Reservation {
  yurtId          String?      // Changed: nullable (null = not yet assigned)
  yurtAssignedAt  DateTime?    // When yurt was assigned
  yurtNotifiedAt  DateTime?    // When customer was notified
  // REMOVE: @@unique([yurtId, date]) — replaced by code-level check
}
```

### Cancellation Policy

- Before T-3: customer can cancel
- T-3 and after: cancellation blocked for customers (API returns error)
- Admin can cancel anytime

### Assignment Algorithm: Best-Fit Decreasing

```
Input: all non-CANCELLED/EXPIRED reservations for target date
Steps:
  1. Get all ACTIVE yurts (not MAINTENANCE), exclude date-specific closures
  2. Sort by capacity ascending
  3. Sort reservations by guestCount descending (largest groups first)
  4. Preserve admin manual assignments (yurtId already set)
  5. For each unassigned reservation: assign smallest available yurt that fits
  6. Unassignable reservations → anomaly
```

### Booking-Time Validation (Full Simulation)

When a new reservation is created:
1. Add the new reservation to the date's existing reservations
2. Run full Best-Fit Decreasing simulation
3. If the new reservation causes ANY anomaly → **reject the booking** with "This date cannot accommodate your group size"
4. If no anomaly → accept booking (but don't assign yurtId yet, unless within T-3)

### Anomaly Detection Triggers

Anomaly check runs on affected dates when:
1. **Reservation created** — reject if unassignable (see above)
2. **Reservation cancelled** — recheck, clear anomaly if resolved
3. **Reservation rescheduled** — recheck both old and new dates
4. **Yurt status changed** (ACTIVE ↔ MAINTENANCE) — recheck all future dates with reservations for that yurt
5. **YurtAvailability changed** (date opened/closed) — recheck that date

**Anomaly types:**
1. Guest count exceeds largest ACTIVE yurt capacity (dynamic max)
2. More reservations than available yurts
3. Capacity conflict (remaining yurts can't fit a group)

### T-3 Window Bookings (≤ 3 days away)

If a customer books a date that is ≤ 3 days away:
- Run full simulation as normal
- If assignable → **immediately assign yurtId** + set `yurtAssignedAt`
- Send `sendYurtAssigned` email immediately (don't wait for cron)

### Cron Jobs

**1. `/api/cron/assign-yurts` — Daily at midnight ET**
- Target: today + 3 days
- Skip dates with anomalies
- Run Best-Fit Decreasing, write yurtId + yurtAssignedAt
- Anomalous dates: notify Admin, skip

**2. `/api/cron/notify-assignments` — Daily at 10:00 AM ET**
- Find all reservations where `yurtAssignedAt IS NOT NULL` and `yurtNotifiedAt IS NULL`
- Send `sendYurtAssigned` email to each
- Set `yurtNotifiedAt`

### Admin Manual Assignment — Notification Timing

- Admin assigns/changes yurt → writes `yurtId` + `yurtAssignedAt`, does NOT send email
- If reservation date ≤ T-2 (notification cron already passed or will pass today) → send email immediately
- Otherwise → email goes out via T-2 10AM cron

### T-3 Post-Assignment: Guest Count Modification

- Customer changes guest count after T-3 (yurt already assigned)
- If new count ≤ current yurt capacity → allow
- If new count > current yurt capacity → reject, tell customer to contact admin

### Rescheduling

- Old date: clear yurtId, yurtAssignedAt, yurtNotifiedAt
- New date > T-3: no assignment, normal flow
- New date ≤ T-3: immediate assignment
- Both dates: run anomaly check

### Yurt Status/Availability Changes

When admin changes yurt status or date availability:
- Find all future dates with non-cancelled reservations involving that yurt
- Run anomaly check on each affected date
- Notify admin if new anomalies detected

### Admin Side

**Dashboard "Upcoming Assignments" card:**
- Shows dates in next 7 days with reservations
- Assigned vs unassigned count
- Anomalous dates in red
- Click → calendar page for that date

**Manual override:** Admin can assign/change yurts anytime via calendar → reservation edit.

### Yurt Seed Data (Placeholder)

```
Small:  capacity 15, sortOrder 1
Medium: capacity 25, sortOrder 2
Large:  capacity 35, sortOrder 3
```

Names TBD — user will provide later.

## Feature B: Admin Pre-Order on Behalf of Customers

### Entry Point

Admin reservation detail page → "Pre-order for Customer" button → links to `/pre-order?reservationId=xxx`

### API Change

`POST /api/orders`:
- Customer: requires CONFIRMED status
- Admin: any status allowed

### Pre-Order Page Adaptation

- Admin skips ownership check (API already supports)
- Show banner: "You are ordering on behalf of [customer name]"

## Files Changed

### Feature A (Yurt Assignment)

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | yurtId optional, add yurtAssignedAt/yurtNotifiedAt, remove unique |
| `src/lib/yurt-assignment.ts` | Create | Best-Fit Decreasing + simulation + anomaly detection |
| `src/app/api/reservations/route.ts` | Modify | Full simulation at booking, immediate assign if ≤T-3 |
| `src/app/api/reservations/[id]/route.ts` | Modify | T-3 cancel block, guest count validation, reschedule handling, assign_yurt notification timing |
| `src/app/api/yurts/route.ts` | Modify | Anomaly recheck on yurt status change |
| `src/app/api/yurts/[id]/route.ts` | Modify | Same |
| `src/app/api/cron/assign-yurts/route.ts` | Create | Midnight ET cron |
| `src/app/api/cron/notify-assignments/route.ts` | Create | 10AM ET cron |
| `src/components/admin/dashboard/UpcomingAssignments.tsx` | Create | Dashboard card |
| Customer booking/reservation UI files | Modify | Remove yurt selection, show pending |

### Feature B (Admin Pre-Order)

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/orders/route.ts` | Modify | Bypass status check for admin |
| `src/app/(customer)/pre-order/page.tsx` | Modify | Allow admin, show banner |
| `src/components/admin/reservations/ReservationDetail.tsx` | Modify | Add pre-order button |
