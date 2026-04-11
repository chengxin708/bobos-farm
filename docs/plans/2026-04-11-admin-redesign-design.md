# Admin Redesign: PWA + Frontend-Style Unified UI

**Date:** 2026-04-11
**Status:** Approved
**Scope:** Admin backend complete visual + structural overhaul

---

## Decision Summary

- Abandon sidebar layout entirely
- Adopt customer frontend's Navbar + BottomTabs pattern
- Build as PWA with separate mobile/desktop components for complex pages
- Unify visual language with customer frontend (cream/olive-green/organic)

---

## 1. Navigation Structure

### Mobile BottomTabs (5 tabs)

| Position | Label | Icon | Content |
|----------|-------|------|---------|
| 1 | Home | `LayoutDashboard` | Dashboard |
| 2 | Bookings | `CalendarCheck` | Reservations (with SegmentedControl: All / Deposits / Pre-orders) |
| 3 | Menu | `UtensilsCrossed` | Menu management |
| 4 | Calendar | `Calendar` | Calendar views |
| 5 | More | `MoreHorizontal` | Venue Mgmt, Customers, Reports, Settings |

### Desktop Navbar

```
[Logo "管理"] [Home] [Bookings ▾] [Menu] [Calendar] [Ops ▾] ── [🔔] [Lang] [Avatar]

Bookings ▾           Ops ▾
├── All Reservations  ├── Venue Management
├── Pending Deposits  ├── Customers
└── Pre-orders        └── Reports
```

- 2px `#6B7F5E` accent line below navbar (admin identifier)
- "管理" label next to logo
- Settings accessible via avatar dropdown

### Page Merges

- **Deposits + Orders → Reservations sub-views** (SegmentedControl)
- **Yurts + Availability → "Venue Management"** (top tabs within page)

### Navigation Depth: Max 3 levels

```
L0: BottomTabs / Navbar
L1: List pages (reservations list, menu list, "More" page)
L2: Detail/edit pages (← back to previous)
```

- Mobile: `← Back` arrow in TopBar, no breadcrumbs
- BottomTabs always visible at all levels

---

## 2. Visual Design System (Admin variant)

| Element | Customer Frontend | Admin Backend |
|---------|------------------|---------------|
| Background | `#F8F7F4` | `#F8F7F4` (same) |
| Primary | `#6B7F5E` olive green | `#6B7F5E` (same) |
| Card spacing | 16-24px | **12-16px** (compact) |
| Card radius | `rounded-2xl` | **`rounded-xl`** (slightly smaller) |
| Fonts | Playfair Display + Lato | Same |
| Min button height | 44px | **44px** (outdoor usability) |
| Status colors | Light tags | **High contrast**: red `#DC3545`, green `#5B8C3E`, orange `#E67E22`, blue `#2980B9` |
| Number display | Lato | **Lato tabular-nums** (aligned numerals) |

---

## 3. Layout Shells

### Mobile Layout

```
TopBar (44px): page title + back arrow (L2) + notification bell
Content area: flex-1, overflow-y-auto
BottomTabs (64px + safe-area-bottom)
```

### Desktop Layout

```
Navbar (64px): logo + nav links + dropdowns + bell + lang + avatar
2px accent line (#6B7F5E)
Content area: max-w-[1400px] centered, padding
```

---

## 4. Page Designs

### 4.1 Dashboard — TWO COMPONENTS

**Mobile (`DashboardMobile.tsx`):**
- Single column scroll
- 2x2 KPI stat cards (today reservations, pending deposits, pending orders, monthly revenue)
- "Action Required" section: swipeable cards for pending deposits (approve/reject inline)
- Today's bookings: simple card list
- Recent activity: timeline

**Desktop (`DashboardDesktop.tsx`):**
- Greeting banner with action buttons (+ New Reservation, View Calendar)
- 4-column KPI grid
- 60/40 split: week overview matrix (left) + action required list (right)
- Below: today's reservations table (left) + activity timeline (right)

### 4.2 Reservations — TWO COMPONENTS

