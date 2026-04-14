# Smart Yurt Assignment + Calendar Redesign + Admin Pre-Order — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace immediate yurt assignment with T-3 best-fit allocation, redesign admin calendar to tape-chart + unassigned-queue model, and allow admin to pre-order on behalf of customers.

**Architecture:** `yurt-assignment.ts` holds Best-Fit Decreasing algorithm with full simulation at booking time. Two cron jobs (midnight assign, 10AM notify). Calendar rewritten: Week View = yurt rows + unassigned row + capacity bars; Month View = heat map with status dots. Admin pre-order bypasses status check.

**Tech Stack:** Next.js App Router, Prisma, Cron API routes, Resend email, Web Push, SWR

---

### Task 1: Schema — Make yurtId optional, add tracking fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Update Reservation model**

```prisma
model Reservation {
  id                     String            @id @default(cuid())
  userId                 String
  yurtId                 String?           // nullable: null = not yet assigned
  date                   DateTime          @db.Date
  guestCount             Int
  specialRequests        String?
  status                 ReservationStatus @default(PENDING_PAYMENT)
  depositAmount          Float             @default(300)
  depositStatus          DepositStatus     @default(UNPAID)
  depositConfirmedAt     DateTime?
  paymentReference       String?
  paymentScreenshotUrl   String?
  paymentDeadline        DateTime?
  cancelledAt            DateTime?
  cancelReason           String?
  refundEligible         Boolean           @default(false)
  holdByAdmin            Boolean           @default(false)
  rescheduledFrom        String?
  yurtAssignedAt         DateTime?         // NEW
  yurtNotifiedAt         DateTime?         // NEW
  createdAt              DateTime          @default(now())
  updatedAt              DateTime          @updatedAt

  user  User? @relation(fields: [userId], references: [id], onDelete: Cascade)
  yurt  Yurt? @relation(fields: [yurtId], references: [id], onDelete: Cascade)
  order Order?
  rescheduleHistory RescheduleHistory[]

  // REMOVED: @@unique([yurtId, date])
  @@map("reservations")
}
```

**Step 2: Run migration**

```bash
cd next-app && npx prisma db push
```

Create migration file manually + resolve.

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(db): make yurtId optional, add yurtAssignedAt/yurtNotifiedAt"
```

---

### Task 2: Yurt Assignment Module

**Files:**
- Create: `src/lib/yurt-assignment.ts`

**Step 1: Create the module**

Exports:
- `runBestFitDecreasing(targetDate: Date): Promise<AssignmentPlan>` — pure simulation, no DB writes
- `simulateWithNewReservation(targetDate: Date, newGuestCount: number): Promise<{ assignable: boolean }>` — booking-time validation
- `checkDateAnomalies(targetDate: Date): Promise<void>` — notify admin if anomalies
- `assignYurtsForDate(targetDate: Date): Promise<AssignmentPlan>` — writes to DB

Algorithm:
1. Get ACTIVE yurts, exclude date closures (YurtAvailability), sort capacity ASC
2. Get non-CANCELLED/EXPIRED reservations for date, sort guestCount DESC
3. Preserve existing yurtId assignments (admin manual), mark those yurts as used
4. For each unassigned: find smallest available yurt where capacity >= guestCount
5. Unassignable → anomaly

`simulateWithNewReservation`: creates a virtual reservation list (existing + new), runs BFD, returns whether all are assignable.

`checkDateAnomalies`: runs BFD, if anomalies → `sendPushToAdmins` with date and count.

`assignYurtsForDate`: runs BFD, writes yurtId + yurtAssignedAt for unassigned reservations (skips already-assigned). Notifies admin if anomalies remain.

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/yurt-assignment.ts
git commit -m "feat: add Best-Fit Decreasing yurt assignment module"
```

---

### Task 3: Booking API — Full simulation + immediate assign for T-3 window

**Files:**
- Modify: `src/app/api/reservations/route.ts`

**Step 1: Replace yurt assignment block (lines 298-371)**

Remove the entire auto-assign / explicit yurt logic. Replace with:

1. Import `simulateWithNewReservation`, `checkDateAnomalies`, `assignYurtsForDate` from `yurt-assignment`
2. Run `simulateWithNewReservation(reservationDate, guestCount)`
3. If not assignable → return 400 "This date cannot accommodate your group size"
4. Create reservation WITHOUT yurtId
5. Check if date is within T-3 window:
   ```typescript
   const now = new Date(); now.setHours(0,0,0,0);
   const diffDays = Math.round((reservationDate.getTime() - now.getTime()) / 86400000);
   if (diffDays <= 3) {
     // Immediate assignment
     const plan = await assignYurtsForDate(reservationDate);
     // Find this reservation's assignment and send email immediately
   }
   ```
