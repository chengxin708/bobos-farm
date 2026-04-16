# Refund Status, Reservation Notes, Customer Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CANCELLED_PENDING_REFUND status with full admin refund workflow, admin reservation notes, and optimize customer management page (5-tab nav, mobile cards, full-screen detail with complete history).

**Architecture:** Prisma schema changes + migration, API route modifications for cancel/refund actions, new note CRUD endpoints, reservation list/detail UI updates for refund workflow, customer page responsive rewrite with extracted components.

**Tech Stack:** Next.js 16 (App Router), Prisma 6, TypeScript, Tailwind CSS v4, next-intl, SWR, Lucide React, Zod

---

## Task 1: Prisma Schema — New Enum Value + ReservationNote Model

**Files:**
- Modify: `prisma/schema.prisma:26-33` (ReservationStatus enum)
- Modify: `prisma/schema.prisma:165-199` (Reservation model — add relation)
- Modify: `prisma/schema.prisma:52-73` (User model — add relation)

**Step 1: Add CANCELLED_PENDING_REFUND to ReservationStatus enum**

In `prisma/schema.prisma`, update the enum:

```prisma
enum ReservationStatus {
  PENDING_PAYMENT
  PAYMENT_SUBMITTED
  CONFIRMED
  COMPLETED
  CANCELLED
  CANCELLED_PENDING_REFUND
  EXPIRED
}
```

**Step 2: Add ReservationNote model**

Add after the `Reservation` model (before `// ============ ORDERS ============`):

```prisma
model ReservationNote {
  id            String      @id @default(cuid())
  reservationId String
  userId        String
  content       String
  pinned        Boolean     @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  reservation Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("reservation_notes")
}
```

**Step 3: Add relations to existing models**

In the `Reservation` model, add after `rescheduleHistory RescheduleHistory[]`:
```prisma
  adminNotes    ReservationNote[]
```

In the `User` model, add after `pushSubscriptions PushSubscription[]`:
```prisma
  reservationNotes ReservationNote[]
```

**Step 4: Run migration**

```bash
cd next-app && npx prisma migrate dev --name add-cancelled-pending-refund-and-notes
```

**Step 5: Verify Prisma client generates successfully**

```bash
npx prisma generate
```

**Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add CANCELLED_PENDING_REFUND status and ReservationNote model"
```

---

## Task 2: API — Cancel Action with Refund Status Logic

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts:50-62` (adminUpdateSchema)
- Modify: `src/app/api/reservations/[id]/route.ts:156-244` (cancel action)
- Modify: `src/app/api/reservations/[id]/route.ts:773-877` (admin updates)

**Step 1: Update adminUpdateSchema to accept new status**

In `src/app/api/reservations/[id]/route.ts`, line 51, update the status enum:

```typescript
status: z.enum(["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED", "CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED", "COMPLETED"]).optional(),
```

**Step 2: Update cancel action to set CANCELLED_PENDING_REFUND when appropriate**

In the cancel action handler (around line 197), replace the `status: "CANCELLED"` logic:

```typescript
// Determine target status:
// If deposit was confirmed and refund is eligible → CANCELLED_PENDING_REFUND
// Otherwise → CANCELLED
const hasConfirmedDeposit = reservation.depositStatus === 'CONFIRMED' && reservation.depositAmount > 0
const targetStatus = hasConfirmedDeposit && refundEligible
  ? 'CANCELLED_PENDING_REFUND'
  : 'CANCELLED'

const updated = await prisma.reservation.update({
  where: { id },
  data: {
    status: targetStatus,
    cancelledAt: now,
    cancelReason: parsedCancel.data.reason || null,
    refundEligible,
  },
  include: {
    user: {
      select: { id: true, name: true, email: true, phone: true },
    },
    yurt: { select: { id: true, name: true, capacity: true } },
  },
});
```

**Step 3: Add cancel_and_refund action**

Add a new action handler AFTER the cancel block and BEFORE the submit_payment block (around line 245). This handles the "取消并标记已退款" one-step flow:

```typescript
// ---------- CANCEL AND REFUND (one-step) ----------
if (action === "cancel_and_refund") {
  const parsedCancel = cancelActionSchema.safeParse(body);
  if (!parsedCancel.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedCancel.error.flatten() },
      { status: 400 }
    );
  }
  if (reservation.status === "CANCELLED" || reservation.status === "EXPIRED") {
    return NextResponse.json(
      { error: "Reservation is already cancelled or expired" },
      { status: 400 }
    );
  }

  // Same cancellation window check as cancel action
  const cancelNow = new Date();
  cancelNow.setHours(0, 0, 0, 0);
  const cancelResDate = new Date(reservation.date);
  cancelResDate.setHours(0, 0, 0, 0);
  const cancelDiffDays = Math.round(
    (cancelResDate.getTime() - cancelNow.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (cancelDiffDays < cancelWindowDays && !isAdmin) {
    return NextResponse.json(
      { error: `Reservations cannot be cancelled within ${cancelWindowDays} days of the event` },
      { status: 400 }
    );
  }

  const now = new Date();
  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: parsedCancel.data.reason || null,
      refundEligible: true,
      depositStatus: "REFUNDED",
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      yurt: { select: { id: true, name: true, capacity: true } },
    },
  });

  // Log cancellation
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "RESERVATION_CANCELLED",
      targetType: "Reservation",
      targetId: id,
      details: {
        reason: parsedCancel.data.reason,
        refundEligible: true,
        refundedImmediately: true,
        date: reservation.date,
      },
    },
  });

  // Log refund
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "DEPOSIT_REFUNDED",
      targetType: "Reservation",
      targetId: id,
      details: {
        depositAmount: reservation.depositAmount,
      },
    },
  });

  // Send cancellation + refund email
  if (updated.user.email) {
    sendReservationCancelled(updated.user.email, {
      date: updated.date,
      yurtName: updated.yurt?.name ?? "Pending assignment",
      guestCount: updated.guestCount,
      cancelReason: parsedCancel.data.reason || undefined,
      depositAmount: reservation.depositAmount,
      depositStatus: "REFUNDED",
    }).catch(err => console.error('[email] cancel+refund notification failed:', err));
  }

  void tryDeterministicAssignment(new Date(reservation.date));
  return NextResponse.json(updated);
}
```

