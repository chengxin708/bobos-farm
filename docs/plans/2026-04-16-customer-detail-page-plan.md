# Customer Detail Independent Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace customer detail side panel with an independent page at `/admin/customers/[id]` featuring profile, stats, notes, and reservation history split into upcoming/history groups with drill-down into ReservationDetail.

**Architecture:** New Next.js page route + API endpoint. Customer list page simplified to pure navigation. Detail page fetches customer reservations via dedicated API, renders profile/stats/notes inline, and opens ReservationDetail in a side panel (desktop) or full-screen overlay (mobile) when a reservation row is clicked.

**Tech Stack:** Next.js 16 (App Router), Prisma 6, TypeScript, Tailwind CSS v4, next-intl, SWR, Lucide React

---

## Task 1: API — Customer Reservations Endpoint

**Files:**
- Create: `src/app/api/customers/[id]/reservations/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const reservations = await prisma.reservation.findMany({
      where: { userId: id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        yurt: { select: { id: true, name: true, alias: true, capacity: true } },
        order: { select: { id: true, status: true, estimatedTotal: true, finalTotal: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ user, reservations });
  } catch (error) {
    console.error("Failed to fetch customer reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer reservations" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/customers/[id]/reservations/
git commit -m "feat: add GET /api/customers/[id]/reservations endpoint"
```

---

## Task 2: i18n — New Strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh.json`

**Step 1: Add strings to EN**

In `admin.customers`, add/update:

```json
"detailPage": {
  "title": "Customer Details",
  "backToList": "Back to Customers",
  "upcoming": "Upcoming",
  "history": "History",
  "showHistory": "Show History ({count})",
  "hideHistory": "Hide History",
  "noUpcoming": "No upcoming reservations",
  "noHistory": "No past reservations",
  "guests": "{count} guests",
  "reservationCount": "Reservations"
}
```

**Step 2: Add strings to ZH**

```json
"detailPage": {
  "title": "客户详情",
  "backToList": "返回客户列表",
  "upcoming": "即将到来",
  "history": "历史记录",
  "showHistory": "展开历史记录 ({count})",
  "hideHistory": "收起历史记录",
  "noUpcoming": "没有即将到来的预约",
  "noHistory": "没有历史预约",
  "guests": "{count} 位客人",
  "reservationCount": "预约记录"
}
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat: add i18n strings for customer detail page"
```

---

## Task 3: Customer Detail Page

**Files:**
- Create: `src/app/(admin)/admin/customers/[id]/page.tsx`

This is the main new page. It needs to:

1. Fetch customer data + reservations via `/api/customers/[id]/reservations`
2. Fetch customer notes via `/api/customers/[id]/notes`
3. Render profile, stats, notes, and reservation history
4. Split reservations into upcoming/history groups
5. Open ReservationDetail when a reservation is clicked
6. Fetch activity logs for selected reservation

**Step 1: Create the page**

The page should be structured as follows. Read these existing files for patterns before writing:
- `src/app/(admin)/admin/customers/page.tsx` — for helpers (getInitials, getAvatarColor, computeTag, formatDateShort, STATUS_COLORS, AVATAR_COLORS)
- `src/components/admin/reservations/ReservationsMobile.tsx` — for ReservationDetail usage pattern
- `src/components/admin/reservations/ReservationsDesktop.tsx` — for side panel pattern

Key structure:

