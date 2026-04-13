# Smart Yurt Assignment + Admin Pre-Order Design

**Date:** 2026-04-13
**Status:** Approved

## Overview

Two features: (1) Smart yurt assignment with T-3 auto-allocation and early anomaly detection, (2) Admin can pre-order dishes on behalf of customers without deposit requirement.

## Feature A: Smart Yurt Assignment

### Booking Flow (Changed)

**Before:** Customer selects date + yurt at booking, yurt assigned immediately.
**After:** Customer selects date + guest count only. Yurt assigned automatically at T-3.

- Customer sees: "Your yurt will be assigned 3 days before your reservation."
- Availability check at booking: total remaining capacity across all yurts for the date (sum of capacities - sum of existing guest counts), not per-yurt check.

### Schema Changes

```prisma
model Reservation {
  yurtId  String?   // Changed: nullable (null = not yet assigned)
  // REMOVE: @@unique([yurtId, date]) — replaced by code-level check
}
```

### Cancellation Policy

- Before T-3: customer can cancel
- T-3 and after: cancellation blocked (API returns error)

### Assignment Algorithm: Best-Fit Decreasing

```
Input: all CONFIRMED + PAYMENT_SUBMITTED reservations for target date
Steps:
  1. Get all ACTIVE yurts, sorted by capacity ascending
  2. Sort reservations by guestCount descending (largest groups first)
  3. For each reservation: assign smallest available yurt that fits (capacity >= guestCount)
  4. Unassignable reservations → mark anomaly, do NOT assign
```

Why largest first: large groups have fewer options; assigning them first avoids small groups occupying large yurts.

### Anomaly Detection — At Booking Time

Every time a reservation is created or cancelled, simulate the assignment for that date:
- Run Best-Fit Decreasing on all reservations for the date
- If any reservation cannot be assigned → immediately notify Admin
- If a previously anomalous date is now resolved (e.g. after cancellation) → clear anomaly

**Anomaly types:**
1. Guest count exceeds largest ACTIVE yurt capacity (dynamic, not hardcoded)
2. More reservations than available yurts
3. Capacity conflict (remaining yurts can't fit a group)

### Cron Jobs

**1. `/api/cron/assign-yurts` — Runs daily at midnight (America/New_York)**
- Targets date = today + 3 days
- Only processes dates with NO anomalies
- Runs Best-Fit Decreasing, assigns yurtId to each reservation
- Anomalous dates: skip, Admin must handle manually
- Logs all assignments in ActivityLog

**2. `/api/cron/notify-assignments` — Runs daily at 10:00 AM ET (America/New_York)**
- Targets date = today + 2 days (assigned yesterday)
- Sends `sendYurtAssigned` email to each customer whose yurt was assigned
- Only sends if yurtId is set and notification not yet sent

### Admin Side

**Dashboard "Upcoming Assignments" card:**
- Shows dates with upcoming reservations that need assignment
- Anomalous dates highlighted in red with reason
- Click → goes to calendar page for that date

**Manual override:**
- Admin can assign/change yurts anytime via calendar → reservation edit
- Not blocked by T-3 or anomaly status

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

`POST /api/orders` (line 120):
```
Before: if (reservation.status !== "CONFIRMED") → reject
After:
  - Customer: still requires CONFIRMED
  - Admin: any status allowed
```

### Pre-Order Page Adaptation

`/pre-order` page currently checks reservation belongs to current user.
- Add: if user role is ADMIN, skip ownership check (API already supports this)
- Show a banner: "You are ordering on behalf of [customer name]"

## Files Changed

### Feature A (Yurt Assignment)

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | yurtId optional, remove unique constraint |
| `src/app/api/reservations/route.ts` | Modify | Remove yurt assignment at booking, add capacity check |
| `src/app/api/reservations/[id]/route.ts` | Modify | Add T-3 cancellation block |
| `src/lib/yurt-assignment.ts` | Create | Best-Fit Decreasing algorithm + anomaly detection |
| `src/app/api/cron/assign-yurts/route.ts` | Create | Daily midnight cron for yurt assignment |
| `src/app/api/cron/notify-assignments/route.ts` | Create | Daily 10AM ET cron for customer notifications |
| `src/components/admin/dashboard/UpcomingAssignments.tsx` | Create | Dashboard card showing assignment status |
| `src/app/(admin)/admin/dashboard/page.tsx` | Modify | Add UpcomingAssignments card |
| Customer booking UI files | Modify | Remove yurt selection, show "assigned later" message |
| Customer reservation detail | Modify | Show yurt name or "pending assignment" |

### Feature B (Admin Pre-Order)

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/orders/route.ts` | Modify | Bypass status check for admin |
| `src/app/(customer)/pre-order/page.tsx` | Modify | Allow admin access, show "ordering on behalf of" banner |
| `src/components/admin/reservations/ReservationDetail.tsx` | Modify | Add "Pre-order for Customer" button |