6. Fire-and-forget: `checkDateAnomalies(reservationDate)`
7. Update email/notification to handle null yurt: `yurtName: reservation.yurt?.name || "To be assigned"`

**Step 2: Keep admin create flow** — admin can still specify yurtId at creation.

**Step 3: Type check + commit**

```bash
git add src/app/api/reservations/route.ts
git commit -m "feat: full simulation at booking, immediate assign for T-3 window"
```

---

### Task 4: Cancellation Policy + Anomaly Rechecks

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts`

**Step 1: T-3 cancellation block in cancel action**

Before processing cancellation:
```typescript
const now = new Date(); now.setHours(0,0,0,0);
const resDate = new Date(reservation.date); resDate.setHours(0,0,0,0);
const diffDays = Math.round((resDate.getTime() - now.getTime()) / 86400000);
if (diffDays < 3 && !isAdmin) {
  return NextResponse.json(
    { error: "Reservations cannot be cancelled within 3 days of the event" },
    { status: 400 }
  );
}
```

**Step 2: After cancellation** → `void checkDateAnomalies(reservation.date)`

**Step 3: Guest count modification after T-3**

In `modify_details` action, if yurt already assigned:
```typescript
if (reservation.yurtId && guestCount) {
  const yurt = await prisma.yurt.findUnique({ where: { id: reservation.yurtId } });
  if (yurt && guestCount > yurt.capacity) {
    return NextResponse.json(
      { error: `Guest count exceeds assigned yurt capacity (max ${yurt.capacity})` },
      { status: 400 }
    );
  }
}
```

**Step 4: Reschedule handling**

In reschedule action, clear assignment on old date:
```typescript
// Clear yurt assignment for rescheduled reservation
data.yurtId = null;
data.yurtAssignedAt = null;
data.yurtNotifiedAt = null;
```
Then: `void checkDateAnomalies(oldDate)` and `void checkDateAnomalies(newDate)`
If new date within T-3 → immediate assignment.

**Step 5: assign_yurt notification timing**

In assign_yurt action, replace immediate email send with:
```typescript
// Check if we should send email now or let cron handle it
const resDate = new Date(reservation.date); resDate.setHours(0,0,0,0);
const now = new Date(); now.setHours(0,0,0,0);
const diffDays = Math.round((resDate.getTime() - now.getTime()) / 86400000);
if (diffDays <= 2 && updated.user.email) {
  // T-2 or closer: send immediately
  void sendYurtAssigned(updated.user.email, { ... });
  await prisma.reservation.update({ where: { id }, data: { yurtNotifiedAt: new Date() } });
} 
// Otherwise: cron will handle at T-2 10AM
```

**Step 6: Update conflict check** (since @@unique removed)

Replace all `findUnique({ where: { yurtId_date: ... } })` with:
```typescript
const conflict = await prisma.reservation.findFirst({
  where: {
    yurtId: targetYurtId,
    date: targetDate,
    status: { notIn: ["CANCELLED", "EXPIRED"] },
    id: { not: currentReservationId },
  },
});
```

**Step 7: Commit**

```bash
git add src/app/api/reservations/[id]/route.ts
git commit -m "feat: T-3 cancel policy, guest count validation, reschedule handling, assign timing"
```

---

### Task 5: Yurt API — Anomaly recheck on status/availability changes

**Files:**
- Modify: `src/app/api/yurts/route.ts`
- Modify: `src/app/api/yurts/[id]/route.ts`
- Modify: availability API (if separate)

**Step 1: When yurt status changes** (ACTIVE ↔ MAINTENANCE)

After updating yurt status, find all future dates with reservations for any yurt and recheck:
```typescript
import { checkDateAnomalies } from "@/lib/yurt-assignment";