**Step 4: Update admin PATCH to auto-transition CANCELLED_PENDING_REFUND → CANCELLED on refund**

In the admin updates section (around line 810-825), after the deposit status change log, add:

```typescript
// Auto-transition: when admin marks deposit as REFUNDED on a CANCELLED_PENDING_REFUND reservation,
// move it to final CANCELLED state
if (
  parsedAdmin.data.depositStatus === "REFUNDED" &&
  reservation.status === "CANCELLED_PENDING_REFUND"
) {
  await prisma.reservation.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  // Re-fetch with updated status
  const refetched = await prisma.reservation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      yurt: { select: { id: true, name: true, capacity: true } },
    },
  });
  // Log the refund completion
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "DEPOSIT_REFUNDED",
      targetType: "Reservation",
      targetId: id,
      details: { depositAmount: reservation.depositAmount },
    },
  });
  return NextResponse.json(refetched);
}
```

**Step 5: Update CANCELLED status check in cancel action**

In the cancel action (line 166), also reject CANCELLED_PENDING_REFUND:

```typescript
if (
  reservation.status === "CANCELLED" ||
  reservation.status === "CANCELLED_PENDING_REFUND" ||
  reservation.status === "EXPIRED"
) {
```

**Step 6: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 7: Commit**

```bash
git add src/app/api/reservations/
git commit -m "feat: cancel action sets CANCELLED_PENDING_REFUND, add cancel_and_refund action, auto-transition on refund"
```

---

## Task 3: API — ReservationNote CRUD Endpoints

**Files:**
- Create: `src/app/api/reservations/[id]/notes/route.ts`
- Create: `src/app/api/reservations/[id]/notes/[noteId]/route.ts`

**Step 1: Create notes list + create endpoint**

Create `src/app/api/reservations/[id]/notes/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const notes = await prisma.reservationNote.findMany({
    where: { reservationId: id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(notes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify reservation exists
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const note = await prisma.reservationNote.create({
    data: {
      reservationId: id,
      userId: session.user.id,
      content: parsed.data.content,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
```

**Step 2: Create single note update + delete endpoint**

Create `src/app/api/reservations/[id]/notes/[noteId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateNoteSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;
  const body = await req.json();
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.pinned !== undefined) updateData.pinned = parsed.data.pinned;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const note = await prisma.reservationNote.update({
    where: { id: noteId },
    data: updateData,
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(note);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noteId } = await params;
  await prisma.reservationNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
```

**Step 3: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 4: Commit**

```bash
git add src/app/api/reservations/[id]/notes/
git commit -m "feat: add ReservationNote CRUD API endpoints"
```

---

## Task 4: i18n — All New Strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh.json`

**Step 1: Add reservation status + filter + action strings (EN)**

In `messages/en.json`, in the `admin.reservations` section:

Add to `status` object:
```json
"CANCELLED_PENDING_REFUND": "Pending Refund"
```

Add to `filters` object:
```json
"pendingRefund": "Pending Refund"
```

Add to root of `admin.reservations`:
```json
"pendingRefunds": "{count} pending refund",
"refundAmount": "Refund ${amount}",
"refundedSuccess": "Refund marked successfully",
```

Add to `actions` object:
```json
"markRefunded": "Mark Refunded",
"cancelAndRefund": "Cancel & Mark Refunded",
"cancelPendingRefund": "Cancel (Pending Refund)"
```

Add to `dialog` object:
```json
"cancelWithRefundTitle": "Cancel Reservation",
"cancelWithRefundMsg": "This reservation has a ${amount} confirmed deposit. After cancellation, it will enter pending refund status.",
"cancelAndRefundLabel": "Cancel & Mark Refunded"
```

Add to `detail` object:
```json
"cancellationInfo": "Cancellation Info",
"cancelledAt": "Cancelled At",
"cancelReason": "Reason",
"refundAmount": "Refund Amount",
"noReason": "No reason provided"
```

Add to `detail.tabs` object:
```json
"notes": "Notes"
```

Add new `notes` section inside `admin.reservations`:
```json
"notes": {
  "addPlaceholder": "Add a note...",
  "add": "Add",
  "pinned": "Pinned",
  "editNote": "Edit",
  "deleteNote": "Delete",
  "deleteConfirm": "Delete this note?",
  "empty": "No notes yet",
  "by": "by {name}",
  "saving": "Saving...",
  "pin": "Pin",
  "unpin": "Unpin"
}
```

Add to `activityLog` object:
```json
"depositRefunded": "{actor} marked deposit as refunded"
```

**Step 2: Add customer page strings (EN)**

Add to `admin.nav`:
```json
"customers": "Customers"
```

(Check if this key already exists — it does per the exploration. If so, skip.)

In `admin.customers`, add:
```json
"subtitle": "Manage your customer database",
"card": {
  "visits": "{count} visits",
  "lastVisit": "Last {date}"
},
"detail": {
  "back": "Customer Details",
  "viewReservation": "View"
}
```

**Step 3: Add same strings in ZH**

Add corresponding Chinese translations in `messages/zh.json`:

Reservation status:
```json
"CANCELLED_PENDING_REFUND": "待退款"
```

Filters:
```json
"pendingRefund": "待退款"
```

