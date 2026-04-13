# Smart Yurt Assignment + Admin Pre-Order Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace immediate yurt assignment with T-3 automatic best-fit allocation, add cancellation policy enforcement, and allow admin to pre-order on behalf of customers without deposit requirement.

**Architecture:** New `yurt-assignment.ts` module contains the Best-Fit Decreasing algorithm and anomaly detection. Two cron jobs handle assignment (midnight ET) and notification (10AM ET). Schema change makes yurtId optional on Reservation. Customer booking flow simplified to date+guestCount only. Admin pre-order bypasses CONFIRMED status check.

**Tech Stack:** Next.js App Router, Prisma, Cron API routes, Resend email, Web Push notifications

---

### Task 1: Schema — Make yurtId optional, remove unique constraint

**Files:**
- Modify: `prisma/schema.prisma:162-191`

**Step 1: Update Reservation model**

Change `yurtId String` to `yurtId String?` and remove `@@unique([yurtId, date])`:

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
  yurtAssignedAt         DateTime?         // NEW: when yurt was assigned
  yurtNotifiedAt         DateTime?         // NEW: when customer was notified
  createdAt              DateTime          @default(now())
  updatedAt              DateTime          @updatedAt

  user  User @relation(fields: [userId], references: [id], onDelete: Cascade)
  yurt  Yurt? @relation(fields: [yurtId], references: [id], onDelete: Cascade)
  order Order?
  rescheduleHistory RescheduleHistory[]

  // REMOVED: @@unique([yurtId, date])
  @@map("reservations")
}
```

Key changes:
- `yurtId String?` (nullable)
- `yurt Yurt?` (optional relation)
- Added `yurtAssignedAt DateTime?` and `yurtNotifiedAt DateTime?`
- Removed `@@unique([yurtId, date])`

**Step 2: Generate and run migration**

```bash
cd next-app && npx prisma db push
```

Then create migration record:
```bash
mkdir -p prisma/migrations/20260413100000_yurt_optional
```

Write migration SQL:
```sql
-- AlterTable: make yurtId nullable, add tracking fields
ALTER TABLE "reservations" ALTER COLUMN "yurtId" DROP NOT NULL;
ALTER TABLE "reservations" ADD COLUMN "yurtAssignedAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "yurtNotifiedAt" TIMESTAMP(3);

-- DropIndex: remove yurt+date unique constraint
DROP INDEX IF EXISTS "reservations_yurtId_date_key";
```

```bash
npx prisma migrate resolve --applied 20260413100000_yurt_optional
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(db): make yurtId optional, add assignment tracking fields"
```

---

### Task 2: Yurt Assignment Module — Best-Fit Decreasing + anomaly detection

**Files:**
- Create: `src/lib/yurt-assignment.ts`

**Step 1: Create the module**

This module exports:
- `runBestFitDecreasing(date)` — the core algorithm, returns assignments + anomalies
- `checkDateAnomalies(date)` — lightweight check used at booking time
- `assignYurtsForDate(date)` — full assignment that writes to DB

```typescript
// src/lib/yurt-assignment.ts
import { prisma } from "./prisma";
import { sendPushToAdmins } from "./push";

interface AssignmentResult {
  reservationId: string;
  yurtId: string;
  yurtName: string;
  guestCount: number;
}

interface Anomaly {
  reservationId: string;
  guestCount: number;
  reason: "exceeds_max_capacity" | "no_yurt_available" | "capacity_conflict";
}

interface AssignmentPlan {
  assignments: AssignmentResult[];
  anomalies: Anomaly[];
}

/**
 * Simulate Best-Fit Decreasing assignment for a date.
 * Does NOT write to DB — pure calculation.
 */