// After yurt status update:
const futureDates = await prisma.reservation.findMany({
  where: { date: { gte: new Date() }, status: { notIn: ["CANCELLED", "EXPIRED"] } },
  select: { date: true },
  distinct: ["date"],
});
for (const { date } of futureDates) {
  void checkDateAnomalies(date);
}
```

**Step 2: When YurtAvailability changes** (date opened/closed)

After updating availability: `void checkDateAnomalies(targetDate)`

**Step 3: Commit**

```bash
git add src/app/api/yurts/ src/app/api/availability/
git commit -m "feat: anomaly recheck on yurt status and availability changes"
```

---

### Task 6: Cron — Assign yurts at midnight ET

**Files:**
- Create: `src/app/api/cron/assign-yurts/route.ts`

**Step 1: Create endpoint**

- Verify CRON_SECRET (timing-safe compare)
- Calculate target date = today + 3 in America/New_York timezone
- Call `assignYurtsForDate(targetDate)`
- Return `{ date, assigned, anomalies }`

**Step 2: Commit**

```bash
git add src/app/api/cron/assign-yurts/
git commit -m "feat: add midnight ET cron for T-3 yurt assignment"
```

---

### Task 7: Cron — Notify customers at 10AM ET

**Files:**
- Create: `src/app/api/cron/notify-assignments/route.ts`

**Step 1: Create endpoint**

- Verify CRON_SECRET
- Query: `yurtAssignedAt IS NOT NULL AND yurtNotifiedAt IS NULL AND status NOT IN (CANCELLED, EXPIRED)`
- For each: send `sendYurtAssigned` email, set `yurtNotifiedAt`
- Return `{ notified }`

**Step 2: Commit**

```bash
git add src/app/api/cron/notify-assignments/
git commit -m "feat: add 10AM ET cron for yurt assignment notifications"
```

---

### Task 8: Fix type errors — yurtId optional throughout codebase

**Files:**
- Various files referencing `reservation.yurtId` or `reservation.yurt`

**Step 1: Run `npx tsc --noEmit`, fix each error**

Common patterns:
- `reservation.yurt.name` → `reservation.yurt?.name ?? "Pending"`
- `reservation.yurtId` in findUnique → findFirst with null check
- `useReservationsData.ts` interface: make yurt optional
- Customer pages: show "To be assigned" / "待分配" for null yurt

**Step 2: Commit**

```bash
git add -u
git commit -m "fix: handle optional yurtId throughout codebase"
```

---

### Task 9: Customer UI — Remove yurt selection, show pending

**Files:**
- Modify: `src/app/(customer)/booking/confirm/page.tsx`
- Modify: `src/app/(customer)/reservations/page.tsx`
- Modify: `messages/en.json`, `messages/zh.json`

**Step 1: Booking confirm page**

Replace yurt name display with:
```tsx
{reservation?.yurt?.name || t('yurtPendingAssignment')}
```

i18n:
- en: `"yurtPendingAssignment": "Your yurt will be assigned 3 days before your reservation"`
- zh: `"yurtPendingAssignment": "蒙古包将在活动前3天分配"`

**Step 2: Reservations page**

Where `r.yurt?.name` displayed, add fallback:
```tsx
{r.yurt?.name || t('pendingAssignment')}
```

i18n:
- en: `"pendingAssignment": "Pending assignment"`
- zh: `"pendingAssignment": "待分配"`

**Step 3: Commit**

```bash
git add src/app/(customer)/ messages/
git commit -m "feat(ui): show pending assignment for unassigned yurts"
```

---

### Task 10: Calendar API — Summary endpoint for month view

**Files:**
- Create: `src/app/api/calendar-summary/route.ts`

**Step 1: Create endpoint**

```typescript
// GET /api/calendar-summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns per-date summary for efficient month view rendering

import { runBestFitDecreasing } from "@/lib/yurt-assignment";