Root:
```json
"pendingRefunds": "{count} 笔待退款",
"refundAmount": "退款 ${amount}",
"refundedSuccess": "退款标记成功",
```

Actions:
```json
"markRefunded": "标记已退款",
"cancelAndRefund": "取消并标记已退款",
"cancelPendingRefund": "取消预约（待退款）"
```

Dialog:
```json
"cancelWithRefundTitle": "取消预约",
"cancelWithRefundMsg": "此预约有 ${amount} 已确认定金。取消后将进入待退款状态。",
"cancelAndRefundLabel": "取消并标记已退款"
```

Detail:
```json
"cancellationInfo": "取消信息",
"cancelledAt": "取消时间",
"cancelReason": "取消原因",
"refundAmount": "退款金额",
"noReason": "未提供原因"
```

Tabs:
```json
"notes": "备注"
```

Notes section:
```json
"notes": {
  "addPlaceholder": "添加备注...",
  "add": "添加",
  "pinned": "已置顶",
  "editNote": "编辑",
  "deleteNote": "删除",
  "deleteConfirm": "确认删除此备注？",
  "empty": "暂无备注",
  "by": "{name}",
  "saving": "保存中...",
  "pin": "置顶",
  "unpin": "取消置顶"
}
```

Activity log:
```json
"depositRefunded": "{actor} 标记定金已退款"
```

Customer:
```json
"subtitle": "管理客户信息",
"card": {
  "visits": "{count} 次到访",
  "lastVisit": "上次 {date}"
},
"detail": {
  "back": "客户详情",
  "viewReservation": "查看"
}
```

**Step 4: Commit**

```bash
git add messages/
git commit -m "feat: add i18n strings for refund status, notes, and customer page"
```

---

## Task 5: useReservationsData — New Status Handling

**Files:**
- Modify: `src/components/admin/reservations/useReservationsData.ts`

**Step 1: Update Reservation type**

Find the `status` type in the `Reservation` interface/type and add `'CANCELLED_PENDING_REFUND'` to the union.

**Step 2: Add STATUS_BADGE for new status**

In `STATUS_BADGE` (line 173), add:
```typescript
CANCELLED_PENDING_REFUND: { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
```

**Step 3: Update HIDDEN_STATUSES**

In the filtering logic (line 320), change `HIDDEN_STATUSES` to NOT include `CANCELLED_PENDING_REFUND`:
```typescript
const HIDDEN_STATUSES = ['CANCELLED', 'EXPIRED']
// CANCELLED_PENDING_REFUND intentionally excluded — stays in active view
```

(This is already correct — `CANCELLED_PENDING_REFUND` is not listed. Just verify.)

**Step 4: Add pendingRefundCount**

After `completedCount` (line 312), add:
```typescript
const pendingRefundCount = useMemo(
  () => allReservations.filter(r => r.status === 'CANCELLED_PENDING_REFUND').length,
  [allReservations]
)
```

**Step 5: Update actionNeededCount to include pending refunds**

Update the `actionNeededCount` memo (line 301):
```typescript
const actionNeededCount = useMemo(
  () => allReservations.filter(r =>
    r.status === 'PENDING_PAYMENT' ||
    r.status === 'PAYMENT_SUBMITTED' ||
    r.status === 'CANCELLED_PENDING_REFUND'
  ).length,
  [allReservations]
)
```

**Step 6: Update FilterMode type and filter logic**

Update the type (line 90):
```typescript
type FilterMode = 'action-needed' | 'pending-refund' | 'confirmed' | 'completed' | 'all'
```

In the filter chip logic (line 354), add the new filter case:
```typescript
if (filter === 'action-needed') {
  list = list.filter(r => r.status === 'PENDING_PAYMENT' || r.status === 'PAYMENT_SUBMITTED' || r.status === 'CANCELLED_PENDING_REFUND')
} else if (filter === 'pending-refund') {
  list = list.filter(r => r.status === 'CANCELLED_PENDING_REFUND')
} else if (filter === 'confirmed') {
```

**Step 7: Update history mode to include CANCELLED_PENDING_REFUND**

In the history mode filter (line 329), update to also send completed refunds to history:
```typescript
// History mode: show past dates OR cancelled/expired
list = list.filter(r => {
  const dateStr = new Date(r.date).toISOString().slice(0, 10)
  return dateStr < todayStr || HIDDEN_STATUSES.includes(r.status)
})
```

Also add `'CANCELLED_PENDING_REFUND'` to the history status chips (where `['all', 'COMPLETED', 'CANCELLED', 'EXPIRED']` is listed in the UI components — this will be done in Task 6).

**Step 8: Add markRefunded action**

After `completeReservation` callback (line 443), add:
```typescript
const markRefunded = useCallback(async (id: string) => {
  const ok = await handleAction(id, 'admin', {
    depositStatus: 'REFUNDED',
  })
  if (ok) showSuccess(t('refundedSuccess'))
}, [handleAction, showSuccess, t])
```

**Step 9: Add cancelAndRefund action**

After `cancelReservation` callback (line 438), add:
```typescript
const cancelAndRefund = useCallback(async (id: string) => {
  setUpdating(true)
  try {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_and_refund' }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || t('updateFailed'))
      return
    }
    const updated = await res.json()
    if (selectedRes?.id === id) setSelectedRes(updated)
    mutateReservations()
    mutateDetail()
    mutateActivityLogs()
    showSuccess(t('cancelledSuccess'))
  } catch {
    alert(t('updateFailed'))
  } finally {
    setUpdating(false)
  }
}, [selectedRes, mutateReservations, mutateDetail, mutateActivityLogs, showSuccess, t])
```

**Step 10: Export new values**

In the return object (line 500), add:
```typescript
pendingRefundCount,
markRefunded,
cancelAndRefund,
```

**Step 11: Update activityLogText for new actions**

