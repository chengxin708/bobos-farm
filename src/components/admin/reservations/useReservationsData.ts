'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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

export interface OrderSummary {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED' | 'BILLED' | 'PAID'
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
  holdByAdmin?: boolean
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  user: ReservationUser
  yurt: ReservationYurt
  order?: Order | OrderSummary | null
}

export type FilterMode = 'action-needed' | 'confirmed' | 'all'

export interface DateGroup {
  dateLabel: string
  dateKey: string
  reservations: Reservation[]
}

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

/** Build a human-readable date group label. */
function buildDateLabel(
  dateStr: string,
  locale: string,
  tToday: string,
  tTomorrow: string,
): string {
  const d = new Date(dateStr)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)
  const isoDate = d.toISOString().slice(0, 10)

  const dayOfWeek = d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' })
  const monthDay = d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' })

  if (isoDate === todayStr) return `${tToday} ${monthDay} ${dayOfWeek}`
  if (isoDate === tomorrowStr) return `${tTomorrow} ${monthDay} ${dayOfWeek}`
  return `${monthDay} ${dayOfWeek}`
}

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'EXPIRED']

// ── Hook ───────────────────────────────────────────────────────────

export function useReservationsData() {
  const t = useTranslations('admin.reservations')
  const tOrders = useTranslations('admin.orders')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  // Filter state
  const [filter, setFilter] = useState<FilterMode>('action-needed')
  const [showHistory, setShowHistory] = useState(false)
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [search, setSearch] = useState('')
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

  // ── Reservations API — fetch all, filter on client ──────────

  const reservationsApiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    const qs = params.toString()
    return `/api/reservations${qs ? `?${qs}` : ''}`
  }, [search])

  const {
    data: rawReservations,
    isLoading,
    mutate: mutateReservations
  } = useSWR<Reservation[]>(reservationsApiUrl, fetcher)

  // ── Fetch detail + activity logs for selected reservation ───

  const { data: detailRes, mutate: mutateDetail } = useSWR<Reservation>(
    selectedRes ? `/api/reservations/${selectedRes.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const { data: activityLogs, mutate: mutateActivityLogs } = useSWR<ActivityLog[]>(
    selectedRes ? `/api/activity-logs?targetId=${selectedRes.id}&targetType=RESERVATION` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // ── Derived data ────────────────────────────────────────────

  const allReservations = rawReservations || []

  // Counts (always computed from full dataset before filter)
  const pendingDepositCount = useMemo(
    () => allReservations.filter(r => r.status === 'PAYMENT_SUBMITTED').length,
    [allReservations]
  )
  const pendingOrderCount = useMemo(
    () => allReservations.filter(r => r.order && r.order.status === 'SUBMITTED').length,
    [allReservations]
  )
  const heldByAdminCount = useMemo(
    () => allReservations.filter(r => r.status === 'PENDING_PAYMENT' && r.holdByAdmin).length,
    [allReservations]
  )
  const actionNeededCount = useMemo(
    () => allReservations.filter(r => r.status === 'PENDING_PAYMENT' || r.status === 'PAYMENT_SUBMITTED').length,
    [allReservations]
  )
  const confirmedCount = useMemo(
    () => allReservations.filter(r => r.status === 'CONFIRMED').length,
    [allReservations]
  )

  // Filter + sort
  const filteredReservations = useMemo(() => {
    let list = allReservations

    // When not showing history: only upcoming (today+) and exclude terminal states
    const todayStr = new Date().toISOString().slice(0, 10)
    if (!showHistory) {
      list = list.filter(r => {
        const dateStr = new Date(r.date).toISOString().slice(0, 10)
        return dateStr >= todayStr && !TERMINAL_STATUSES.includes(r.status)
      })
    } else {
      // History mode: show only past OR terminal-status reservations
      list = list.filter(r => {
        const dateStr = new Date(r.date).toISOString().slice(0, 10)
        return dateStr < todayStr || TERMINAL_STATUSES.includes(r.status)
      })
      // Apply date range filter if set
      if (historyDateFrom) {
        list = list.filter(r => {
          const dateStr = new Date(r.date).toISOString().slice(0, 10)
          return dateStr >= historyDateFrom
        })
      }
      if (historyDateTo) {
        list = list.filter(r => {
          const dateStr = new Date(r.date).toISOString().slice(0, 10)
          return dateStr <= historyDateTo
        })
      }
    }

    // Apply filter chip
    if (filter === 'action-needed') {
      list = list.filter(r => r.status === 'PENDING_PAYMENT' || r.status === 'PAYMENT_SUBMITTED')
    } else if (filter === 'confirmed') {
      list = list.filter(r => r.status === 'CONFIRMED')
    }
    // 'all' — no additional filter

    // Sort by date ascending (upcoming first) when not history, descending for history
    list = [...list].sort((a, b) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      return showHistory ? db - da : da - db
    })

    return list
  }, [allReservations, filter, showHistory, historyDateFrom, historyDateTo])

  // Group by date
  const groupedReservations: DateGroup[] = useMemo(() => {
    const groups: Map<string, Reservation[]> = new Map()
    for (const r of filteredReservations) {
      const key = new Date(r.date).toISOString().slice(0, 10)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    const locale = typeof window !== 'undefined' ? (document.documentElement.lang || 'en') : 'en'
    return Array.from(groups.entries()).map(([dateKey, reservations]) => ({
      dateKey,
      dateLabel: buildDateLabel(dateKey, locale, t('dateGroup.today'), t('dateGroup.tomorrow')),
      reservations,
    }))
  }, [filteredReservations, t])

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
      mutateDetail()
      mutateActivityLogs()
      return true
    } catch {
      alert(t('updateFailed'))
      return false
    } finally {
      setUpdating(false)
    }
  }, [selectedRes, mutateReservations, mutateDetail, mutateActivityLogs, t])

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
      mutateReservations()
      showSuccess(tOrders('lockSuccess'))
    } catch {
      alert(tOrders('lockFailed'))
    } finally {
      setUpdating(false)
    }
  }, [mutateReservations, showSuccess, tOrders])

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
      mutateReservations()
      showSuccess(tOrders('unlockSuccess'))
    } catch {
      alert(tOrders('unlockFailed'))
    } finally {
      setUpdating(false)
    }
  }, [mutateReservations, showSuccess, tOrders])

  const clearFilters = useCallback(() => {
    setFilter('action-needed')
    setSearch('')
    setShowHistory(false)
    setHistoryDateFrom('')
    setHistoryDateTo('')
  }, [])

  return {
    // Session
    sessionStatus,
    // Filters
    filter,
    setFilter,
    showHistory,
    setShowHistory,
    historyDateFrom,
    setHistoryDateFrom,
    historyDateTo,
    setHistoryDateTo,
    search,
    setSearch,
    clearFilters,
    // Counts
    pendingDepositCount,
    pendingOrderCount,
    heldByAdminCount,
    actionNeededCount,
    confirmedCount,
    // Data
    reservations: filteredReservations,
    groupedReservations,
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
    // Mutators
    mutateReservations,
    mutateDetail,
    // Success message
    successMsg,
    setSuccessMsg,
    showSuccess,
    // i18n
    t,
    tOrders,
  }
}