// For each date in range that has reservations:
// {
//   "2026-03-15": {
//     totalGuests: 35,
//     totalCapacity: 75,
//     reservationCount: 2,
//     assignedCount: 0,
//     unassignedCount: 2,
//     hasAnomaly: false
//   }
// }
```

Query all reservations + yurts + availability in the date range. Group by date. For each date with reservations, run a lightweight anomaly check (or derive from data).

Requires admin auth.

**Step 2: Commit**

```bash
git add src/app/api/calendar-summary/
git commit -m "feat(api): add calendar summary endpoint for month view"
```

---

### Task 11: Calendar Desktop — Week View rewrite (Tape Chart)

**Files:**
- Rewrite: `src/components/admin/calendar/CalendarDesktop.tsx`

**Step 1: Rewrite Week View**

This is a full rewrite of the week view section. Key structural changes:

**Layout:**
```
┌─────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│             │ Mon 3/15│ Tue 3/16│ Wed 3/17│ Thu 3/18│ Fri 3/19│ Sat 3/20│ Sun 3/21│
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Golden (15) │         │ 李 10人 │         │         │         │ 陈 12人 │         │
│             │         │   ✓     │         │         │         │   ✓     │         │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Sunset (25) │         │         │ 张 20人 │         │         │         │         │
│             │         │         │   ✓     │         │         │         │         │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Willow (35) │         │         │         │         │         │         │         │
│             │         │         │         │         │         │         │         │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ 📋 待分配    │ 王 20人 │         │ 陈 8人  │         │ 周 30人 │         │         │
│             │ 赵 15人 │         │         │         │         │         │         │
├─────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│  Capacity   │ 35/75   │ 10/75   │ 28/75   │  0/75   │ 30/75   │ 12/75   │  0/75   │
│             │ ▓▓▓░░   │ ▓░░░░   │ ▓▓░░░   │         │ ▓▓░░░   │ ▓░░░░   │         │
│             │ ●● 待分  │ ✓ 已分  │ ● 待分  │         │ ● 待分  │ ✓ 已分  │         │
└─────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Data flow:**
- Fetch yurts from `/api/yurts`
- Fetch reservations from `/api/reservations?startDate=...&endDate=...`
- Group reservations by date
- Within each date: separate assigned (has yurtId) vs unassigned (yurtId null)
- Placed assigned reservations in their yurt row
- Unassigned in bottom "待分配" row
- Compute capacity: sum guestCount / sum yurt capacities per date

**Interactions:**
- Click empty yurt cell → CreateReservationModal with defaultDate + defaultYurtId
- Click reservation card (assigned or unassigned) → open ReservationDetail sidebar
- Click capacity bar area → no special action (info display only)