export async function runBestFitDecreasing(
  targetDate: Date
): Promise<AssignmentPlan> {
  // Get all ACTIVE yurts sorted by capacity ascending
  const yurts = await prisma.yurt.findMany({
    where: { status: "ACTIVE" },
    orderBy: { capacity: "asc" },
  });

  // Check admin-set closures for this date
  const closedYurtIds = (
    await prisma.yurtAvailability.findMany({
      where: { date: targetDate, isOpen: false },
      select: { yurtId: true },
    })
  ).map((c) => c.yurtId);

  const availableYurts = yurts.filter((y) => !closedYurtIds.includes(y.id));
  const maxCapacity = availableYurts.length > 0
    ? Math.max(...availableYurts.map((y) => y.capacity))
    : 0;

  // Get all non-cancelled/expired reservations for this date that need assignment
  const reservations = await prisma.reservation.findMany({
    where: {
      date: targetDate,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
    },
    orderBy: { guestCount: "desc" }, // largest groups first
    select: { id: true, guestCount: true, yurtId: true },
  });

  const assignments: AssignmentResult[] = [];
  const anomalies: Anomaly[] = [];
  const usedYurtIds = new Set<string>();

  // Include already-assigned yurts (admin manual overrides) as used
  for (const r of reservations) {
    if (r.yurtId) {
      usedYurtIds.add(r.yurtId);
    }
  }

  // Assign unassigned reservations
  for (const r of reservations) {
    if (r.yurtId) {
      // Already assigned (admin override) — keep it
      const yurt = availableYurts.find((y) => y.id === r.yurtId);
      if (yurt) {
        assignments.push({
          reservationId: r.id,
          yurtId: r.yurtId,
          yurtName: yurt.name,
          guestCount: r.guestCount,
        });
      }
      continue;
    }

    // Check if guest count exceeds max capacity
    if (r.guestCount > maxCapacity) {
      anomalies.push({
        reservationId: r.id,
        guestCount: r.guestCount,
        reason: "exceeds_max_capacity",
      });
      continue;
    }

    // Find smallest available yurt that fits
    const bestFit = availableYurts.find(
      (y) => y.capacity >= r.guestCount && !usedYurtIds.has(y.id)
    );

    if (!bestFit) {
      anomalies.push({
        reservationId: r.id,
        guestCount: r.guestCount,
        reason: "no_yurt_available",
      });
      continue;
    }

    usedYurtIds.add(bestFit.id);
    assignments.push({
      reservationId: r.id,
      yurtId: bestFit.id,
      yurtName: bestFit.name,
      guestCount: r.guestCount,
    });
  }

  return { assignments, anomalies };
}

/**
 * Check for anomalies on a date. Called at booking/cancellation time.
 * If anomalies found, notifies admin immediately.
 */
export async function checkDateAnomalies(targetDate: Date): Promise<void> {
  const { anomalies } = await runBestFitDecreasing(targetDate);

  if (anomalies.length > 0) {
    const dateStr = targetDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    void sendPushToAdmins({
      title: "Yurt Assignment Issue",
      body: `${dateStr}: ${anomalies.length} reservation(s) cannot be auto-assigned. Please check manually.`,
    });
  }
}

/**
 * Execute assignment for a date. Writes yurtId + yurtAssignedAt to DB.
 * Only assigns reservations that don't have anomalies.
 * Returns the plan for logging.
 */
export async function assignYurtsForDate(
  targetDate: Date
): Promise<AssignmentPlan> {
  const plan = await runBestFitDecreasing(targetDate);

  // Only write assignments for reservations that don't already have a yurtId
  for (const a of plan.assignments) {
    await prisma.reservation.updateMany({
      where: { id: a.reservationId, yurtId: null },
      data: {
        yurtId: a.yurtId,
        yurtAssignedAt: new Date(),
      },
    });
  }

  // Notify admin if there are anomalies
  if (plan.anomalies.length > 0) {
    const dateStr = targetDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    void sendPushToAdmins({
      title: "Yurt Assignment Issue",
      body: `${dateStr}: ${plan.anomalies.length} reservation(s) could not be assigned. Manual action required.`,
    });
  }

  return plan;
}
```

**Step 2: Type check**

```bash
cd next-app && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/yurt-assignment.ts
git commit -m "feat: add Best-Fit Decreasing yurt assignment module"
```

---

### Task 3: Booking API — Remove yurt assignment, add capacity check + anomaly detection

**Files:**
- Modify: `src/app/api/reservations/route.ts:298-401`

**Step 1: Replace yurt assignment with capacity check**

Replace the entire yurt assignment block (lines 298-371) and reservation creation (lines 386-401) with:

```typescript
// ── Capacity check: total remaining capacity for this date ──
const activeYurts = await prisma.yurt.findMany({ where: { status: "ACTIVE" } });

