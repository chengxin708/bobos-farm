'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'

// ── Types ──────────────────────────────────────────────────────────

export interface ReservationUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

export interface ReservationYurt {
  id: string
  name: string
  capacity: number
}

export interface OrderItem {
  id: string
  quantity: number
  specialNotes?: string | null
  menuItem: {
    id: string
    nameEn: string
    nameZh: string | null
    price: number
    imageUrl?: string | null
  }
}

export interface Order {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'BILLED' | 'PAID'
  estimatedTotal: number | null
  finalTotal?: number | null
  discount?: number | null
  paymentMethod?: string | null
  paidAt?: string | null
  notes: string | null
  submittedAt: string | null
  lockedAt?: string | null
  items: OrderItem[]
}

export interface ActivityLog {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  user?: { name: string | null; email: string } | null
}

export interface Reservation {
  id: string
  userId: string
  yurtId: string
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  depositConfirmedAt: string | null
  paymentReference: string | null
  paymentScreenshotUrl: string | null
  paymentDeadline: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  user: ReservationUser
  yurt: ReservationYurt
  order?: Order | null
}

export interface OrderListItem {
  id: string
  reservationId: string
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'BILLED' | 'PAID'
  notes: string | null
  estimatedTotal: number | null
  submittedAt: string | null
  lockedAt: string | null
  createdAt: string
  updatedAt: string
  reservation: {
    id: string
    date: string
    guestCount: number
    yurt: { id: string; name: string }
    user: ReservationUser
  }
  _count: { items: number }
}

export type ViewMode = 'all' | 'deposits' | 'orders'
export type TabKey = 'all' | 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
export type OrderTabKey = 'all' | 'SUBMITTED' | 'LOCKED' | 'BILLED' | 'PAID'

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function activityLogText(log: ActivityLog, t: (key: string, values?: any) => string): string {
  const details = log.details as Record<string, unknown> | null
  const actor = log.user?.name || log.user?.email || 'System'
  switch (log.action) {
    case 'RESERVATION_MODIFIED': {
      const parts: string[] = []
      if (details?.guestCount) parts.push(t('activityLog.updatedGuestCount', { count: details.guestCount }))
      if (details?.specialRequests !== undefined) parts.push(t('activityLog.updatedSpecialRequests'))
      return parts.length
        ? t('activityLog.updated', { actor, parts: parts.join(t('activityLog.and')) })
        : t('activityLog.modified', { actor })
    }
    case 'RESERVATION_RESCHEDULED':
      return t('activityLog.rescheduled', { actor })
    case 'RESERVATION_CANCELLED':
      return t('activityLog.cancelled', { actor })
    case 'PAYMENT_SUBMITTED':
      return t('activityLog.paymentSubmitted', { actor })
    case 'DEPOSIT_CONFIRMED':
      return t('activityLog.depositConfirmed', { actor })
    case 'ORDER_SUBMITTED':
      return t('activityLog.orderSubmitted', { actor })
    case 'ORDER_UPDATED':
      return t('activityLog.orderUpdated', { actor })
    default:
      return t('activityLog.defaultAction', { action: log.action.replace(/_/g, ' ').toLowerCase(), actor })
  }
}

export const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING_PAYMENT:   { bg: 'bg-[#F4A623]/15', text: 'text-[#F4A623]' },
  PAYMENT_SUBMITTED: { bg: 'bg-[#E67E22]/15', text: 'text-[#E67E22]' },
  CONFIRMED:         { bg: 'bg-[#2980B9]/15', text: 'text-[#2980B9]' },
  COMPLETED:         { bg: 'bg-[#5B8C3E]/15', text: 'text-[#5B8C3E]' },
  CANCELLED:         { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
  EXPIRED:           { bg: 'bg-gray-100',      text: 'text-gray-500' },
}