**Styling:**
- Status colors unchanged (same system as current)
- Unassigned row: light amber background (#FFF8E1) to visually distinguish
- Capacity bar: green (#5B8C3E) fill on cream background
- Assignment indicator: ✓ green (#4A7C59), ● yellow (#E8B730), ⚠ red (#C4533A)
- Closed yurt cells: diagonal stripe pattern (same as current)
- Today column: highlighted left border

**Step 2: Rewrite Month View**

Replace current month grid (which shows individual yurt slots per cell) with heat map:

Each date cell contains:
- Reservation count text (e.g. "2")
- Mini capacity bar (thin 4px bar)
- Status dot: ✓ / ● / ⚠
- Empty dates: just the date number

Data from `/api/calendar-summary` endpoint for efficiency.

Click date → switch to Week View for that week.

**Step 3: Keep sidebar unchanged** — ReservationDetail component stays, just receives data.

**Step 4: Type check + build**

```bash
npx tsc --noEmit && npm run build
```

**Step 5: Commit**

```bash
git add src/components/admin/calendar/CalendarDesktop.tsx
git commit -m "feat(admin): rewrite calendar desktop with tape chart + unassigned queue"
```

---

### Task 12: Calendar Mobile — Day detail rewrite

**Files:**
- Rewrite: `src/components/admin/calendar/CalendarMobile.tsx`

**Step 1: Rewrite day detail section**

Keep: week selector header, day selector row (unchanged).

Rewrite the selected-date detail:

**New layout:**
1. **Date header + capacity bar** — "3/15 Monday", "35/75 guests", progress bar, assignment status
2. **Yurt cards section** — one card per ACTIVE yurt:
   - If assigned reservation: guest name, count, status badge (same styling as current)
   - If empty: "Available" with muted styling
   - If closed: "Closed" with stripe
3. **Unassigned section** — amber header "📋 Pending Assignment (2)"
   - List of unassigned reservation cards
   - Each shows: guest name, count, status badge
   - Tap → full screen ReservationDetail overlay

**Anomaly display:** If date has anomaly, show red banner at top with ⚠ icon and explanation.

**Step 2: Commit**

```bash
git add src/components/admin/calendar/CalendarMobile.tsx
git commit -m "feat(admin): rewrite calendar mobile with yurt cards + unassigned section"
```

---

### Task 13: ReservationDetail — Assign Yurt action + Pre-order button

**Files:**
- Modify: `src/components/admin/reservations/ReservationDetail.tsx`

**Step 1: Add "Assign Yurt" for unassigned reservations**

When `reservation.yurtId === null`, show a prominent assign section at top of detail:

```tsx
{!reservation.yurtId && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
    <p className="text-sm text-amber-800 font-medium mb-2">{t('assignYurt')}</p>
    <select
      value={selectedYurtId}
      onChange={(e) => setSelectedYurtId(e.target.value)}
      className="..."
    >
      <option value="">{t('selectYurt')}</option>
      {availableYurts.map(y => (
        <option key={y.id} value={y.id} disabled={occupiedYurtIds.has(y.id)}>
          {y.name} (max {y.capacity})
        </option>
      ))}
    </select>
    <button onClick={handleAssignYurt}>{t('assign')}</button>
  </div>
)}
```

Calls `PATCH /api/reservations/[id]` with `{ action: "assign_yurt", yurtId }`.

**Step 2: Add "Pre-order for Customer" button**

Show for admin when no order exists (regardless of reservation status):

```tsx
{isAdmin && !reservation.order && (
  <a href={`/pre-order?reservationId=${reservation.id}`} target="_blank" className="...">
    {t('preOrderForCustomer')}
  </a>
)}
```

For non-admin: keep existing behavior (only show when CONFIRMED).

**Step 3: i18n**

Add to `messages/en.json` admin section:
```json
"assignYurt": "Assign Yurt",
"selectYurt": "Select a yurt...",
"assign": "Assign",
"preOrderForCustomer": "Pre-order for Customer"
```

And Chinese equivalents.

**Step 4: Commit**

```bash
git add src/components/admin/reservations/ messages/
git commit -m "feat(admin): add assign yurt action and pre-order button to reservation detail"
```

---

### Task 14: Dashboard — Upcoming Assignments card

**Files:**
- Create: `src/components/admin/dashboard/UpcomingAssignments.tsx`
- Modify: `src/components/admin/dashboard/DashboardDesktop.tsx`
- Modify: `src/components/admin/dashboard/DashboardMobile.tsx`

**Step 1: Create UpcomingAssignments component**

A card showing next 7 days with reservations:
- Date, reservation count, assigned/unassigned, status dot
- Anomaly dates in red with ⚠
- Click → `/admin/calendar?date=YYYY-MM-DD`

Fetch from `/api/calendar-summary` with 7-day range.

**Step 2: Add to both dashboard layouts**

Import and render in DashboardDesktop and DashboardMobile.

**Step 3: Commit**

```bash
git add src/components/admin/dashboard/
git commit -m "feat(admin): add upcoming assignments card to dashboard"
```

---

### Task 15: Admin Pre-Order — API bypass + page adaptation

**Files:**
- Modify: `src/app/api/orders/route.ts:120`
- Modify: `src/app/(customer)/pre-order/page.tsx`

**Step 1: API — bypass status check for admin**

Change line 120:
```typescript
if (!isAdmin && reservation.status !== "CONFIRMED") {
```

One line change.

**Step 2: Pre-order page — admin banner**

Add after reservation data loads:
```tsx
{session?.user?.role === 'ADMIN' && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
    Ordering on behalf of {reservation.user?.name || reservation.user?.email}
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/app/api/orders/route.ts src/app/(customer)/pre-order/
git commit -m "feat: admin can pre-order for customers regardless of reservation status"
```

---

### Task 16: i18n — All new calendar and assignment strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh.json`

**Step 1: Add all new i18n keys**

Calendar keys:
```json
"admin.calendar.unassigned": "Pending Assignment",
"admin.calendar.capacity": "Capacity",
"admin.calendar.allAssigned": "All assigned",
"admin.calendar.someUnassigned": "Pending",
"admin.calendar.anomaly": "Needs attention",
"admin.calendar.noReservations": "No reservations"
```

Dashboard keys:
```json
"admin.dashboard.upcomingAssignments": "Upcoming Assignments",
"admin.dashboard.assigned": "assigned",
"admin.dashboard.unassigned": "unassigned"
```

Customer keys:
```json
"customer.booking.yurtPendingAssignment": "Your yurt will be assigned 3 days before your reservation",
"customer.reservations.pendingAssignment": "Pending assignment"
```

Plus Chinese translations.

**Step 2: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add calendar, assignment, and pre-order translation strings"
```

---

### Task 17: Final verification

**Step 1: Type check**

```bash
cd next-app && npx tsc --noEmit
```

**Step 2: Full build**

```bash
npm run build
```

Expected: 0 errors, all routes present including cron endpoints.

**Step 3: Verify new routes in build output**

- `/api/cron/assign-yurts`
- `/api/cron/notify-assignments`
- `/api/calendar-summary`

**Step 4: Commit any fixes**

```bash
git add -u && git commit -m "chore: final cleanup and fixes"
```