// Check admin-set closures
const closedYurtIds = (
  await prisma.yurtAvailability.findMany({
    where: { date: reservationDate, isOpen: false },
    select: { yurtId: true },
  })
).map((c) => c.yurtId);

const availableYurts = activeYurts.filter((y) => !closedYurtIds.includes(y.id));
const maxCapacity = availableYurts.length > 0
  ? Math.max(...availableYurts.map((y) => y.capacity))
  : 0;

// Check guest count against largest yurt
if (guestCount > maxCapacity) {
  return NextResponse.json(
    { error: `Maximum group size is ${maxCapacity} guests` },
    { status: 400 }
  );
}

// Get existing reservations for this date
const existingReservations = await prisma.reservation.findMany({
  where: {
    date: reservationDate,
    status: { notIn: ["CANCELLED", "EXPIRED"] },
  },
  select: { guestCount: true },
});

const totalCapacity = availableYurts.reduce((sum, y) => sum + y.capacity, 0);
const usedCapacity = existingReservations.reduce((sum, r) => sum + r.guestCount, 0);

if (usedCapacity + guestCount > totalCapacity) {
  return NextResponse.json(
    { error: "This date is fully booked. Please choose another date." },
    { status: 400 }
  );
}
```

Then update the `prisma.reservation.create` call to remove yurtId:

```typescript
const reservation = await prisma.reservation.create({
  data: {
    userId: session.user.id!,
    // yurtId omitted — will be assigned at T-3
    date: reservationDate,
    guestCount,
    specialRequests: specialRequests || null,
    status: "PENDING_PAYMENT",
    depositAmount,
    depositStatus: "UNPAID",
    paymentDeadline,
  },
  include: {
    user: { select: { id: true, name: true, email: true, phone: true } },
    yurt: { select: { id: true, name: true, capacity: true } },
  },
});
```

Also add anomaly detection after reservation creation:

```typescript
import { checkDateAnomalies } from "@/lib/yurt-assignment";

// ... after reservation creation ...
// Fire-and-forget: check for assignment anomalies
void checkDateAnomalies(reservationDate);
```

Update the email/notification code to handle null yurt:

```typescript
// In the sendReservationCreated call, use yurt name or "To be assigned"
yurtName: reservation.yurt?.name || "To be assigned",
```

**Step 2: Update admin create reservation**

The admin creation flow (lines 415+) should keep the ability to specify a yurtId (admin can manually assign at creation). No changes needed there — yurtId is already handled.

**Step 3: Type check**

```bash
cd next-app && npx tsc --noEmit
```

Fix any type errors from optional yurtId (the `include: { yurt }` now returns `null` for unassigned reservations).

**Step 4: Commit**

```bash
git add src/app/api/reservations/route.ts
git commit -m "feat: replace immediate yurt assignment with capacity-based booking"
```

---

### Task 4: Cancellation Policy — Block cancellation within T-3

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts` (cancel action, around line 100-150)

**Step 1: Add T-3 cancellation block**

In the cancel action handler, before processing the cancellation, add:

```typescript
// T-3 cancellation policy: cannot cancel within 3 days of reservation
const now = new Date();
now.setHours(0, 0, 0, 0);
const reservationDate = new Date(reservation.date);
reservationDate.setHours(0, 0, 0, 0);
const diffDays = Math.round(
  (reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
);

if (diffDays < 3 && !isAdmin) {
  return NextResponse.json(
    { error: "Reservations cannot be cancelled within 3 days of the event" },
    { status: 400 }
  );
}
```

Admin can still cancel any time (the `!isAdmin` check).

**Step 2: Add anomaly recheck on cancellation**

After a successful cancellation, recheck the date:

```typescript
import { checkDateAnomalies } from "@/lib/yurt-assignment";

// After cancellation update...
void checkDateAnomalies(reservation.date);
```

**Step 3: Commit**

```bash
git add src/app/api/reservations/[id]/route.ts
git commit -m "feat: enforce T-3 cancellation policy, recheck anomalies on cancel"
```

---

### Task 5: Cron — Assign yurts at midnight ET

**Files:**
- Create: `src/app/api/cron/assign-yurts/route.ts`