```typescript
"use client"

import { useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import ReservationDetail from '@/components/admin/reservations/ReservationDetail'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ArrowLeft, Save, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { type Reservation, type ActivityLog, formatDateTime } from '@/components/admin/reservations/useReservationsData'

// Reuse helpers from parent page: getInitials, getAvatarColor, computeTag, formatDateShort
// Copy these helper functions or extract to a shared util (prefer copy for simplicity)

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('admin.customers')
  const isMobile = useIsMobile()
  
  // Fetch customer + reservations
  const { data, isLoading, mutate: mutateReservations } = useSWR(
    `/api/customers/${id}/reservations`, fetcher
  )
  
  // Notes state (same pattern as current customers page)
  const [note, setNote] = useState<string | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  
  // Load note on mount
  // ... (useSWR for /api/customers/[id]/notes)
  
  // Selected reservation for detail panel
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  
  // Activity logs for selected reservation
  const { data: activityLogs } = useSWR(
    selectedRes ? `/api/reservations/${selectedRes.id}?include=logs` : null, ...
  )
  
  // History collapsed state
  const [historyExpanded, setHistoryExpanded] = useState(false)
  
  // Split reservations into upcoming/history
  const { upcoming, history } = useMemo(() => {
    if (!data?.reservations) return { upcoming: [], history: [] }
    const todayStr = new Date().toISOString().slice(0, 10)
    const INACTIVE = ['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED']
    const upcoming = data.reservations
      .filter(r => r.date.slice(0, 10) >= todayStr && !INACTIVE.includes(r.status))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const history = data.reservations
      .filter(r => r.date.slice(0, 10) < todayStr || INACTIVE.includes(r.status))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return { upcoming, history }
  }, [data?.reservations])
  
  // Build customer profile data from user + reservations (same computations as list page)
  
  // Reservation actions (same pattern as ReservationsMobile/Desktop)
  // confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation
  // These call PATCH /api/reservations/[id] and mutate
  
  // Render reservation row (shared by upcoming and history)
  function renderReservationRow(res: Reservation) {
    return (
      <button
        key={res.id}
        onClick={() => setSelectedRes(res)}
        className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[#F8F7F4] cursor-pointer text-left"
      >
        <span className="text-sm text-[#1A1208]">{formatDateShort(res.date)}</span>
        <span className="text-xs text-[#8C8478]">
          {res.yurt?.name || t('detailPage.pending')}{res.yurt?.alias ? ` (${res.yurt.alias})` : ''}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-[#8C8478]">
          <Users size={12} />
          {res.guestCount}
        </div>
        <StatusBadge type="reservation" status={res.status} label={t(`status.${res.status}`)} />
      </button>
    )
  }
  
  return (
    <>
      {isMobile && <AdminTopBar title={t('detailPage.title')} />}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {/* Back button (desktop) */}
          {!isMobile && (
            <button onClick={() => router.push('/admin/customers')} className="flex items-center gap-1.5 text-sm text-[#8C8478] hover:text-[#1A1208] mb-4">
              <ArrowLeft size={16} />
              {t('detailPage.backToList')}
            </button>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm text-[#8C8478]">Loading...</span>
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-sm text-[#8C8478]">Customer not found</div>
          ) : (
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              {/* Profile section */}
              {/* Stats grid */}
              {/* Admin notes */}
              
              {/* Upcoming reservations */}
              <div>
                <h3 className="text-sm font-bold text-[#1A1208] mb-2">
                  {t('detailPage.upcoming')} ({upcoming.length})
                </h3>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-[#8C8478] py-3">{t('detailPage.noUpcoming')}</p>
                ) : (
                  <div className="bg-white rounded-xl border border-[#E8ECE4] divide-y divide-[#E8ECE4]">
                    {upcoming.map(renderReservationRow)}
                  </div>
                )}
              </div>
              
              {/* History reservations — collapsed by default */}
              <div>
                <button
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="flex items-center gap-1.5 text-sm font-bold text-[#8C8478] hover:text-[#1A1208] mb-2"
                >
                  {historyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {historyExpanded ? t('detailPage.hideHistory') : t('detailPage.showHistory', { count: history.length })}
                </button>
                {historyExpanded && (
                  history.length === 0 ? (
                    <p className="text-xs text-[#8C8478] py-3">{t('detailPage.noHistory')}</p>
                  ) : (
                    <div className="bg-white rounded-xl border border-[#E8ECE4] divide-y divide-[#E8ECE4]">
                      {history.map(renderReservationRow)}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Desktop: ReservationDetail side panel */}
        {!isMobile && selectedRes && (
          <div className="w-[400px] border-l border-[#E8ECE4] bg-white flex flex-col overflow-hidden shrink-0">
            <ReservationDetail
              reservation={selectedRes}
              activityLogs={activityLogs || []}
              onClose={() => setSelectedRes(null)}
              onAction={{ confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation }}
              isUpdating={updating}
              onOrderChanged={() => mutateReservations()}
            />
          </div>
        )}
      </div>
      
      {/* Mobile: ReservationDetail full-screen overlay */}
      {isMobile && selectedRes && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <ReservationDetail
            reservation={selectedRes}
            activityLogs={activityLogs || []}
            onClose={() => setSelectedRes(null)}
            onAction={{ confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation }}
            isUpdating={updating}
            onOrderChanged={() => mutateReservations()}
          />
        </div>
      )}
      
      {/* Mobile: Back button */}
      {isMobile && !selectedRes && (
        <div className="absolute top-0 left-0 p-2 z-10">
          {/* Back arrow in AdminTopBar or separate */}
        </div>
      )}
    </>
  )
}
```