**Mobile (`ReservationsMobile.tsx`):**
- SegmentedControl: All / Pending Deposits / Pre-orders
- Search bar + date filter
- Horizontal scrolling status chips
- Card list (each card: name, date, yurt, guest count, status badge, deposit badge)
- Tap card → full-screen slide-in detail page (push navigation)
- Detail page: all reservation info + guest info + payment + pre-order + activity timeline
- Bottom action buttons: Confirm / Complete / Cancel

**Desktop (`ReservationsDesktop.tsx`):**
- Same SegmentedControl + filters
- Full-width table (columns: guest, date, yurt, guests, status, deposit, action)
- Click row → right-side drawer (400px) with full detail
- Batch operations: checkbox selection → floating action bar

### 4.3 Calendar — TWO COMPONENTS

**Mobile (`CalendarMobile.tsx`):**
- Week selector (swipeable)
- Day dots indicating bookings
- Selected date → vertical list of yurts with booking status
- Each yurt shows: booked (card with guest info) or available

**Desktop (`CalendarDesktop.tsx`):**
- Full-width yurt × date matrix (week/month view toggle)
- Color-coded cells: available/pending/confirmed/completed
- Click cell → right-side drawer with booking detail
- Legend bar at bottom

### 4.4 Responsive Pages (ONE COMPONENT each)

**Menu Management:**
- Mobile: single-column card list + full-screen edit form
- Desktop: two-column (list + edit panel) via responsive flex
- Image upload: mobile supports camera capture (`capture="environment"`)

**Venue Management (Yurts + Availability merged):**
- Top tabs: "Yurts" | "Availability"
- Mobile: single column
- Desktop: wider table/grid

**Customers:**
- Mobile: card list → tap for detail
- Desktop: table + side detail
- Responsive flex layout

**Reports:**
- Recharts responsive containers
- Mobile: stacked vertical
- Desktop: 2-column grid

**Settings:**
- Mobile: full-width form
- Desktop: centered form (max-w-2xl)

**"More" page (mobile only):**
- Simple list menu linking to: Venue Mgmt, Customers, Reports, Settings
- Not rendered on desktop (navbar handles navigation)

---

## 5. PWA Features

| Feature | Implementation |
|---------|---------------|
| Offline cache | Service Worker caches today's reservations + static assets. Yellow banner when offline. |
| Pull-to-refresh | Enabled on list pages (reservations, orders, customers) |
| Push notifications | 3 scenarios: new reservation, deposit pending review, today's check-in reminder. Toggle in Settings. |
| Install prompt | One-time guidance after first login |
| Optimistic updates | Confirm/reject actions apply locally first, sync when back online |

---

## 6. Component Architecture

### Dual-component pages (3 pages)

Use `useIsMobile()` hook (breakpoint: `md:768px`) to switch between components:

```
src/components/admin/
├── dashboard/
│   ├── DashboardMobile.tsx
│   └── DashboardDesktop.tsx
├── reservations/
│   ├── ReservationsMobile.tsx
│   ├── ReservationsDesktop.tsx
│   └��─ ReservationDetail.tsx (shared)
├── calendar/
│   ├── CalendarMobile.tsx
│   └── CalendarDesktop.tsx
```

### Shared components

```
src/components/admin/
├── AdminNavbar.tsx (desktop)
├── AdminBottomTabs.tsx (mobile)
├── AdminTopBar.tsx (mobile page headers)
├── NotificationBell.tsx
├── StatusBadge.tsx (high-contrast status badges)
└── useIsMobile.ts (hook)
```

### Responsive pages (no split needed)

```
src/app/(admin)/admin/
├── menu/page.tsx
├── venues/page.tsx (merged yurts + availability)
├── customers/page.tsx
├── reports/page.tsx
├── settings/page.tsx
└── more/page.tsx (mobile-only navigation page)
```

---

## 7. Key Interaction Patterns

- **Mobile detail pages:** Full-screen slide-in from right (not modal)
- **Desktop detail panels:** Right-side drawer (400px), page content shifts
- **Destructive actions:** Always require confirmation dialog
- **Status changes:** Color + text dual encoding (not icon-only)
- **Mobile swipe gestures:** Swipe-to-action on pending deposit cards (Dashboard)
- **Desktop batch operations:** Checkbox + floating action bar above table
- **First-time onboarding:** 3-step tooltip tour for new admin users