**Step 1: Create the cron endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { assignYurtsForDate } from "@/lib/yurt-assignment";
import { timingSafeEqual } from "crypto";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Target date = today + 3 days (in America/New_York timezone)
  const now = new Date();
  // Convert to ET by using toLocaleDateString trick
  const etDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  }); // YYYY-MM-DD format
  const etToday = new Date(etDateStr + "T00:00:00Z");
  const targetDate = new Date(etToday);
  targetDate.setUTCDate(targetDate.getUTCDate() + 3);

  const plan = await assignYurtsForDate(targetDate);

  return NextResponse.json({
    date: targetDate.toISOString().split("T")[0],
    assigned: plan.assignments.length,
    anomalies: plan.anomalies.length,
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/assign-yurts/
git commit -m "feat: add cron endpoint for T-3 yurt assignment"
```

---

### Task 6: Cron — Notify customers at 10AM ET

**Files:**
- Create: `src/app/api/cron/notify-assignments/route.ts`

**Step 1: Create the notification cron**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendYurtAssigned } from "@/lib/email";
import { timingSafeEqual } from "crypto";

export async function GET(req: NextRequest) {
  // Verify cron secret (same pattern as assign-yurts)
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find reservations that were assigned but not yet notified
  const reservations = await prisma.reservation.findMany({
    where: {
      yurtId: { not: null },
      yurtAssignedAt: { not: null },
      yurtNotifiedAt: null,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
    },
    include: {
      user: { select: { email: true } },
      yurt: { select: { name: true, description: true } },
    },
  });

  let notified = 0;

  for (const r of reservations) {
    if (!r.user.email || !r.yurt) continue;

    await sendYurtAssigned(r.user.email, {
      date: r.date,
      yurtName: r.yurt.name,
      yurtDescription: r.yurt.description || undefined,
      guestCount: r.guestCount,
      reservationId: r.id,
    });

    await prisma.reservation.update({
      where: { id: r.id },
      data: { yurtNotifiedAt: new Date() },
    });

    notified++;
  }

  return NextResponse.json({ notified });
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/notify-assignments/
git commit -m "feat: add cron endpoint for 10AM ET yurt assignment notifications"
```

---

### Task 7: Fix type errors — yurtId optional throughout codebase

**Files:**
- Modify: Various files that reference `reservation.yurtId` or `reservation.yurt`

**Step 1: Find and fix all references**

Run `npx tsc --noEmit` and fix each error. Common patterns:

1. **`reservation.yurt.name`** → `reservation.yurt?.name || "Pending"`
2. **`reservation.yurtId`** used in unique lookups → add null checks
3. **`assign_yurt` action** in `[id]/route.ts` → update conflict check since `@@unique` is removed:
   ```typescript
   // Replace findUnique with findFirst
   const conflict = await prisma.reservation.findFirst({
     where: {
       yurtId: newYurtId,
       date: reservation.date,
       status: { notIn: ["CANCELLED", "EXPIRED"] },
       id: { not: id },
     },
   });
   ```
4. **`edit` action** yurt conflict check → same pattern as above
5. **Customer reservations page** — show "To be assigned" when yurt is null
6. **Customer booking confirm page** — remove yurt name display, show assignment notice
7. **Admin reservation components** — handle null yurt gracefully
8. **`useReservationsData.ts`** — make yurt optional in the interface

**Step 2: Verify**

```bash
cd next-app && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add -u
git commit -m "fix: handle optional yurtId throughout codebase"
```

---

### Task 8: Customer UI — Remove yurt selection, show assignment notice

**Files:**
- Modify: `src/app/(customer)/booking/details/page.tsx`
- Modify: `src/app/(customer)/booking/confirm/page.tsx`
- Modify: `src/app/(customer)/reservations/page.tsx`

**Step 1: Booking details page**

The booking details page already doesn't show explicit yurt selection (yurt selection step redirects to details). Keep the guest count max based on largest yurt capacity (already works). No major changes needed.

**Step 2: Booking confirm page**

Where it shows the yurt name, replace with:
```tsx
<span className="text-[15px] text-[#6B6157] italic">
  Yurt will be assigned 3 days before your reservation
</span>
```

This text already exists on line 400 — verify and ensure it's the primary display (not showing a yurt name from the response).

**Step 3: Customer reservations page**

Where it displays `r.yurt?.name`, add fallback:
```tsx
{r.yurt?.name || t('yurtPending')}
```

Add i18n strings:
- `en.json`: `"yurtPending": "Pending assignment"`
- `zh.json`: `"yurtPending": "待分配"`

**Step 4: Commit**

```bash
git add src/app/(customer)/ messages/
git commit -m "feat(ui): show pending assignment for unassigned yurts"
```

---

### Task 9: Admin Dashboard — Upcoming Assignments card

**Files:**
- Create: `src/components/admin/dashboard/UpcomingAssignments.tsx`
- Modify: `src/components/admin/dashboard/DashboardDesktop.tsx`
- Modify: `src/components/admin/dashboard/DashboardMobile.tsx`

**Step 1: Create UpcomingAssignments component**

A card that shows dates in the next 7 days with:
- Number of reservations
- How many assigned vs unassigned
- Anomaly dates in red
- Click → navigates to `/admin/calendar?date=YYYY-MM-DD`

Fetches from a new API endpoint or computed from existing reservation data in the dashboard hook.

**Step 2: Add to dashboard layouts**

Import and render `UpcomingAssignments` in both desktop and mobile dashboard.

**Step 3: Commit**

```bash
git add src/components/admin/dashboard/
git commit -m "feat(admin): add upcoming assignments dashboard card"
```

---

### Task 10: Admin Pre-Order — Bypass status check for admin

**Files:**
- Modify: `src/app/api/orders/route.ts:120-125`

**Step 1: Update status check**

Change:
```typescript
if (reservation.status !== "CONFIRMED") {
  return NextResponse.json(
    { error: "Reservation must be confirmed to place an order" },
    { status: 400 }
  );
}
```

To:
```typescript
if (!isAdmin && reservation.status !== "CONFIRMED") {
  return NextResponse.json(
    { error: "Reservation must be confirmed to place an order" },
    { status: 400 }
  );
}
```

One line change. Admin can now create orders for any reservation status.

**Step 2: Commit**

```bash
git add src/app/api/orders/route.ts
git commit -m "feat(api): allow admin to create orders regardless of reservation status"
```

---

### Task 11: Admin Pre-Order — Add button + adapt pre-order page

**Files:**
- Modify: `src/components/admin/reservations/ReservationDetail.tsx`
- Modify: `src/app/(customer)/pre-order/page.tsx`

**Step 1: Add pre-order button in ReservationDetail**

In `ReservationDetail.tsx`, where the "Place Order" button currently shows only for CONFIRMED status (around line 415), add a second condition:

```tsx
{/* Show pre-order button for admin on any status when no order exists */}
{!reservation.order && (
  <a
    href={`/pre-order?reservationId=${reservation.id}`}
    target="_blank"
    className="..."
  >
    {isAdmin ? t('preOrderForCustomer') : t('placeOrder')}
  </a>
)}
```

For admin, the button shows regardless of reservation status. For customers, keep the existing CONFIRMED check.

**Step 2: Adapt pre-order page for admin**

In `/pre-order/page.tsx`, when fetching the reservation, the API already returns it for admins. Add a banner when admin is ordering on behalf:

```tsx
{session?.user?.role === 'ADMIN' && reservation?.user && (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
    Ordering on behalf of {reservation.user.name || reservation.user.email}
  </div>
)}
```

**Step 3: Add i18n strings**

Add to admin reservation i18n:
- `en.json`: `"preOrderForCustomer": "Pre-order for Customer"`
- `zh.json`: `"preOrderForCustomer": "代客预点菜"`

**Step 4: Commit**

```bash
git add src/components/admin/reservations/ src/app/(customer)/pre-order/ messages/
git commit -m "feat(admin): add pre-order for customer button and page adaptation"
```

---

### Task 12: Final verification

**Step 1: Full build check**

```bash
cd next-app && npm run build
```

Expected: Build passes with 0 errors.

**Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

**Step 3: Verify new routes**

Check that `/api/cron/assign-yurts` and `/api/cron/notify-assignments` appear in the build output.

**Step 4: Commit any fixes**

```bash
git add -u
git commit -m "chore: final cleanup for yurt assignment + admin pre-order"
```