In the `activityLogText` function, add a case:
```typescript
case 'DEPOSIT_REFUNDED':
  return t('activityLog.depositRefunded', { actor })
```

**Step 12: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 13: Commit**

```bash
git add src/components/admin/reservations/useReservationsData.ts
git commit -m "feat: useReservationsData — pending refund status, counts, filters, actions"
```

---

## Task 6: Reservation List UI — Alert Pill, Filter Chip, Card Inline Button

**Files:**
- Modify: `src/components/admin/reservations/ReservationsMobile.tsx`
- Modify: `src/components/admin/reservations/ReservationsDesktop.tsx`
- Modify: `src/components/admin/StatusBadge.tsx`

**Step 1: Add CANCELLED_PENDING_REFUND to StatusBadge**

In `src/components/admin/StatusBadge.tsx`, add to `RESERVATION_STATUS`:
```typescript
CANCELLED_PENDING_REFUND: { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
```

**Step 2: Update ReservationsMobile — destructure new values**

In `ReservationsMobile.tsx`, update the destructured values from `useReservationsData()` to include:
```typescript
pendingRefundCount,
markRefunded,
cancelAndRefund,
```

**Step 3: Add pending refund alert pill (Mobile)**

In the action alerts section (line 268), add after the `pendingOrderCount` pill and update the condition:

```typescript
{!showHistory && (pendingDepositCount > 0 || heldByAdminCount > 0 || pendingOrderCount > 0 || pendingRefundCount > 0) && (
  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
    {/* ...existing pills... */}
    {pendingRefundCount > 0 && (
      <button
        onClick={() => { setFilter('pending-refund'); setShowHistory(false) }}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DC3545]/10 border border-[#DC3545]/20 text-[#DC3545] text-xs font-semibold"
      >
        <RefreshCcw size={14} />
        {t('pendingRefunds', { count: pendingRefundCount })}
      </button>
    )}
  </div>
)}
```

Add `RefreshCcw` to the lucide-react import.

**Step 4: Add pending-refund filter chip (Mobile)**

In the filter chips section (line 300), add after "Action Needed" chip:
```typescript
<FilterChip
  label={t('filters.pendingRefund')}
  count={pendingRefundCount}
  active={filter === 'pending-refund'}
  onClick={() => setFilter('pending-refund')}
/>
```

**Step 5: Add inline "Mark Refunded" button to card (Mobile)**

In the `ReservationCard` component, add after the `isPaymentSubmitted` inline buttons block:

```typescript
{/* Inline action for CANCELLED_PENDING_REFUND */}
{r.status === 'CANCELLED_PENDING_REFUND' && (
  <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[#E8ECE4]">
    <span className="text-xs text-[#DC3545] font-medium flex-1">
      {t('refundAmount', { amount: r.depositAmount })}
    </span>
    <button
      onClick={(e) => { e.stopPropagation(); onMarkRefunded(r.id) }}
      disabled={isUpdating}
      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5B8C3E] text-white disabled:opacity-50"
    >
      {t('actions.markRefunded')}
    </button>
  </div>
)}
```

Update `ReservationCard` props to accept `onMarkRefunded: (id: string) => void` and pass it from the parent.

**Step 6: Apply same changes to ReservationsDesktop**

Mirror Steps 2-5 in `ReservationsDesktop.tsx`:
- Destructure `pendingRefundCount`, `markRefunded`, `cancelAndRefund`
- Add alert pill, filter chip, card inline button
- Import `RefreshCcw` from lucide-react

**Step 7: Add CANCELLED_PENDING_REFUND to history mode status chips**

In both Mobile and Desktop, update the history status chips array:
```typescript
{['all', 'COMPLETED', 'CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED'].map(s => (
```

**Step 8: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 9: Commit**

```bash
git add src/components/admin/reservations/ReservationsMobile.tsx src/components/admin/reservations/ReservationsDesktop.tsx src/components/admin/StatusBadge.tsx
git commit -m "feat: reservation list UI — refund alert pill, filter chip, card inline action"
```

---

## Task 7: Cancel Dialog Enhancement

**Files:**
- Modify: `src/components/admin/reservations/ReservationDetail.tsx:77,141-162,797-810`

**Step 1: Add new confirm action types**

Update the `confirmAction` state type (line 77):
```typescript
const [confirmAction, setConfirmAction] = useState<'deposit' | 'waiveDeposit' | 'complete' | 'cancel' | 'cancelAndRefund' | 'markRefunded' | null>(null)
```

**Step 2: Update handleConfirmAction**

Add new cases to `handleConfirmAction` (line 141):
```typescript
if (confirmAction === 'cancelAndRefund') onAction.cancelAndRefund(reservation.id)
if (confirmAction === 'markRefunded') onAction.markRefunded(reservation.id)
```

**Step 3: Update confirmDialogConfig**

Replace the `cancel` entry and add new entries:
```typescript
cancel: {
  title: t('dialog.cancelReservation'),
  message: (reservation.depositStatus === 'CONFIRMED' && reservation.depositAmount > 0)
    ? t('dialog.cancelWithRefundMsg', { amount: reservation.depositAmount })
    : t('dialog.cancelReservationMsg'),
  variant: 'danger' as const,
  confirmLabel: (reservation.depositStatus === 'CONFIRMED' && reservation.depositAmount > 0)
    ? t('actions.cancelPendingRefund')
    : t('actions.cancel'),
},
cancelAndRefund: {
  title: t('dialog.cancelWithRefundTitle'),
  message: t('dialog.cancelWithRefundMsg', { amount: reservation.depositAmount }),
  variant: 'danger' as const,
  confirmLabel: t('actions.cancelAndRefund'),
},
markRefunded: {
  title: t('detail.markRefunded'),
  message: t('dialog.markRefundedMsg', { amount: reservation.depositAmount }),
  variant: 'success' as const,
  confirmLabel: t('actions.markRefunded'),
},
```

