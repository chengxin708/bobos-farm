# Auto Room Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Real-time deterministic room assignment, admin room swap, order status in calendar, optimization suggestions, venues view-only.

**Architecture:** `tryDeterministicAssignment(date)` in `yurt-assignment.ts` runs 3 phases. `manuallyAssigned` flag locks admin overrides. Swap API for room exchange. Calendar shows order info + optimization banners.

**Tech Stack:** Prisma ORM, Next.js API routes, Jest for unit tests

**Design doc:** `docs/plans/2026-04-15-auto-assignment-design.md`

---

## Part A: Assignment Engine

### Task 1: Schema — add `manuallyAssigned` field

**Files:**
- Modify: `prisma/schema.prisma` (~line 182)

**Step 1: Add field to Reservation model**

After `yurtNotifiedAt DateTime?`, add:

```prisma
manuallyAssigned       Boolean           @default(false)
```

**Step 2: Push to DB**

Run: `npx prisma db push`

**Step 3: Generate client**

Run: `npx prisma generate`

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add manuallyAssigned field to Reservation"
```

---

### Task 2: Unit Tests for Deterministic Assignment

**Files:**
- Create: `src/lib/__tests__/yurt-assignment.test.ts`

**Step 1: Write test file**

Cover all scenarios from the design doc. Key test cases:

1. 25-28 → #1 immediately
2. ≤16 → #3 immediately
3. 17-24 alone → pending
4. 25 + 20 → cascade #2
5. 20 + 20 → Phase 3 FIFO (first→#1, second→#2)
6. 15 + 20 + 18 → #3 + Phase 3 (20→#1, 18→#2)
7. 15 + 20 → #3 assigned, 20 pending
8. Admin override preserved (manuallyAssigned skipped)
9. 15(#3) + 12 → 12 pending
10. >28 → anomaly
11. Full house: 25 + 20 + 15 → all assigned

See design doc Task 1 in previous plan version for full test code. Add `manuallyAssigned: false` to all test inputs and `manuallyAssigned: true` test for admin override.

**Step 2: Run test — verify fails**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts --no-cache`

**Step 3: Commit**

```bash
git add src/lib/__tests__/yurt-assignment.test.ts
git commit -m "test: unit tests for deterministic room assignment"
```

---

### Task 3: Implement `computeDeterministicAssignment` Pure Function

**Files:**
- Modify: `src/lib/yurt-assignment.ts`

**Step 1: Add types and function**

New types:
```typescript
export interface DeterministicReservationInput {
  id: string;
  guestCount: number;
  yurtId: string | null;
  manuallyAssigned: boolean;
  createdAt: Date;
}

export interface DeterministicResult {
  assignments: AssignmentResult[];
  pending: string[];
  anomalies: Anomaly[];
}
```

Function `computeDeterministicAssignment(availableYurts, reservations)`:
- Phase 1: Lock `manuallyAssigned` + existing yurtId. Then: 25-28→#1, ≤16→#3 if available.
- Phase 2: Single-candidate propagation loop.
- Phase 3: N pending == N candidate rooms → FIFO (createdAt ASC), biggest room first.

Key difference from old algorithm: `manuallyAssigned` reservations are locked and NEVER reassigned, even if their yurtId could theoretically be freed.

**Step 2: Run tests**

Run: `npx jest src/lib/__tests__/yurt-assignment.test.ts --no-cache`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/lib/yurt-assignment.ts
git commit -m "feat: implement computeDeterministicAssignment (3 phases)"
```

---

### Task 4: `tryDeterministicAssignment` DB Wrapper

**Files:**
- Modify: `src/lib/yurt-assignment.ts`

**Step 1: Add DB wrapper**

```typescript
export async function tryDeterministicAssignment(targetDate: Date): Promise<DeterministicResult>
```

- Fetch available yurts + active reservations (including `manuallyAssigned`, `createdAt`)
- Call `computeDeterministicAssignment`
- Write newly assigned yurtIds to DB (skip already-assigned)
- Set `yurtAssignedAt = now()` for newly assigned
- Notify admins of anomalies via push

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/yurt-assignment.ts
git commit -m "feat: add tryDeterministicAssignment DB wrapper"
```

---

### Task 5: Wire Up — Reservation Create

**Files:**
- Modify: `src/app/api/reservations/route.ts` (~line 382-407)

**Step 1: Replace T-3 block**

