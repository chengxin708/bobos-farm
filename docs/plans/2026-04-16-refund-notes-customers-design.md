# Design: Refund Status, Reservation Notes, Customer Page Optimization

**Date:** 2026-04-16
**Scope:** 3 features — CANCELLED_PENDING_REFUND status, admin reservation notes, customer management page UX

---

## Feature 1: CANCELLED_PENDING_REFUND Status

### Problem

When a reservation with a confirmed deposit is cancelled, it immediately moves to `CANCELLED` (terminal state) and disappears from the active view. The admin must remember to process the refund — but the system provides no reminder or tracking. Refunds get forgotten.

### Solution

New `CANCELLED_PENDING_REFUND` enum value in `ReservationStatus`. Cancelled reservations with confirmed deposits that are refund-eligible enter this intermediate state instead of going directly to `CANCELLED`. They remain visible in the active view until the refund is processed.

### State Machine

```
CONFIRMED ──cancel(deposit CONFIRMED + refundEligible)──→ CANCELLED_PENDING_REFUND
CONFIRMED ──cancel(no deposit / not eligible)───────────→ CANCELLED
CONFIRMED ──cancel + mark refunded (one-step)───────────→ CANCELLED (depositStatus=REFUNDED)

CANCELLED_PENDING_REFUND ──admin marks refunded──→ CANCELLED (depositStatus=REFUNDED)
```

### Cancel Dialog Enhancement

When cancelling a reservation with `depositStatus === 'CONFIRMED'` and refund-eligible:

- Dialog message: "该预约押金 $X 已确认，取消后将进入待退款状态。"
- **Primary button**: "取消预约" → `CANCELLED_PENDING_REFUND`
- **Secondary button**: "取消并标记已退款" → `CANCELLED` + `depositStatus=REFUNDED` (for cases where refund was already processed externally)
- **Cancel button**: "返回"

When deposit is not confirmed or not refund-eligible: existing dialog unchanged.

### List View Changes

**Action alert banner** (alongside existing pending deposits / held by admin):
- Red-tinted pill: `#DC3545` scheme, `RefreshCcw` icon, "X 笔待退款"
- Clicks to set filter to `pending-refund`

**New filter chip** "待退款":
```
待处理 (N) | 待退款 (N) | 已确认 (N) | 已完成 (N) | 全部
```

- `CANCELLED_PENDING_REFUND` included in `actionNeededCount`
- Separate `pendingRefundCount` for the dedicated chip
- New `FilterMode` value: `'pending-refund'`

**Card for CANCELLED_PENDING_REFUND**:
- Status badge: red background "待退款"
- Shows deposit amount: "退款 $300"
- Inline action button: "标记已退款" (same pattern as PAYMENT_SUBMITTED inline confirm)

**Active view**: `CANCELLED_PENDING_REFUND` NOT in `HIDDEN_STATUSES` — stays visible until refund processed.

### Detail Panel Changes

When `status === 'CANCELLED_PENDING_REFUND'`:

- **Status badge**: "已取消·待退款"
- **Cancellation info section** (below payment info): cancel date, cancel reason, refund amount (prominent), customer payment reference/screenshot
- **Bottom actions**: Only "标记已退款" (primary green) + "关闭" — no edit, no re-cancel
- **Terminal state behavior**: Cannot edit, cannot cancel again. Only refund action available.

### After Refund

1. `status` → `CANCELLED`, `depositStatus` → `REFUNDED`
2. Activity log: `DEPOSIT_REFUNDED`
3. Email notification to customer (existing `sendDepositRefunded` flow)
4. Reservation moves from active view to history

### Customer-Facing

Customers see "Cancelled" for both `CANCELLED` and `CANCELLED_PENDING_REFUND`. The refund-pending distinction is admin-internal only.

### Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `CANCELLED_PENDING_REFUND` to `ReservationStatus` enum |
| `src/app/api/reservations/[id]/route.ts` | Cancel action: set new status when conditions met; PATCH: sync status on refund; new `cancel_and_refund` action |
| `src/components/admin/reservations/useReservationsData.ts` | New filter mode, counts, badge, active view logic |
| `src/components/admin/reservations/ReservationsMobile.tsx` | Alert pill, filter chip, card inline button |
| `src/components/admin/reservations/ReservationsDesktop.tsx` | Same changes for desktop |
| `src/components/admin/reservations/ReservationDetail.tsx` | Cancel dialog enhancement, refund action button, cancellation info section |
| i18n JSON files | New status/action labels |
| `src/app/(admin)/admin/customers/page.tsx` | Add CANCELLED_PENDING_REFUND to status type |

---

## Feature 2: Reservation Notes (Admin)

### Problem

Admins need to record internal notes about reservations (e.g., "客人对花生过敏", "VIP 朋友介绍", "需要额外椅子"). Currently there's no way to do this. `specialRequests` is customer-facing and set at booking time.

### Solution

New `ReservationNote` model — admin-only, multiple notes per reservation, timestamped with author.

### Data Model

```prisma
model ReservationNote {
  id            String   @id @default(cuid())
  reservationId String
  userId        String
  content       String
  pinned        Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  reservation Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("reservation_notes")
}
```