(Add `markRefundedMsg` to i18n: EN `"Are you sure you want to mark this $${amount} deposit as refunded?"` / ZH `"确定将 $${amount} 定金标记为已退款？"`)

**Step 4: Update cancel button to show secondary option**

In the cancel button section (line 797-810), when deposit is confirmed, show TWO buttons:
```typescript
{/* Cancel — non-terminal states */}
{!['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED', 'COMPLETED'].includes(reservation.status) && (
  <div className="flex flex-col items-center gap-1">
    <button
      onClick={() => setConfirmAction('cancel')}
      disabled={isUpdating}
      className="w-full py-2 text-sm font-semibold rounded-lg border border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545]/5 disabled:opacity-50"
    >
      {t('actions.cancel')}
    </button>
    {/* One-step cancel+refund option when deposit is confirmed */}
    {reservation.depositStatus === 'CONFIRMED' && reservation.depositAmount > 0 && (
      <button
        onClick={() => setConfirmAction('cancelAndRefund')}
        disabled={isUpdating}
        className="w-full py-2 text-sm font-semibold rounded-lg border border-[#8C8478] text-[#8C8478] hover:bg-[#8C8478]/5 disabled:opacity-50"
      >
        {t('actions.cancelAndRefund')}
      </button>
    )}
    {isAdmin && (
      <span className="text-[11px] text-[#8A7E6B]">管理员可随时取消，不受 7 天限制</span>
    )}
  </div>
)}
```

**Step 5: Add "Mark Refunded" button for CANCELLED_PENDING_REFUND status**

After the cancel button section, add:
```typescript
{/* Mark Refunded — only for CANCELLED_PENDING_REFUND */}
{reservation.status === 'CANCELLED_PENDING_REFUND' && isAdmin && (
  <button
    onClick={() => setConfirmAction('markRefunded')}
    disabled={isUpdating}
    className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
  >
    {t('actions.markRefunded')}
  </button>
)}
```

**Step 6: Update onAction interface**

Update the `ReservationDetailProps` interface to add new actions:
```typescript
onAction: {
  confirmDeposit: (id: string) => void
  cancelReservation: (id: string) => void
  cancelAndRefund: (id: string) => void
  markRefunded: (id: string) => void
  completeReservation: (id: string) => void
}
```

Update both `ReservationsMobile.tsx` and `ReservationsDesktop.tsx` where `ReservationDetail` is rendered to pass the new action props:
```typescript
onAction={{ confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation }}
```

**Step 7: Add cancellation info section to detail panel**

In the Info tab rendering, after the Payment Info section and before the Activity Timeline, add a cancellation info section shown when status is `CANCELLED_PENDING_REFUND`:

```typescript
{/* Cancellation Info — shown for CANCELLED_PENDING_REFUND */}
{reservation.status === 'CANCELLED_PENDING_REFUND' && (
  <>
    <hr className="border-[#E8ECE4]" />
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-[#DC3545]">{t('detail.cancellationInfo')}</h4>
      <div className="space-y-2">
        {reservation.cancelledAt && (
          <div className="flex justify-between">
            <span className="text-xs text-[#8C8478]">{t('detail.cancelledAt')}</span>
            <span className="text-sm text-brown">{formatDateTime(reservation.cancelledAt)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-xs text-[#8C8478]">{t('detail.cancelReason')}</span>
          <span className="text-sm text-brown">{reservation.cancelReason || t('detail.noReason')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#8C8478]">{t('detail.refundAmount')}</span>
          <span className="text-base font-bold text-[#DC3545]">${reservation.depositAmount}</span>
        </div>
      </div>
    </div>
  </>
)}
```

**Step 8: Update terminal-state checks**

Update the edit button guard (line 738) and cancel button guard to include `CANCELLED_PENDING_REFUND`:
```typescript
{!['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED', 'COMPLETED'].includes(reservation.status) && (
```

**Step 9: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 10: Commit**

```bash
git add src/components/admin/reservations/ReservationDetail.tsx src/components/admin/reservations/ReservationsMobile.tsx src/components/admin/reservations/ReservationsDesktop.tsx
git commit -m "feat: cancel dialog with refund options, mark-refunded action, cancellation info section"
```

---

## Task 8: Reservation Detail — Notes Tab

**Files:**
- Modify: `src/components/admin/reservations/ReservationDetail.tsx`

**Step 1: Add notes state and data fetching**

Add SWR fetch for notes, new state variables, and CRUD handlers at the top of the component (after existing state declarations):

```typescript
// Notes
const { data: notesList, mutate: mutateNotes } = useSWR<Array<{
  id: string; content: string; pinned: boolean; createdAt: string; updatedAt: string;
  user: { id: string; name: string | null }
}>>(
  reservation.id ? `/api/reservations/${reservation.id}/notes` : null,
  fetcher,
  { revalidateOnFocus: false }
)
const [newNote, setNewNote] = useState('')
const [savingNote, setSavingNote] = useState(false)
const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
const [editingNoteContent, setEditingNoteContent] = useState('')

const handleAddNote = useCallback(async () => {
  if (!newNote.trim()) return
  setSavingNote(true)
  try {
    await fetch(`/api/reservations/${reservation.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote.trim() }),
    })
    setNewNote('')
    mutateNotes()
  } catch { /* ignore */ } finally { setSavingNote(false) }
}, [newNote, reservation.id, mutateNotes])