Replace the entire "T-3 window" block with:
```typescript
if (!requestedYurtId) {
  await tryDeterministicAssignment(reservationDate);
  // Refresh reservation to get updated yurtId
  const updated = await prisma.reservation.findUnique({ ... });
  if (updated) Object.assign(reservation, updated);
}
```

Import `tryDeterministicAssignment` at top.

**Step 2: Verify compiles, commit**

---

### Task 6: Wire Up — Cancel + T-7 Policy

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts` (cancel action ~line 150)

**Step 1: After cancel update, trigger reassignment**

```typescript
void tryDeterministicAssignment(new Date(reservation.date));
```

**Step 2: Change cancel/refund policy T-3 → T-7**

- Line ~177: `cancelDiffDays < 3` → `cancelDiffDays < 7`
- Line ~189: `diffDays >= 3` → `diffDays >= 7`

**Step 3: Commit**

---

### Task 7: Wire Up — Admin Assign/Edit/Reschedule

**Files:**
- Modify: `src/app/api/reservations/[id]/route.ts`

**Step 1: assign_yurt action — set manuallyAssigned + cascade**

In the assign_yurt handler (~line 582), add to update data:
```typescript
data: {
  yurtId: newYurtId,
  yurtAssignedAt: new Date(),
  manuallyAssigned: true,  // NEW
}
```

After update, trigger cascade:
```typescript
void tryDeterministicAssignment(new Date(reservation.date));
```

**Step 2: edit action — release old assignment if date/yurt/guestCount changed**

If admin changes guestCount or date, and the reservation was NOT manuallyAssigned, clear yurtId:
```typescript
if (!reservation.manuallyAssigned && (dateChanged || guestCountChanged)) {
  updateData.yurtId = null;
  updateData.yurtAssignedAt = null;
  updateData.manuallyAssigned = false;
}
```

After edit, trigger for affected dates:
```typescript
void tryDeterministicAssignment(new Date(updated.date));
if (dateChanged) void tryDeterministicAssignment(new Date(reservation.date));
```

**Step 3: reschedule — replace T-3 with deterministic**

Replace `checkDateAnomalies` + T-3 conditional with:
```typescript
void tryDeterministicAssignment(new Date(reservation.date)); // old date
void tryDeterministicAssignment(newReservationDate); // new date
```

**Step 4: Commit**

---

### Task 8: Cron T-3 → T-7

**Files:**
- Modify: `src/app/api/cron/assign-yurts/route.ts`

**Step 1: Change offset**

Line 22: `+ 3` → `+ 7`
Line 18: update comment

**Step 2: Commit**

---

## Part B: Room Swap API

### Task 9: Swap Endpoint

**Files:**
- Create: `src/app/api/reservations/swap/route.ts`

**Step 1: Create POST handler**

```typescript
// POST /api/reservations/swap
// Body: { reservationIdA: string, reservationIdB: string }
// Auth: admin only
// Validates: both on same date, both have yurtId assigned
// Action: swap yurtIds atomically, set manuallyAssigned=true on both
// After swap: void tryDeterministicAssignment(date) for cascade
```

**Step 2: Commit**

---

## Part C: Calendar Enhancements

### Task 10: Include Order Data in Reservation API

**Files:**
- Modify: `src/app/api/reservations/route.ts` (GET handler)
- Modify: `src/app/api/reservations/[id]/route.ts` (GET handler)

**Step 1: Add order include to reservation queries**

In the GET handler's Prisma query, add to `include`:
```prisma
order: { select: { status: true, estimatedTotal: true, finalTotal: true } }
```

Also update the calendar-specific query if separate.

**Step 2: Update Reservation interfaces in calendar components**

Add to the `Reservation` interface in `CalendarDesktop.tsx` and `CalendarMobile.tsx`:
```typescript
order?: { status: string; estimatedTotal: number | null; finalTotal: number | null } | null
```

**Step 3: Commit**

---

### Task 11: Display Order Status in Calendar Cards

**Files:**
- Modify: `src/components/admin/calendar/CalendarDesktop.tsx`
- Modify: `src/components/admin/calendar/CalendarMobile.tsx`

**Step 1: Add order status to reservation cards**

In the `renderReservationCard` function (Desktop) and yurt card rendering (Mobile), after guest count line, add:

```tsx
{res.order && (
  <div className="text-[10px] mt-0.5" style={{ color: res.order.status === 'PAID' ? '#5B8C3E' : '#E67E22' }}>
    {res.order.status === 'DRAFT' ? '📝' : res.order.status === 'PAID' ? '✅' : '🍽'}
    {' '}
    {res.order.finalTotal != null
      ? `$${res.order.finalTotal}`
      : res.order.estimatedTotal != null
        ? `$${res.order.estimatedTotal}`
        : t('orderDraft')}
  </div>
)}
```

**Step 2: Add i18n keys**

Add to `admin.calendar` in both zh.json and en.json:
```json
"orderDraft": "草稿" / "Draft"
"orderPlaced": "已点单" / "Ordered"  
"orderPaid": "已结账" / "Paid"
```

**Step 3: Commit**

---

### Task 12: Swap UI in Calendar

**Files:**
- Modify: `src/components/admin/calendar/CalendarDesktop.tsx`
- Modify: `src/components/admin/calendar/CalendarMobile.tsx`

**Step 1: Add swap button to assigned reservation cards**

Each assigned reservation card gets a small swap icon (ArrowLeftRight from lucide). Clicking enters "swap mode":
1. First click: select source reservation (highlight it)
2. Second click on another assigned reservation on same date: confirm swap
3. Call `POST /api/reservations/swap` → refresh data

**Step 2: Add swap state management**

```typescript
const [swapSourceId, setSwapSourceId] = useState<string | null>(null)
```

**Step 3: Add i18n keys**

```json
"swapRoom": "互换包房" / "Swap Room"
"swapSelect": "选择要互换的预约" / "Select reservation to swap with"
"swapCancel": "取消互换" / "Cancel swap"
"swapSuccess": "包房互换成功" / "Room swap successful"
```

**Step 4: Commit**

---

### Task 13: Optimization Suggestion Banner

**Files:**
- Modify: `src/lib/yurt-assignment.ts`
- Modify: `src/components/admin/calendar/CalendarDesktop.tsx`
- Modify: `src/components/admin/calendar/CalendarMobile.tsx`

**Step 1: Add `computeOptimizationSuggestion` function**

Pure function: takes current assignments, runs BFD, compares waste. Returns suggestion if better arrangement exists.

```typescript
export function computeOptimizationSuggestion(
  availableYurts: YurtInput[],
  currentAssignments: { reservationId: string; yurtId: string; guestCount: number }[]
): { current: number; suggested: number; moves: { reservationId: string; fromYurtId: string; toYurtId: string }[] } | null
```

Returns null if current is already optimal.

**Step 2: Compute in calendar component**

In the calendar component, after loading reservations, compute suggestions per date. Show a yellow banner at the top of dates that have suggestions:

```tsx
{suggestion && (
  <div className="bg-[#FFF8E1] border border-[#E8B730]/30 rounded-lg px-3 py-2 text-[11px] text-[#92400E]">
    💡 {t('optimizationAvailable')}
    <button onClick={() => handleApplySuggestion(date)}>{t('apply')}</button>
  </div>
)}
```

**Step 3: Add i18n keys**

```json
"optimizationAvailable": "发现更优分配方案" / "Better assignment available"
"applySuggestion": "应用建议" / "Apply suggestion"
"currentWaste": "当前浪费" / "Current waste"
"suggestedWaste": "建议浪费" / "Suggested waste"
```

**Step 4: Commit**

---

## Part D: Venues View-Only

### Task 14: Remove Edit/Delete from Venues Page

**Files:**
- Modify: `src/app/(admin)/admin/venues/page.tsx`

**Step 1: Remove create/edit/delete UI**

- Remove "Add Yurt" / "新建" button
- Remove edit icon/button on each yurt card
- Remove delete button/action
- Remove the create/edit modal
- Keep the read-only display of rooms (name, alias, capacity, status)

**Step 2: Commit**

```bash
git add src/app/(admin)/admin/venues/page.tsx
git commit -m "feat(admin): make venues page view-only, remove edit/delete"
```

---

## Part E: Final Integration

### Task 15: Full Test & Manual Verification

**Step 1: Run unit tests**

```bash
npx jest --no-cache
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Manual test scenarios**

1. Create 26-person reservation → auto-assign #1
2. Create 15-person on same date → auto-assign #3
3. Create 20-person on same date → cascade to #2
4. Cancel 26-person → #1 freed, others stay
5. Create two 20-person on new date → Phase 3: first→#1, second→#2
6. Admin swap #1 ↔ #2 → both locked, cards show updated rooms
7. Verify optimization banner appears when swap creates suboptimal arrangement
8. Verify order status shows on calendar cards
9. Verify venues page is view-only
10. Verify cancel/refund uses T-7 policy

**Step 4: Push**

```bash
git push origin main
```