**Important implementation details:**

1. **Activity logs**: The ReservationDetail component expects `activityLogs` prop. Fetch them via `/api/reservations/[id]?include=logs` — check how ReservationsDesktop does it (look at `useReservationsData.ts` for the `mutateActivityLogs` / `activityLogs` pattern — it fetches from `/api/activity-logs?targetId={resId}&targetType=Reservation`).

2. **Reservation actions**: Need `confirmDeposit`, `cancelReservation`, `cancelAndRefund`, `markRefunded`, `completeReservation` callbacks. These follow the same PATCH pattern as `useReservationsData.ts`. Implement them inline or create a small hook.

3. **Detail refetch**: When a reservation is updated via the detail panel, call `mutateReservations()` to refresh the list and `mutateDetail()` for the detail data.

4. **Helpers**: Copy `getInitials`, `getAvatarColor`, `AVATAR_COLORS`, `computeTag`, `formatDateShort` from the list page. Don't over-engineer a shared module — these are small utility functions.

5. **Mobile back**: Use `AdminTopBar` with back button support — check its props for `onBack` or similar. If not available, use `router.back()` or `router.push('/admin/customers')`.

6. **StatusBadge i18n**: The reservation row uses `t('status.${res.status}')` — but the status keys are under `admin.reservations.status`, not `admin.customers`. Use `useTranslations('admin.reservations')` for reservation-specific labels.

**Step 2: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/customers/[id]/
git commit -m "feat: customer detail page with profile, stats, notes, and reservation history"
```

---

## Task 4: Simplify Customer List Page

**Files:**
- Modify: `src/app/(admin)/admin/customers/page.tsx`

**Step 1: Remove detail-related code**

Remove:
- `CustomerDetailMobile` component (lines 138-249)
- State variables: `detailOpen`, `selectedId`, `notes`, `noteSaving`, `noteSaved` (lines 256-262)
- `loadNote`, `handleSaveNote` callbacks (lines 264-296)
- `selectedCustomer` memo (lines 393-396)
- Desktop right panel JSX (`{!isMobile && detailOpen && selectedCustomer && (...)}`
- Mobile overlay JSX (`{isMobile && detailOpen && selectedCustomer && (...)}`
- `STATUS_COLORS` object (no longer needed)
- `Save` from lucide import (if no longer used)

**Step 2: Change click handlers to navigate**

Replace `handleRowClick`:
```typescript
const handleRowClick = useCallback((id: string) => {
  router.push(`/admin/customers/${id}`)
}, [router])
```

The `CustomerCard` onClick already calls `handleRowClick`, and the table row onClick already calls `handleRowClick`. Both will now navigate.

**Step 3: Remove desktop right panel condition**

The `{!isMobile && detailOpen && selectedCustomer && (...)}` block and the mobile overlay block should be deleted entirely.

**Step 4: Clean up unused imports**

Remove `Save` from lucide if no longer used. Remove `useIsMobile` if no longer used (check — it may still be used for card vs table rendering).

Actually `useIsMobile` IS still needed for card vs table layout. Keep it.

**Step 5: Verify build**

```bash
npm run build 2>&1 | head -30
```

**Step 6: Commit**

```bash
git add src/app/\(admin\)/admin/customers/page.tsx
git commit -m "refactor: simplify customer list — remove detail panel, navigate to detail page"
```

---

## Task 5: Final Verification

**Step 1: Full build**

```bash
npm run build
```

**Step 2: Verify navigation flow**

- `/admin/customers` → click customer → should navigate to `/admin/customers/[id]`
- `/admin/customers/[id]` → click back → should go to `/admin/customers`
- Click a reservation row → should open ReservationDetail panel/overlay
- Close detail → should return to customer detail page

**Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: customer detail page polish"
```