const handleUpdateNote = useCallback(async (noteId: string, data: { content?: string; pinned?: boolean }) => {
  try {
    await fetch(`/api/reservations/${reservation.id}/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setEditingNoteId(null)
    mutateNotes()
  } catch { /* ignore */ }
}, [reservation.id, mutateNotes])

const handleDeleteNote = useCallback(async (noteId: string) => {
  try {
    await fetch(`/api/reservations/${reservation.id}/notes/${noteId}`, { method: 'DELETE' })
    mutateNotes()
  } catch { /* ignore */ }
}, [reservation.id, mutateNotes])
```

**Step 2: Update tab type and tab bar**

Update `detailTab` state to support 3 tabs:
```typescript
const [detailTab, setDetailTab] = useState<'info' | 'order' | 'notes'>('info')
```

Add a third tab button in the tab bar (after the Pre-order tab):
```typescript
<button
  onClick={() => setDetailTab('notes')}
  className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
    detailTab === 'notes'
      ? 'text-[#6B7F5E] border-b-2 border-[#6B7F5E]'
      : 'text-[#8C8478]'
  }`}
>
  {t('detail.tabs.notes')}
  {notesList && notesList.length > 0 && (
    <span className="text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center bg-[#6B7F5E]/10 text-[#6B7F5E]">
      {notesList.length}
    </span>
  )}
</button>
```

**Step 3: Add renderNotesTab function**

Add this function alongside `renderInfoTab` and `renderOrderTab`:

```typescript
function renderNotesTab() {
  const tNotes = (key: string, values?: Record<string, unknown>) => t(`notes.${key}`, values)
  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
      {/* Add note input */}
      <div className="flex gap-2">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder={tNotes('addPlaceholder')}
          className="flex-1 border border-[#E8ECE4] rounded-lg p-2.5 text-sm h-16 resize-none text-brown placeholder:text-[#8C8478] focus:outline-none focus:border-[#6B7F5E]"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote() } }}
        />
        <button
          onClick={handleAddNote}
          disabled={savingNote || !newNote.trim()}
          className="self-end px-4 py-2 text-sm font-semibold rounded-lg bg-[#6B7F5E] text-white hover:bg-[#5A6E4F] disabled:opacity-50"
        >
          {savingNote ? tNotes('saving') : tNotes('add')}
        </button>
      </div>

      {/* Notes list */}
      {!notesList || notesList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#8C8478]">{tNotes('empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notesList.map((note) => (
            <div key={note.id} className={`rounded-lg border p-3 ${note.pinned ? 'border-[#F4A623]/30 bg-[#F4A623]/5' : 'border-[#E8ECE4]'}`}>
              {editingNoteId === note.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editingNoteContent}
                    onChange={(e) => setEditingNoteContent(e.target.value)}
                    className="border border-[#E8ECE4] rounded-lg p-2 text-sm h-16 resize-none text-brown focus:outline-none focus:border-[#6B7F5E]"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingNoteId(null)} className="px-3 py-1 text-xs text-[#8C8478] hover:text-brown">
                      {tc('cancel')}
                    </button>
                    <button
                      onClick={() => handleUpdateNote(note.id, { content: editingNoteContent })}
                      className="px-3 py-1 text-xs font-semibold text-[#6B7F5E] hover:text-[#5A6E4F]"
                    >
                      {tc('save')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-brown whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-[#8C8478]">
                      {note.user.name || 'Admin'} · {formatDateTime(note.createdAt)}
                    </span>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateNote(note.id, { pinned: !note.pinned })}
                          className={`p-1 rounded hover:bg-[#F4A623]/10 ${note.pinned ? 'text-[#F4A623]' : 'text-[#8C8478]'}`}
                          title={note.pinned ? tNotes('unpin') : tNotes('pin')}
                        >
                          <Pin size={12} />
                        </button>
                        <button
                          onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content) }}
                          className="p-1 rounded hover:bg-[#E8ECE4]/50 text-[#8C8478]"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => { if (confirm(tNotes('deleteConfirm'))) handleDeleteNote(note.id) }}
                          className="p-1 rounded hover:bg-[#DC3545]/10 text-[#8C8478] hover:text-[#DC3545]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Add `Pin, Trash2` to lucide-react imports.

**Step 4: Render notes tab in main body**

In the main render, add the notes tab rendering alongside info and order:
```typescript
{detailTab === 'notes' && renderNotesTab()}
```

**Step 5: Add tc reference**

Add `const tc = useTranslations('admin.common')` near the top if not already present.

**Step 6: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 7: Commit**

```bash
git add src/components/admin/reservations/ReservationDetail.tsx
git commit -m "feat: reservation detail notes tab — add, edit, delete, pin notes"
```

---

## Task 9: Bottom Nav — Add Customers Tab

**Files:**
- Modify: `src/components/admin/AdminBottomTabs.tsx`
- Modify: `src/app/(admin)/admin/more/page.tsx`

**Step 1: Add Customers tab**

In `AdminBottomTabs.tsx`, add `Users` to the lucide import and add the 5th tab:

```typescript
import { LayoutDashboard, CalendarCheck, Calendar, Users, MoreHorizontal } from 'lucide-react'

const tabs = [
  { key: 'home' as const, href: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'bookings' as const, href: '/admin/reservations', icon: CalendarCheck },
  { key: 'calendar' as const, href: '/admin/calendar', icon: Calendar },
  { key: 'customers' as const, href: '/admin/customers', icon: Users },
  { key: 'more' as const, href: '/admin/more', icon: MoreHorizontal },
]
```

**Step 2: Remove Customers from More page**

In `src/app/(admin)/admin/more/page.tsx`, remove the customers entry from the `links` array:

```typescript
const links = [
  { href: '/admin/menu', icon: UtensilsCrossed, labelKey: 'menu' as const, descKey: 'menuDesc' as const },
  { href: '/admin/venues', icon: Tent, labelKey: 'venues' as const, descKey: 'venuesDesc' as const },
  { href: '/admin/reports', icon: BarChart3, labelKey: 'reports' as const, descKey: 'reportsDesc' as const },
  { href: '/admin/settings', icon: Settings, labelKey: 'settings' as const, descKey: 'settingsDesc' as const },
]
```