Add to `Reservation` model: `notes ReservationNote[]`
Add to `User` model: `reservationNotes ReservationNote[]`

### API

**GET `/api/reservations/[id]/notes`** — List notes for a reservation (admin only)
**POST `/api/reservations/[id]/notes`** — Create note (admin only, body: `{ content: string }`)
**PATCH `/api/reservations/[id]/notes/[noteId]`** — Edit note content or toggle pin (admin only)
**DELETE `/api/reservations/[id]/notes/[noteId]`** — Delete note (admin only)

### UI — Detail Panel

New tab "Notes" alongside existing "Info" and "Pre-order" tabs:

```
Info | Pre-order | Notes (N)
```

Tab shows count badge if notes exist.

Notes tab content:
- **Add note input** at top: textarea + "添加" button
- **Notes list**: chronological (newest first), each note shows:
  - Content text
  - Author name + timestamp
  - Pin/unpin toggle (pinned notes float to top)
  - Edit/delete actions (on hover or tap)
- **Pinned notes** appear first with a subtle pin indicator

Notes are available for ALL reservation statuses (including CANCELLED, COMPLETED) — you might need to note why something was cancelled, or record post-visit feedback.

### Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | New `ReservationNote` model + relations |
| `src/app/api/reservations/[id]/notes/route.ts` | New: GET + POST |
| `src/app/api/reservations/[id]/notes/[noteId]/route.ts` | New: PATCH + DELETE |
| `src/components/admin/reservations/ReservationDetail.tsx` | New "Notes" tab, note list/add/edit/delete UI |
| i18n JSON files | Note-related labels |

---

## Feature 3: Customer Page Optimization

### Problem 1: Mobile detail panel broken

Customer detail uses a 380px right panel — same layout on both desktop and mobile. On phones this panel either overflows or pushes content off screen. Every other admin page (reservations, calendar) uses full-screen overlay on mobile.

### Problem 2: Incomplete reservation history

Detail panel only shows 5 reservations. "Show more" button has no real functionality. Admin cannot view a customer's full history or navigate to specific reservations.

### Problem 3: Customers buried in "More"

Bottom tabs: Home, Bookings, Calendar, More. Customers requires 2 taps (More → Customers). For a restaurant, customer management is a primary workflow.

### Solution A: Bottom nav — 5 tabs

```
Home | Bookings | Calendar | Customers | More
```

- Add `Users` icon tab for Customers
- Remove Customers entry from More page (avoid duplication)
- 5 tabs is standard mobile pattern (Instagram, WeChat, Uber)

### Solution B: Mobile list — table to cards

Current: 7-column table with `min-w-[640px]` requiring horizontal scroll on phones.

New card layout:
```
┌──────────────────────────────────┐
│  [Avatar] Name             [Tag] │
│           email@example.com      │
│           6 visits · Last Jan 15 │
└──────────────────────────────────┘
```

Reuses existing filter chips and search bar. Card tap → full-screen detail.

### Solution C: Mobile detail — full-screen overlay

Match `ReservationsMobile.tsx` pattern: `fixed inset-0 z-50 bg-white flex flex-col`.

Content (scrollable):
1. **Header**: "← 客户详情" with back button
2. **Profile**: Avatar (56px), name, email, phone, member since, tag badge
3. **Stats grid**: 4-column grid (visits, spent, cancel rate, cancels)
4. **Reservation history** (full): ALL reservations, newest first. Each row is tappable — navigates to `/admin/reservations?open={reservationId}` to open that reservation's detail panel
5. **Admin notes**: textarea + save (existing functionality)

### Solution D: Desktop detail enhancement

Keep existing left-table + right-panel layout. Enhance panel:
- Show ALL reservations (remove 5-item limit, add scroll area)
- Each reservation row clickable → navigates to reservation detail
- Everything else stays the same

### Architecture

Extract customer detail into a shared component used by both desktop panel and mobile overlay:

```
CustomerDetailContent.tsx  — shared data/layout logic
├── Used by desktop: inline in page.tsx right panel
└── Used by mobile: wrapped in full-screen overlay
```

Mobile list view: conditionally render cards (< md) vs table (md+).

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/AdminBottomTabs.tsx` | Add 5th tab: Customers |
| `src/app/(admin)/admin/more/page.tsx` | Remove Customers link |
| `src/app/(admin)/admin/customers/page.tsx` | Responsive split: mobile cards + full-screen detail, desktop table + panel |
| New: `src/components/admin/customers/CustomerDetailContent.tsx` | Shared detail content component |
| i18n JSON files | New labels for nav tab, mobile card layout |

---

## Implementation Order

1. **Schema + Migration**: Add `CANCELLED_PENDING_REFUND` enum + `ReservationNote` model
2. **API layer**: Cancel action logic, refund action, note CRUD endpoints
3. **Reservation UI**: Cancel dialog, list view (alerts, filters, cards), detail panel (refund section, notes tab)
4. **Customer page**: Bottom nav change, mobile card list, full-screen detail, full history with navigation
5. **i18n**: All new strings in EN + ZH
