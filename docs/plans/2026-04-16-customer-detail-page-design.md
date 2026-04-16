# Design: Customer Detail Independent Page

**Date:** 2026-04-16

---

## Overview

Replace the current customer detail side panel/overlay with an independent page at `/admin/customers/[id]`. The customer's reservation history is displayed inline on this page, split into "upcoming" and "history" groups. Clicking a reservation opens the existing `ReservationDetail` panel.

## Customer List Page Changes (`/admin/customers`)

- Remove the 380px right side panel (desktop) and full-screen overlay (mobile)
- Remove all detail-related state: `detailOpen`, `selectedId`, `notes`, `noteSaving`, `noteSaved`
- Remove `CustomerDetailMobile` component
- Table row click (desktop) and card click (mobile) → `router.push(/admin/customers/${id})`

## Customer Detail Page (`/admin/customers/[id]`)

New page with the following sections:

### Header
- Back button "← 返回客户列表" → navigates to `/admin/customers`
- Page title "客户详情"

### Profile Section
- Avatar (initials, color-coded), name, email, phone, member since, tag badge (VIP/Regular)

### Stats Grid
- 4-column: total visits, total spent, cancel rate, cancel count

### Admin Notes
- Textarea + save button (existing pattern from customer page)
- Uses existing `/api/customers/[id]/notes` endpoint

### Reservation History
- **Data source**: New API endpoint `/api/customers/[id]/reservations` returns all reservations for this customer with yurt and order data
- **Two groups**:
  - **Upcoming**: date >= today, exclude CANCELLED/CANCELLED_PENDING_REFUND/EXPIRED, sorted ascending
  - **History**: date < today OR CANCELLED/CANCELLED_PENDING_REFUND/EXPIRED, sorted descending, collapsed by default
- **Each row shows**: date, yurt name, guest count, status badge
- **Click a row** → opens ReservationDetail side panel (desktop) or full-screen overlay (mobile)
- Reuses existing `ReservationDetail` component with full functionality (info, pre-order, notes tabs)

### Reservation Detail Panel
- Desktop: 400px right side panel (same as reservations page)
- Mobile: full-screen overlay (same as reservations page)
- All existing actions available: confirm deposit, cancel, mark refunded, complete, etc.

## New API Endpoint

**GET `/api/customers/[id]/reservations`** — Admin only
- Returns all reservations for the given userId
- Includes: user, yurt, order (with items for pre-order tab)
- Sorted by date descending

## Files

| File | Action |
|------|--------|
| `src/app/(admin)/admin/customers/page.tsx` | Simplify: remove detail panel/overlay, click → navigate |
| `src/app/(admin)/admin/customers/[id]/page.tsx` | New: customer detail page |
| `src/app/api/customers/[id]/reservations/route.ts` | New: GET reservations for customer |
| i18n messages | Add new strings for customer detail page |
