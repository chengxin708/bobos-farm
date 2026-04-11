# Admin Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the admin backend from sidebar layout to PWA-ready Navbar+BottomTabs with unified frontend visual style, separate mobile/desktop components for complex pages.

**Architecture:** Replace the sidebar+TopBar shell with a responsive layout using `useIsMobile()` hook to render either AdminNavbar (desktop) or AdminBottomTabs+AdminTopBar (mobile). Complex pages (Dashboard, Reservations, Calendar) get separate mobile/desktop component files. Simpler pages become responsive. Deposits and Orders merge into Reservations as SegmentedControl views. Yurts and Availability merge into Venues page.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, framer-motion, SWR, Recharts, Lucide React, next-intl

**Design doc:** `docs/plans/2026-04-11-admin-redesign-design.md`

**Existing admin code:** ~7,348 lines across 15 files. All business logic (SWR fetches, API calls, action handlers) is preserved and extracted into the new component structure.

---

## Phase 1: Foundation — Layout Shell + Shared Components

### Task 1.1: Create `useIsMobile` hook

**Files:**
- Create: `src/hooks/useIsMobile.ts`

**Step 1: Create the hook**

```ts
'use client'

import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    setIsMobile(mql.matches)

    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches)
    }

    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
```

**Step 2: Commit**

```bash
git add src/hooks/useIsMobile.ts
git commit -m "feat(admin): add useIsMobile hook for responsive component switching"
```

---

### Task 1.2: Create `StatusBadge` shared component

**Files:**
- Create: `src/components/admin/StatusBadge.tsx`

**Step 1: Create high-contrast status badge**

This replaces the scattered STATUS_BADGE/DEPOSIT_BADGE maps across admin pages with one shared component. Uses the high-contrast colors from the design doc.

```tsx
'use client'

const RESERVATION_STATUS = {
  PENDING_PAYMENT:   { bg: 'bg-[#E67E22]/15', text: 'text-[#E67E22]' },
  PAYMENT_SUBMITTED: { bg: 'bg-[#E67E22]/20', text: 'text-[#E67E22]' },
  CONFIRMED:         { bg: 'bg-[#2980B9]/15', text: 'text-[#2980B9]' },
  COMPLETED:         { bg: 'bg-[#5B8C3E]/15', text: 'text-[#5B8C3E]' },
  CANCELLED:         { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
  EXPIRED:           { bg: 'bg-[#8C8478]/10', text: 'text-[#8C8478]' },
} as const

const DEPOSIT_STATUS = {
  UNPAID:    { bg: 'bg-[#8C8478]/10', text: 'text-[#8C8478]' },
  PENDING:   { bg: 'bg-[#E67E22]/15', text: 'text-[#E67E22]' },
  CONFIRMED: { bg: 'bg-[#5B8C3E]/15', text: 'text-[#5B8C3E]' },
  REFUNDED:  { bg: 'bg-[#2980B9]/15', text: 'text-[#2980B9]' },
} as const

interface StatusBadgeProps {
  type: 'reservation' | 'deposit'
  status: string
  label: string
}

export default function StatusBadge({ type, status, label }: StatusBadgeProps) {
  const map = type === 'reservation' ? RESERVATION_STATUS : DEPOSIT_STATUS
  const style = map[status as keyof typeof map] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
      {label}
    </span>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/admin/StatusBadge.tsx
git commit -m "feat(admin): add shared StatusBadge component with high-contrast colors"
```

---

### Task 1.3: Create `NotificationBell` component

**Files:**
- Create: `src/components/admin/NotificationBell.tsx`

**Step 1: Create bell with badge**

```tsx
'use client'

import { Bell } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : [])

export default function NotificationBell() {
  // Count pending deposits as notifications
  const { data: pending } = useSWR('/api/reservations?status=PAYMENT_SUBMITTED', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const count = Array.isArray(pending) ? pending.length : 0

  return (
    <button className="relative flex items-center justify-center w-9 h-9 rounded-full bg-transparent border-0 cursor-pointer transition-colors hover:bg-[#E8ECE4]">
      <Bell size={20} className="text-[#1A1208]" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#DC3545] text-white text-[10px] font-bold px-1">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/admin/NotificationBell.tsx
git commit -m "feat(admin): add NotificationBell with pending deposit count"
```