Remove `Users` from the lucide import since it's no longer used.

**Step 3: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 4: Commit**

```bash
git add src/components/admin/AdminBottomTabs.tsx src/app/\(admin\)/admin/more/page.tsx
git commit -m "feat: add Customers to bottom nav, remove from More page"
```

---

## Task 10: Customer Page — Responsive Rewrite

**Files:**
- Modify: `src/app/(admin)/admin/customers/page.tsx` (major rewrite)

This is the largest task. The page needs to:
1. Show cards on mobile instead of the 7-column table
2. Show full-screen detail overlay on mobile instead of 380px right panel
3. Show ALL reservation history (remove 5-item limit)
4. Make reservation rows clickable (navigate to reservations page)

**Step 1: Update the Reservation type to include CANCELLED_PENDING_REFUND**

In the `Reservation` interface, update the status union:
```typescript
status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_PENDING_REFUND' | 'EXPIRED'
```

**Step 2: Add router import**

```typescript
import { useRouter } from 'next/navigation'
```

Add inside the component:
```typescript
const router = useRouter()
```

**Step 3: Add customer card component for mobile**

Add a `CustomerCard` component above the main export:

```typescript
function CustomerCard({
  customer,
  onClick,
  t,
}: {
  customer: CustomerData
  onClick: () => void
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex items-center gap-3 active:bg-[#F8F7F4]/80 cursor-pointer"
    >
      <div className={`w-10 h-10 ${customer.initialsColor} rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
        {customer.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1A1208] truncate">{customer.name}</span>
          {customer.tag && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${customer.tagColor} shrink-0 ml-2`}>
              {customer.tag}
            </span>
          )}
        </div>
        <div className="text-xs text-[#8C8478] truncate">
          {customer.email.endsWith('@placeholder.local') ? t('noEmail') : customer.email}
        </div>
        <div className="text-xs text-[#8C8478] mt-0.5">
          {t('card.visits', { count: customer.totalVisits })} · {customer.lastVisit !== '--' ? t('card.lastVisit', { date: customer.lastVisit }) : '--'}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Add full-screen mobile detail component**

Add a `CustomerDetailMobile` component:

```typescript
function CustomerDetailMobile({
  customer,
  notes,
  noteSaving,
  noteSaved,
  onNoteChange,
  onSaveNote,
  onClose,
  onViewReservation,
  t,
  STATUS_COLORS,
}: {
  customer: CustomerData
  notes: Record<string, string>
  noteSaving: boolean
  noteSaved: boolean
  onNoteChange: (value: string) => void
  onSaveNote: () => void
  onClose: () => void
  onViewReservation: (reservationId?: string) => void
  t: (key: string, values?: Record<string, unknown>) => string
  STATUS_COLORS: Record<string, string>
}) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E8ECE4]">
        <button onClick={onClose} className="p-1 hover:bg-[#F8F7F4] rounded-lg">
          <X size={20} className="text-[#8C8478]" />
        </button>
        <h3 className="text-base font-bold text-[#1A1208]">{t('detail.back')}</h3>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Profile */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-14 h-14 ${customer.initialsColor} rounded-full flex items-center justify-center text-white text-xl font-bold`}>
            {customer.initials}
          </div>
          <span className="text-base font-bold text-[#1A1208]">{customer.name}</span>
          {customer.email.endsWith('@placeholder.local') ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F4A623]/15 text-[#F4A623]">{t('noEmail')}</span>
          ) : (
            <span className="text-xs text-[#8C8478]">{customer.email}</span>
          )}
          <span className="text-xs text-[#8C8478]">{customer.phone}</span>
          <span className="text-xs text-[#8C8478]">{t('detail.memberSince')} {customer.memberSince}</span>
          {customer.tag && (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${customer.tagColor}`}>
              {customer.tag}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { value: String(customer.totalVisits), label: t('detail.stats.totalVisits') },
            { value: `$${customer.totalSpent.toLocaleString()}`, label: t('detail.stats.totalSpent') },
            { value: `${customer.cancelRate}%`, label: t('detail.stats.cancelRate') },
            { value: String(customer.cancelCount), label: t('detail.stats.noShows') },
          ].map((s) => (
            <div key={s.label} className="bg-[#F8F7F4] rounded-lg p-2">
              <div className="text-base font-bold text-[#1A1208]">{s.value}</div>
              <div className="text-[10px] text-[#8C8478]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Reservation History — full list */}
        <div>
          <span className="text-xs font-bold text-[#1A1208]">{t('detail.reservationHistory')}</span>
          <div className="mt-2 flex flex-col gap-2">
            {customer.reservations.map((r, i) => (
              <div
                key={i}
                onClick={() => onViewReservation()}
                className="flex items-center justify-between text-xs py-2 px-2 rounded-lg hover:bg-[#F8F7F4] cursor-pointer"
              >
                <span className="text-[#1A1208]">{r.date}</span>
                <span className="text-[#8C8478]">{r.yurtName}</span>
                <span className={`font-semibold ${STATUS_COLORS[r.status] || 'text-[#8C8478]'}`}>{r.status}</span>
              </div>
            ))}
            {customer.reservations.length === 0 && (
              <p className="text-xs text-[#8C8478] py-2">No reservations</p>
            )}
          </div>
        </div>

        {/* Admin Notes */}
        <div>
          <span className="text-xs font-bold text-[#1A1208]">{t('detail.adminNotes')}</span>
          <textarea
            className="w-full border border-[#E8ECE4] rounded-lg p-2 text-xs h-20 resize-none mt-2 text-[#1A1208] placeholder:text-[#8C8478] focus:outline-none focus:border-[#6B7F5E]"
            value={notes[customer.id] ?? ''}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Add notes about this customer..."
          />
          <button
            onClick={onSaveNote}
            disabled={noteSaving}
            className={`flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg mt-2 transition-colors ${noteSaving ? 'bg-[#6B7F5E]/60 cursor-not-allowed' : 'bg-[#6B7F5E] hover:bg-[#5A6E4F]'}`}
          >
            <Save size={12} /> {noteSaved ? 'Saved!' : noteSaving ? 'Saving...' : t('detail.saveNote')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 5: Rewrite the main component render**

Replace the return JSX of the `Customers` component to conditionally render mobile vs desktop layouts:

```typescript
// Remove 5-item limit — show all reservations
// In the `reservations` mapping (line 207), change `.slice(0, 10)` to remove the limit or increase it
// Change line 207: sorted.slice(0, 10) → sorted (show all)
```

In the main return:

```typescript
return (
  <>
    {isMobile && <AdminTopBar title={t('title')} />}
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel — table (desktop) or cards (mobile) */}
      <div className="flex-1 p-4 md:p-6 overflow-auto flex flex-col gap-4">
        {/* Search & Filters — keep existing code */}
        {/* ... */}

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-[#8C8478]">{tc('loadingCustomers')}</div>
          </div>
        ) : isMobile ? (
          /* Mobile: card list */
          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8ECE4] p-8 text-center">
                <p className="text-sm text-[#8C8478]">No customers found</p>
              </div>
            ) : (
              filtered.map((c) => (
                <CustomerCard key={c.id} customer={c} onClick={() => handleRowClick(c.id)} t={t} />
              ))
            )}
          </div>
        ) : (
          /* Desktop: existing table — keep unchanged */
          <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
            {/* ... existing table code ... */}
          </div>
        )}
      </div>

      {/* Desktop right panel — only on non-mobile */}
      {!isMobile && detailOpen && selectedCustomer && (
        <div className="w-[380px] bg-white border-l border-[#E8ECE4] p-5 flex flex-col gap-4 overflow-auto shrink-0">
          {/* ... existing desktop detail panel code, but with full reservation list ... */}
        </div>
      )}
    </div>

    {/* Mobile full-screen detail overlay */}
    {isMobile && detailOpen && selectedCustomer && (
      <CustomerDetailMobile
        customer={selectedCustomer}
        notes={notes}
        noteSaving={noteSaving}
        noteSaved={noteSaved}
        onNoteChange={(value) => setNotes(prev => ({ ...prev, [selectedCustomer.id]: value }))}
        onSaveNote={() => handleSaveNote(selectedCustomer.id)}
        onClose={() => setDetailOpen(false)}
        onViewReservation={() => router.push('/admin/reservations')}
        t={t}
        STATUS_COLORS={STATUS_COLORS}
      />
    )}
  </>
)
```

**Step 6: Remove 5-item limit in desktop detail panel**

In the desktop detail panel, change:
```typescript
{selectedCustomer.reservations.slice(0, 5).map((r, i) => (
```
to:
```typescript
{selectedCustomer.reservations.map((r, i) => (
```

Remove the "show more" button since all items are now shown.

Wrap the reservations list in a scrollable container:
```typescript
<div className="max-h-48 overflow-y-auto">
  {/* reservation items */}
</div>
```

**Step 7: Make desktop reservation rows clickable**

Add click handler to each reservation row in the desktop detail:
```typescript
<div
  key={i}
  onClick={() => router.push('/admin/reservations')}
  className="flex items-center justify-between text-xs cursor-pointer hover:bg-[#F8F7F4] rounded-lg py-1.5 px-1.5 -mx-1.5"
>
```

**Step 8: Remove `.slice(0, 10)` cap in data computation**

In the `customers` useMemo (around line 207), change:
```typescript
reservations: sorted.slice(0, 10).map(r => ({
```
to:
```typescript
reservations: sorted.map(r => ({
```

**Step 9: Add CANCELLED_PENDING_REFUND to STATUS_COLORS**

```typescript
const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'text-[#6B7F5E]',
  Completed: 'text-[#1A1208]',
  Cancelled: 'text-[#DC3545]',
  'Pending Refund': 'text-[#DC3545]',
  Pending: 'text-[#C47D52]',
  Submitted: 'text-[#C47D52]',
}
```

And in the status label mapping (line 209), add:
```typescript
: r.status === 'CANCELLED_PENDING_REFUND' ? 'Pending Refund'
```

**Step 10: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 11: Commit**

```bash
git add src/app/\(admin\)/admin/customers/page.tsx
git commit -m "feat: customer page — mobile cards, full-screen detail, full history, clickable reservations"
```

---

## Task 11: Final Verification

**Step 1: Full build check**

```bash
cd next-app && npm run build
```

Ensure 0 errors. Fix any type errors from the new enum value propagation (check any other files that reference `ReservationStatus` as a string union).

**Step 2: Search for hardcoded status lists that may need updating**

```bash
grep -rn "CANCELLED.*EXPIRED" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Look for any arrays/conditions that list reservation statuses and need `CANCELLED_PENDING_REFUND` added. Common patterns:
- Terminal state checks: `['CANCELLED', 'EXPIRED', 'COMPLETED']` → add `'CANCELLED_PENDING_REFUND'`
- Hidden status lists: `['CANCELLED', 'EXPIRED']` → do NOT add (it should stay visible)
- Status dropdown options in forms → add if relevant

**Step 3: Check calendar and dashboard for status handling**

Verify calendar and dashboard components handle the new status gracefully (badge color fallback to gray if unrecognized is fine, but explicit support is better).

**Step 4: Fix any issues found**

Address any build errors or missing status handling.

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: ensure CANCELLED_PENDING_REFUND handled across all admin views"
```