export const DEPOSIT_BADGE: Record<string, { bg: string; text: string }> = {
  UNPAID:    { bg: 'bg-gray-100',       text: 'text-gray-500' },
  PENDING:   { bg: 'bg-[#F4A623]/15',   text: 'text-[#F4A623]' },
  CONFIRMED: { bg: 'bg-[#5B8C3E]/15',   text: 'text-[#5B8C3E]' },
  REFUNDED:  { bg: 'bg-[#2980B9]/15',   text: 'text-[#2980B9]' },
}

export const ORDER_STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: 'bg-gray-100',       text: 'text-gray-500' },
  SUBMITTED: { bg: 'bg-[#F4A623]/15',   text: 'text-[#F4A623]' },
  LOCKED:    { bg: 'bg-[#2980B9]/15',   text: 'text-[#2980B9]' },
  BILLED:    { bg: 'bg-[#2980B9]/15',   text: 'text-[#2980B9]' },
  PAID:      { bg: 'bg-[#5B8C3E]/15',   text: 'text-[#5B8C3E]' },
}

// ── Hook ───────────────────────────────────────────────────────────

export function useReservationsData() {
  const t = useTranslations('admin.reservations')
  const tOrders = useTranslations('admin.orders')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // View state synced with URL
  const urlView = (searchParams.get('view') as ViewMode) || 'all'
  const [view, setView] = useState<ViewMode>(
    ['all', 'deposits', 'orders'].includes(urlView) ? urlView : 'all'
  )

  // Sync view when URL search params change (e.g. navbar dropdown clicks)
  useEffect(() => {
    const newView = (searchParams.get('view') as ViewMode) || 'all'
    if (['all', 'deposits', 'orders'].includes(newView) && newView !== view) {
      setView(newView)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [orderTab, setOrderTab] = useState<OrderTabKey>('all')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [updating, setUpdating] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setSuccessMsg(null), 3000)
  }, [])

  // Redirect non-admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [sessionStatus, session, router])

  // Update URL when view changes (without triggering navigation)
  const handleViewChange = useCallback((newView: ViewMode) => {
    setView(newView)
    const url = newView === 'all'
      ? '/admin/reservations'
      : `/admin/reservations?view=${newView}`
    window.history.replaceState(null, '', url)
  }, [])

  // ── Reservations API URL ─────────────────────────────────────

  const reservationsApiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (view === 'deposits') {
      params.set('status', 'PAYMENT_SUBMITTED')
    } else if (view === 'all' && activeTab !== 'all') {
      params.set('status', activeTab)
    }
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (search.trim() && view !== 'orders') params.set('search', search.trim())
    const qs = params.toString()
    return `/api/reservations${qs ? `?${qs}` : ''}`
  }, [view, activeTab, startDate, endDate, search])

  const {
    data: reservations,
    isLoading: reservationsLoading,
    mutate: mutateReservations
  } = useSWR<Reservation[]>(
    view !== 'orders' ? reservationsApiUrl : null,
    fetcher
  )

  // ── Orders API URL ───────────────────────────────────────────

  const ordersApiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (orderTab !== 'all') params.set('status', orderTab)
    if (search.trim()) params.set('search', search.trim())
    const qs = params.toString()
    return `/api/orders${qs ? `?${qs}` : ''}`
  }, [orderTab, search])

  const {
    data: orders,
    isLoading: ordersLoading,
    mutate: mutateOrders
  } = useSWR<OrderListItem[]>(
    view === 'orders' ? ordersApiUrl : null,
    fetcher
  )

  // ── Fetch detail + activity logs for selected reservation ───

  const { data: detailRes } = useSWR<Reservation>(
    selectedRes ? `/api/reservations/${selectedRes.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const { data: activityLogs } = useSWR<ActivityLog[]>(
    selectedRes ? `/api/activity-logs?targetId=${selectedRes.id}&targetType=RESERVATION` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // ── Tab definitions ──────────────────────────────────────────

  const reservationTabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'PENDING_PAYMENT', label: t('tabs.pendingPayment') },
    { key: 'PAYMENT_SUBMITTED', label: t('tabs.paymentSubmitted') },
    { key: 'CONFIRMED', label: t('tabs.confirmed') },
    { key: 'COMPLETED', label: t('tabs.completed') },
    { key: 'CANCELLED', label: t('tabs.cancelled') },
    { key: 'EXPIRED', label: t('tabs.expired') },
  ]

  const orderTabs: { key: OrderTabKey; label: string }[] = [
    { key: 'all', label: tOrders('tabs.all') },
    { key: 'SUBMITTED', label: tOrders('tabs.SUBMITTED') },
    { key: 'LOCKED', label: tOrders('tabs.LOCKED') },
    { key: 'BILLED', label: tOrders('tabs.BILLED') },
    { key: 'PAID', label: tOrders('tabs.PAID') },
  ]

  // ── Actions ──────────────────────────────────────────────────

  const handleAction = useCallback(async (id: string, action: string, data?: Record<string, unknown>): Promise<boolean> => {
    setUpdating(true)
    try {
      const body = action === 'cancel'
        ? { action: 'cancel' }
        : { ...data }

      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || t('updateFailed'))
        return false
      }

      const updated = await res.json()
      if (selectedRes?.id === id) setSelectedRes(updated)
      mutateReservations()
      return true
    } catch {
      alert(t('updateFailed'))
      return false
    } finally {
      setUpdating(false)
    }
  }, [selectedRes, mutateReservations])

  const confirmDeposit = useCallback(async (id: string) => {
    const ok = await handleAction(id, 'admin', {
      status: 'CONFIRMED',
      depositStatus: 'CONFIRMED',
      depositConfirmedAt: new Date().toISOString(),
    })
    if (ok) showSuccess(t('depositConfirmedSuccess'))
  }, [handleAction, showSuccess, t])

  const cancelReservation = useCallback(async (id: string) => {
    const ok = await handleAction(id, 'cancel')
    if (ok) showSuccess(t('cancelledSuccess'))
  }, [handleAction, showSuccess, t])

  const completeReservation = useCallback(async (id: string) => {
    const ok = await handleAction(id, 'admin', { status: 'COMPLETED' })
    if (ok) showSuccess(t('completedSuccess'))
  }, [handleAction, showSuccess, t])

  const handleLockOrder = useCallback(async (id: string) => {
    if (!confirm(tOrders('actions.confirmLock'))) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || tOrders('lockFailed'))
        return
      }
      mutateOrders()
      showSuccess(tOrders('lockSuccess'))
    } catch {
      alert(tOrders('lockFailed'))
    } finally {
      setUpdating(false)
    }
  }, [mutateOrders, showSuccess, tOrders])

  const handleUnlockOrder = useCallback(async (id: string) => {
    if (!confirm(tOrders('actions.confirmUnlock'))) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock' }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || tOrders('unlockFailed'))
        return
      }
      mutateOrders()
      showSuccess(tOrders('unlockSuccess'))
    } catch {
      alert(tOrders('unlockFailed'))
    } finally {
      setUpdating(false)
    }
  }, [mutateOrders, showSuccess, tOrders])

  const clearFilters = useCallback(() => {
    setActiveTab('all')
    setOrderTab('all')
    setSearch('')
    setStartDate('')
    setEndDate('')
  }, [])

  const isLoading = view === 'orders' ? ordersLoading : reservationsLoading

  return {
    // Session
    sessionStatus,
    // View
    view,
    setView: handleViewChange,
    // Reservation filters
    activeTab,
    setActiveTab,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    clearFilters,
    reservationTabs,
    // Order filters
    orderTab,
    setOrderTab,
    orderTabs,
    // Data
    reservations: reservations || [],
    orders: orders || [],
    isLoading,
    // Detail
    selectedRes,
    setSelectedRes,
    detailRes,
    activityLogs: activityLogs || [],
    // Actions
    confirmDeposit,
    cancelReservation,
    completeReservation,
    handleLockOrder,
    handleUnlockOrder,
    updating,
    // Mutators (for child components to trigger refresh)
    mutateReservations,
    mutateOrders,
    // Success message
    successMsg,
    setSuccessMsg,
    showSuccess,
    // i18n
    t,
    tOrders,
  }
}