---

### Task 1.4: Create `AdminBottomTabs` (mobile navigation)

**Files:**
- Create: `src/components/admin/AdminBottomTabs.tsx`

**Step 1: Create mobile bottom tabs**

Model after existing `src/components/customer/BottomTabs.tsx` but with admin navigation.

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarCheck, UtensilsCrossed, Calendar, MoreHorizontal } from 'lucide-react'

const tabs = [
  { key: 'home', href: '/admin/dashboard', icon: LayoutDashboard, label: '首页' },
  { key: 'bookings', href: '/admin/reservations', icon: CalendarCheck, label: '预订' },
  { key: 'menu', href: '/admin/menu', icon: UtensilsCrossed, label: '菜单' },
  { key: 'calendar', href: '/admin/calendar', icon: Calendar, label: '日历' },
  { key: 'more', href: '/admin/more', icon: MoreHorizontal, label: '更多' },
]

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard' || pathname === '/admin'
  return pathname.startsWith(href)
}

export default function AdminBottomTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="h-16 bg-[#F8F7F4] border-t border-[#E8ECE4] safe-area-bottom md:hidden"
      aria-label="Admin bottom navigation"
    >
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-2">
        {tabs.map(({ key, href, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full no-underline transition-colors ${
                active ? 'text-[#6B7F5E]' : 'text-[#8C8478]'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[11px] leading-tight">
                {tabs.find(t => t.key === key)?.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/admin/AdminBottomTabs.tsx
git commit -m "feat(admin): add AdminBottomTabs for mobile navigation"
```

---

### Task 1.5: Create `AdminTopBar` (mobile page header)

**Files:**
- Create: `src/components/admin/AdminTopBar.tsx`

**Step 1: Create mobile top bar**

Replaces the old TopBar. On mobile: shows back arrow (on L2 pages) + title + notification bell. Hidden on desktop (navbar handles it).

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import NotificationBell from './NotificationBell'

interface AdminTopBarProps {
  title: string
  showBack?: boolean
  backHref?: string
}

export default function AdminTopBar({ title, showBack, backHref }: AdminTopBarProps) {
  const router = useRouter()

  return (
    <header className="h-11 bg-[#F8F7F4] flex items-center justify-between px-4 shrink-0 md:hidden">
      {/* Left: back button or spacer */}
      <div className="w-9">
        {showBack && (
          <button
            onClick={() => backHref ? router.push(backHref) : router.back()}
            className="flex items-center justify-center w-9 h-9 -ml-2 rounded-full bg-transparent border-0 cursor-pointer"
          >
            <ChevronLeft size={22} className="text-[#1A1208]" />
          </button>
        )}
      </div>

      {/* Center: title */}
      <h1 className="text-base font-semibold text-[#1A1208] font-serif truncate">
        {title}
      </h1>

      {/* Right: notification bell */}
      <NotificationBell />
    </header>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/admin/AdminTopBar.tsx
git commit -m "feat(admin): add AdminTopBar for mobile page headers"
```

---

### Task 1.6: Create `AdminNavbar` (desktop navigation)

**Files:**
- Create: `src/components/admin/AdminNavbar.tsx`

**Step 1: Create desktop navbar**

Model after `src/components/customer/Navbar.tsx` structure. Has: Logo + "管理" label, nav links with dropdown menus, notification bell, language toggle, avatar dropdown. 2px olive-green accent line at bottom.

Key references:
- Language toggle logic: copy from existing `src/components/admin/TopBar.tsx:68-89`
- Avatar dropdown: copy from existing `src/components/admin/TopBar.tsx:96-159`
- Dropdown hover pattern: desktop-only, on mouseEnter/mouseLeave with 200ms delay

Navigation structure:
```
[Logo 管理] [首页] [预订管理 ▾] [菜单管理] [日历] [运营 ▾] ── [🔔] [EN/中] [👤]

预订管理 ▾           运营 ▾
├── 全部预订          ├── 场地管理
├── 待审定金          ├── 客户管理
└── 预点单            └── 数据报表
```

Links mapping:
- 首页 → `/admin/dashboard`
- 全部预订 → `/admin/reservations`
- 待审定金 → `/admin/reservations?view=deposits`
- 预点单 → `/admin/reservations?view=orders`
- 菜单管理 → `/admin/menu`
- 日历 → `/admin/calendar`
- 场地管理 → `/admin/venues`
- 客户管理 → `/admin/customers`
- 数据报表 → `/admin/reports`
- 设置 → via avatar dropdown

The full AdminNavbar component should be ~200 lines. Port the language toggle and avatar logic from the existing TopBar, restructure nav links into the dropdown groups above.

**Step 2: Commit**

```bash
git add src/components/admin/AdminNavbar.tsx
git commit -m "feat(admin): add AdminNavbar for desktop with dropdown menus"
```

---

### Task 1.7: Rewrite admin layout

**Files:**
- Modify: `src/app/(admin)/admin/layout.tsx`
- Delete reference: `src/components/admin/Sidebar.tsx` (defer deletion to cleanup phase)

**Step 1: Rewrite layout**

Replace Sidebar+main with the new responsive shell:

```tsx
import AdminNavbar from '@/components/admin/AdminNavbar'
import AdminBottomTabs from '@/components/admin/AdminBottomTabs'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
        <AdminNavbar />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </main>
        <AdminBottomTabs />
      </div>
    </AdminAuthGuard>
  )
}
```

Note: AdminNavbar renders with `hidden md:flex`, AdminBottomTabs renders with `md:hidden`. Layout is server component; responsiveness handled inside client children.

**Step 2: Verify the app builds**

```bash
npm run build
```

Expected: build passes (pages still render old content but in new shell)

**Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/layout.tsx
git commit -m "feat(admin): replace sidebar layout with navbar+bottom-tabs shell"
```

---

### Task 1.8: Create "More" page (mobile navigation page)

**Files:**
- Create: `src/app/(admin)/admin/more/page.tsx`

**Step 1: Create mobile-only navigation list**

```tsx
'use client'

import Link from 'next/link'
import { Tent, Users, BarChart3, Settings, ChevronRight } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'

const links = [
  { href: '/admin/venues', icon: Tent, label: '场地管理', desc: '蒙古包 + 可用性' },
  { href: '/admin/customers', icon: Users, label: '客户管理', desc: '客户列表与详情' },
  { href: '/admin/reports', icon: BarChart3, label: '数据报表', desc: '营收与预订统计' },
  { href: '/admin/settings', icon: Settings, label: '系统设置', desc: '全局配置' },
]

export default function MorePage() {
  return (
    <>
      <AdminTopBar title="更多" />
      <div className="p-4 flex flex-col gap-2">
        {links.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 p-4 bg-white rounded-xl no-underline transition-colors hover:bg-[#F2EDE6]"
          >
            <div className="w-10 h-10 rounded-full bg-[#E8ECE4] flex items-center justify-center shrink-0">
              <Icon size={20} className="text-[#6B7F5E]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1A1208]">{label}</div>
              <div className="text-xs text-[#8C8478]">{desc}</div>
            </div>
            <ChevronRight size={18} className="text-[#8C8478] shrink-0" />
          </Link>
        ))}
      </div>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/more/page.tsx
git commit -m "feat(admin): add mobile More page for secondary navigation"
```

---

## Phase 2: Dashboard — Dual Components

### Task 2.1: Extract dashboard logic into shared hooks/helpers

**Files:**
- Create: `src/components/admin/dashboard/useDashboardData.ts`

**Step 1: Extract shared data fetching and helpers**

Move all SWR fetches, stat computations, week grid logic, and helper functions from the current `src/app/(admin)/admin/dashboard/page.tsx` (lines 73-312) into a reusable hook `useDashboardData()`. This hook returns: `{ statCards, weekGrid, activeYurts, activities, expiringSoon, todayRes, userName, greeting, todayDate, hasError, isLoading, mutations }`.

Keep all existing logic intact — just relocate it from the page component to the hook.

**Step 2: Commit**

```bash
git add src/components/admin/dashboard/useDashboardData.ts
git commit -m "refactor(admin): extract dashboard data fetching into shared hook"
```

---

### Task 2.2: Build `DashboardMobile.tsx`

**Files:**
- Create: `src/components/admin/dashboard/DashboardMobile.tsx`

**Step 1: Build mobile dashboard**

Layout (single column scroll):
1. `AdminTopBar title="首页"` (greeting as subtitle below)
2. 2x2 stat card grid (today reservations / pending deposits / pending orders / monthly revenue)
3. "Action Required" section — pending deposit cards with approve/reject buttons (port action logic from existing deposits page)
4. "Today's Bookings" — simple card list of today's reservations
5. "Recent Activity" — timeline items

Use `useDashboardData()` hook. Each stat card is tappable (links to relevant page).

Style: cards use `rounded-xl bg-white p-4`, spacing `gap-3`, status colors from StatusBadge.

**Step 2: Commit**

```bash
git add src/components/admin/dashboard/DashboardMobile.tsx
git commit -m "feat(admin): add DashboardMobile component"
```

---

### Task 2.3: Build `DashboardDesktop.tsx`

**Files:**
- Create: `src/components/admin/dashboard/DashboardDesktop.tsx`

**Step 1: Build desktop dashboard**

Layout (max-w-[1400px] centered, p-6):
1. Greeting banner with [+ New Reservation] and [View Calendar] buttons (port CreateReservationModal trigger)
2. 4-column KPI stat cards
3. 60/40 split row: Week overview matrix (left) + Action required list (right)
4. 60/40 split row: Today's reservations table (left) + Activity timeline (right)
5. Expiring soon alert section (port from existing dashboard)

This is essentially the existing dashboard page restyled: change `bg-[#F5F2ED]` → content sits on `#F8F7F4`, cards use `rounded-xl` instead of `rounded-xl` (same), remove TopBar (navbar handles title), change amber accents `#8B6914` → olive green `#6B7F5E` for accents, keep amber for gold/financial indicators.

**Step 2: Commit**

```bash
git add src/components/admin/dashboard/DashboardDesktop.tsx
git commit -m "feat(admin): add DashboardDesktop component"
```

---

### Task 2.4: Rewrite dashboard page to switch components

**Files:**
- Modify: `src/app/(admin)/admin/dashboard/page.tsx`

**Step 1: Replace page with responsive switcher**

```tsx
'use client'

import { useIsMobile } from '@/hooks/useIsMobile'
import DashboardMobile from '@/components/admin/dashboard/DashboardMobile'
import DashboardDesktop from '@/components/admin/dashboard/DashboardDesktop'

export default function DashboardPage() {
  const isMobile = useIsMobile()
  return isMobile ? <DashboardMobile /> : <DashboardDesktop />
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/dashboard/page.tsx
git commit -m "feat(admin): dashboard renders mobile or desktop based on viewport"
```

---

## Phase 3: Reservations — Dual Components + Merged Views

### Task 3.1: Create shared `ReservationDetail.tsx`

**Files:**
- Create: `src/components/admin/reservations/ReservationDetail.tsx`

**Step 1: Extract detail view**

Port the detail panel from `src/app/(admin)/admin/reservations/page.tsx` (lines 438-689) into a standalone component. This shows: status badge, reservation info, special requests, pre-order summary, guest info, payment info, activity timeline, and action buttons (confirm/complete/cancel).

Props: `{ reservation, onClose, onAction }`. Used by both mobile (full-screen page) and desktop (drawer panel).

On mobile, render as full-height scrollable page. On desktop, render as side panel content.

**Step 2: Commit**

```bash
git add src/components/admin/reservations/ReservationDetail.tsx
git commit -m "feat(admin): extract shared ReservationDetail component"
```

---

### Task 3.2: Create shared reservations data hook

**Files:**
- Create: `src/components/admin/reservations/useReservationsData.ts`

**Step 1: Extract data logic**

Move SWR fetches, filter state, tab definitions, action handlers (confirmDeposit, cancelReservation, completeReservation) from `src/app/(admin)/admin/reservations/page.tsx` into a reusable hook.

Add a new `view` state for SegmentedControl: `'all' | 'deposits' | 'orders'`. When view is 'deposits', filter to show PAYMENT_SUBMITTED only (logic from current deposits/page.tsx). When view is 'orders', fetch from `/api/orders` endpoint (logic from current orders/page.tsx).

Hook returns: `{ reservations, view, setView, activeTab, setActiveTab, search, setSearch, filters, actions, isLoading }`.

**Step 2: Commit**

```bash
git add src/components/admin/reservations/useReservationsData.ts
git commit -m "refactor(admin): extract reservations data + merged deposits/orders views"
```

---

### Task 3.3: Build `ReservationsMobile.tsx`

**Files:**
- Create: `src/components/admin/reservations/ReservationsMobile.tsx`

**Step 1: Build mobile reservations**

Layout:
1. `AdminTopBar title="预订管理"`
2. SegmentedControl: [全部预订 | 待审定金 | 预点单]
3. Search bar + date filter button (opens bottom sheet with date pickers)
4. Horizontally scrolling status chips
5. Card list — each card shows: customer name, date, yurt, guest count, reservation status badge, deposit status badge
6. Tap card → push to detail page (use `ReservationDetail` in full-screen mode)

Cards: `rounded-xl bg-white p-4 gap-3`. Use framer-motion for card entry animations.

**Step 2: Commit**

```bash
git add src/components/admin/reservations/ReservationsMobile.tsx
git commit -m "feat(admin): add ReservationsMobile with card list + merged views"
```

---

### Task 3.4: Build `ReservationsDesktop.tsx`

**Files:**
- Create: `src/components/admin/reservations/ReservationsDesktop.tsx`

**Step 1: Build desktop reservations**

Essentially restyle the existing reservations page:
1. SegmentedControl: [全部预订 | 待审定金 | 预点单]
2. Search + date filters (inline row)
3. Status tabs (horizontal)
4. Full-width table (guest, date, yurt, guests, status, deposit, action)
5. Click row → 400px right drawer with ReservationDetail
6. Checkbox column for batch select → floating action bar

Restyle: cream background, olive-green accents, `rounded-xl` cards, high-contrast status badges.

**Step 2: Commit**

```bash
git add src/components/admin/reservations/ReservationsDesktop.tsx
git commit -m "feat(admin): add ReservationsDesktop with table + drawer + batch ops"
```

---

### Task 3.5: Rewrite reservations page + add redirect from deposits/orders

**Files:**
- Modify: `src/app/(admin)/admin/reservations/page.tsx`
- Modify: `src/app/(admin)/admin/deposits/page.tsx` → redirect to `/admin/reservations?view=deposits`
- Modify: `src/app/(admin)/admin/orders/page.tsx` → redirect to `/admin/reservations?view=orders`

**Step 1: Rewrite reservations page**

```tsx
'use client'

import { useIsMobile } from '@/hooks/useIsMobile'
import ReservationsMobile from '@/components/admin/reservations/ReservationsMobile'
import ReservationsDesktop from '@/components/admin/reservations/ReservationsDesktop'

export default function ReservationsPage() {
  const isMobile = useIsMobile()
  return isMobile ? <ReservationsMobile /> : <ReservationsDesktop />
}
```

**Step 2: Redirect old deposits/orders pages**

```tsx
// deposits/page.tsx
import { redirect } from 'next/navigation'
export default function DepositsPage() {
  redirect('/admin/reservations?view=deposits')
}

// orders/page.tsx
import { redirect } from 'next/navigation'
export default function OrdersPage() {
  redirect('/admin/reservations?view=orders')
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/reservations/page.tsx src/app/\(admin\)/admin/deposits/page.tsx src/app/\(admin\)/admin/orders/page.tsx
git commit -m "feat(admin): reservations switches mobile/desktop, deposits+orders redirect"
```

---

## Phase 4: Calendar — Dual Components

### Task 4.1: Build `CalendarMobile.tsx`

**Files:**
- Create: `src/components/admin/calendar/CalendarMobile.tsx`

**Step 1: Build mobile calendar**

Layout:
1. `AdminTopBar title="日历"`
2. Week selector: swipeable row with Mon-Sun, dots under days with bookings, highlight today
3. Selected date detail: section title "X月X日 星期X"
4. Vertical list of yurts for that date — each yurt card shows booking (guest name, count, status) or "空闲" with available indicator
5. Tap booked yurt → push to ReservationDetail

Data: reuse SWR fetches from existing `calendar/page.tsx`. Core data = reservations for the selected week + yurts list.

**Step 2: Commit**

```bash
git add src/components/admin/calendar/CalendarMobile.tsx
git commit -m "feat(admin): add CalendarMobile with week selector + day view"
```

---

### Task 4.2: Build `CalendarDesktop.tsx`

**Files:**
- Create: `src/components/admin/calendar/CalendarDesktop.tsx`

**Step 1: Build desktop calendar**

Restyle the existing calendar page (667 lines) with the new visual system:
1. Week/Month view toggle
2. Full-width yurt x date matrix grid
3. Color-coded cells: available (#5B8C3E), pending (#E67E22), confirmed (#2980B9), completed (#8C8478)
4. Click cell → right drawer with reservation detail
5. Navigation arrows to change week/month
6. Legend bar at bottom

Restyle: cream background, olive-green accents, `rounded-xl` container, updated cell colors.

**Step 2: Commit**

```bash
git add src/components/admin/calendar/CalendarDesktop.tsx
git commit -m "feat(admin): add CalendarDesktop with full-width matrix view"
```

---

### Task 4.3: Rewrite calendar page

**Files:**
- Modify: `src/app/(admin)/admin/calendar/page.tsx`

**Step 1: Switch between mobile and desktop**

```tsx
'use client'

import { useIsMobile } from '@/hooks/useIsMobile'
import CalendarMobile from '@/components/admin/calendar/CalendarMobile'
import CalendarDesktop from '@/components/admin/calendar/CalendarDesktop'

export default function CalendarPage() {
  const isMobile = useIsMobile()
  return isMobile ? <CalendarMobile /> : <CalendarDesktop />
}
```

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/calendar/page.tsx
git commit -m "feat(admin): calendar renders mobile or desktop based on viewport"
```

---

## Phase 5: Responsive Pages (one component each)

### Task 5.1: Create Venues page (merge Yurts + Availability)

**Files:**
- Create: `src/app/(admin)/admin/venues/page.tsx`
- Modify: `src/app/(admin)/admin/yurts/page.tsx` → redirect to `/admin/venues`
- Modify: `src/app/(admin)/admin/availability/page.tsx` → redirect to `/admin/venues?tab=availability`

**Step 1: Build merged venues page**

Top-level tabs: [蒙古包管理 | 可用性设置]

Tab 1 (Yurts): Port the entire yurts page content (349 lines), restyle with:
- Cream bg, rounded-xl cards, olive-green accents
- Mobile: single-column card list with edit/view buttons
- Desktop: wider cards or table layout via responsive flex
- Edit form: full-screen on mobile, modal on desktop

Tab 2 (Availability): Port the availability page content (694 lines), restyle:
- Month calendar grid with toggle switches per yurt per date
- Mobile: single-column per-date view (each date expandable)
- Desktop: full matrix view

**Step 2: Redirect old pages**

```tsx
// yurts/page.tsx
import { redirect } from 'next/navigation'
export default function YurtsPage() { redirect('/admin/venues') }

// availability/page.tsx
import { redirect } from 'next/navigation'
export default function AvailabilityPage() { redirect('/admin/venues?tab=availability') }
```

**Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/venues/page.tsx src/app/\(admin\)/admin/yurts/page.tsx src/app/\(admin\)/admin/availability/page.tsx
git commit -m "feat(admin): merge yurts+availability into venues page with tabs"
```

---

### Task 5.2: Restyle Menu Management page

**Files:**
- Modify: `src/app/(admin)/admin/menu/page.tsx` (899 lines)

**Step 1: Restyle with responsive layout**

Changes:
- Replace `TopBar` → `AdminTopBar` (mobile) + no top bar on desktop (navbar handles it)
- Background: `#F8F7F4`
- Cards: `rounded-xl bg-white` with compact spacing
- Category sidebar (desktop) → horizontal scrolling category chips (mobile)
- Add/Edit form: modal on desktop, full-screen push on mobile
- Image upload: add `capture="environment"` for mobile camera
- Use responsive flex: `flex-col md:flex-row`

Keep all existing CRUD logic, SWR fetches, form handling intact. Just restructure the JSX layout and update class names.

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/menu/page.tsx
git commit -m "refactor(admin): restyle menu management with responsive layout"
```

---

### Task 5.3: Restyle Customers page

**Files:**
- Modify: `src/app/(admin)/admin/customers/page.tsx` (445 lines)

**Step 1: Restyle**

Changes:
- Replace TopBar → AdminTopBar
- Mobile: card list (name, email, phone, reservation count)
- Desktop: full-width table (keep existing columns)
- Tap/click → detail view (full-screen on mobile, drawer on desktop)
- Restyle: cream bg, olive-green accents, rounded-xl

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/customers/page.tsx
git commit -m "refactor(admin): restyle customers page with responsive layout"
```

---

### Task 5.4: Restyle Reports page

**Files:**
- Modify: `src/app/(admin)/admin/reports/page.tsx` (561 lines)

**Step 1: Restyle**

Changes:
- Replace TopBar → AdminTopBar
- Recharts containers: `ResponsiveContainer` handles width automatically
- Mobile: charts stack vertically, full-width
- Desktop: 2-column grid
- Date range picker: inline on desktop, bottom sheet on mobile
- Restyle colors: chart theme uses olive-green, terracotta, blue

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/reports/page.tsx
git commit -m "refactor(admin): restyle reports page with responsive chart layout"
```

---

### Task 5.5: Restyle Settings page

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx` (576 lines)

**Step 1: Restyle**

Changes:
- Replace TopBar → AdminTopBar
- Mobile: full-width form sections stacked
- Desktop: centered form with `max-w-2xl mx-auto`
- Add PWA notification toggle section (placeholder for Phase 6)
- Restyle: cream bg, olive-green accent on save buttons, rounded-xl cards for form sections

**Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/settings/page.tsx
git commit -m "refactor(admin): restyle settings page with centered responsive form"
```

---

## Phase 6: PWA Setup

### Task 6.1: Add PWA manifest and service worker config

**Files:**
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx` (add manifest link)
- Modify: `next.config.ts` (if needed for PWA headers)

**Step 1: Create manifest**

```json
{
  "name": "Bobo's Farm Admin",
  "short_name": "Bobo Admin",
  "description": "Bobo's Farm restaurant management",
  "start_url": "/admin/dashboard",
  "display": "standalone",
  "background_color": "#F8F7F4",
  "theme_color": "#6B7F5E",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Add to layout head**

Add `<link rel="manifest" href="/manifest.json" />` and `<meta name="theme-color" content="#6B7F5E" />` to the root layout.

**Step 3: Commit**

```bash
git add public/manifest.json src/app/layout.tsx
git commit -m "feat(pwa): add web app manifest for admin PWA"
```

---

### Task 6.2: Add service worker for offline caching

**Files:**
- Create: `public/sw.js`
- Modify: `src/app/(admin)/admin/layout.tsx` (register SW)

**Step 1: Create basic service worker**

Cache static assets and the admin shell. Cache-first for static, network-first for API calls with stale fallback for `/api/reservations` (today's data).

**Step 2: Register in admin layout**

Add SW registration in a useEffect within AdminAuthGuard or a new client component.

**Step 3: Add offline banner component**

Create `src/components/admin/OfflineBanner.tsx` — yellow banner that appears when `navigator.onLine` is false.

**Step 4: Commit**

```bash
git add public/sw.js src/components/admin/OfflineBanner.tsx src/app/\(admin\)/admin/layout.tsx
git commit -m "feat(pwa): add service worker with offline caching + offline banner"
```

---

### Task 6.3: Add pull-to-refresh on list pages

**Files:**
- Create: `src/hooks/usePullToRefresh.ts`

**Step 1: Create pull-to-refresh hook**

Simple implementation: listen to touchstart/touchmove/touchend on the scroll container. When pulled down > 60px at scroll top, trigger a refresh callback. Show a spinner during refresh.

**Step 2: Integrate into ReservationsMobile and CustomersMobile**

Add `usePullToRefresh({ onRefresh: () => mutate() })` to list pages.

**Step 3: Commit**

```bash
git add src/hooks/usePullToRefresh.ts
git commit -m "feat(pwa): add pull-to-refresh hook for mobile list pages"
```

---

## Phase 7: Cleanup

### Task 7.1: Remove old components + verify build

**Files:**
- Delete: `src/components/admin/Sidebar.tsx`
- Delete: `src/components/admin/TopBar.tsx`
- Verify: no remaining imports of Sidebar or old TopBar

**Step 1: Search for remaining imports**

```bash
grep -r "Sidebar\|admin/TopBar" src/ --include="*.tsx" --include="*.ts"
```

Remove any remaining references.

**Step 2: Verify build**

```bash
npm run build
```

Expected: 0 errors

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(admin): remove old Sidebar and TopBar components"
```

---

### Task 7.2: Update i18n strings

**Files:**
- Modify: `messages/en.json` and `messages/zh.json`

**Step 1: Add new admin navigation i18n keys**

Add keys for: BottomTabs labels, Navbar labels, "More" page, SegmentedControl labels, offline banner text, venue management labels.

**Step 2: Commit**

```bash
git add messages/
git commit -m "i18n(admin): add navigation and venue management strings"
```

---

### Task 7.3: Final integration test

**Step 1: Full build**

```bash
npm run build
```

**Step 2: Manual verification checklist**

- [ ] Desktop: Navbar renders with all links + dropdowns
- [ ] Mobile: BottomTabs renders 5 tabs
- [ ] Dashboard: switches between mobile/desktop
- [ ] Reservations: SegmentedControl toggles all/deposits/orders views
- [ ] Calendar: mobile shows day view, desktop shows matrix
- [ ] Venues: tabs switch between yurts and availability
- [ ] More page: shows on mobile only
- [ ] `/admin/deposits` redirects to `/admin/reservations?view=deposits`
- [ ] `/admin/orders` redirects to `/admin/reservations?view=orders`
- [ ] `/admin/yurts` redirects to `/admin/venues`
- [ ] `/admin/availability` redirects to `/admin/venues?tab=availability`
- [ ] PWA manifest loads correctly
- [ ] Notification bell shows pending count

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): complete admin redesign — PWA unified UI"
```

---

## Execution Summary

| Phase | Tasks | Estimated Complexity |
|-------|-------|---------------------|
| 1. Foundation | 8 tasks | Medium — new components, layout rewrite |
| 2. Dashboard | 4 tasks | High — two full page components + data extraction |
| 3. Reservations | 5 tasks | High — merged views, two components, shared detail |
| 4. Calendar | 3 tasks | High — two very different views |
| 5. Responsive Pages | 5 tasks | Medium — restyle existing code |
| 6. PWA | 3 tasks | Medium — manifest, SW, pull-to-refresh |
| 7. Cleanup | 3 tasks | Low — delete old code, verify |
| **Total** | **31 tasks** | |

## Dependencies

```
Phase 1 (Foundation) → all other phases depend on this
Phase 2 (Dashboard) → independent after Phase 1
Phase 3 (Reservations) → independent after Phase 1
Phase 4 (Calendar) → independent after Phase 1
Phase 5 (Responsive) → independent after Phase 1
Phase 6 (PWA) → after Phase 1
Phase 7 (Cleanup) → after all phases complete
```

Phases 2-5 can be parallelized with separate agents after Phase 1 completes.
