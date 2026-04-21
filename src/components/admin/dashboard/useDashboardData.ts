'use client'

import { useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import {
  Calendar as CalendarIcon,
  Clock4,
  Utensils,
  DollarSign,
} from 'lucide-react'

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
  alias?: string | null
  capacity: number
}

export interface Reservation {
  id: string
  userId: string
  yurtId: string | null
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_PENDING_REFUND' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  paymentDeadline: string | null
  createdAt: string
  updatedAt: string
  user: ReservationUser
  yurt: ReservationYurt | null
}

export interface Yurt {
  id: string
  name: string
  alias?: string | null
  capacity: number
  status: string
  sortOrder: number
}

export interface ActivityLog {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  user?: { name: string | null; email: string } | null
}

export type CellStatus = 'available' | 'pending' | 'confirmed' | 'completed'

// ── Constants ──────────────────────────────────────────────────────

// DAY_LABELS indices 0-6 map to Mon-Sun; translated via t('dayLabels.N') in components
export const DAY_LABEL_KEYS = [0, 1, 2, 3, 4, 5, 6] as const

export const STATUS_TO_CELL: Record<string, CellStatus> = {
  CONFIRMED: 'confirmed',
  PENDING_PAYMENT: 'pending',
  PAYMENT_SUBMITTED: 'pending',
  COMPLETED: 'completed',
}

export const CELL_STYLES: Record<CellStatus, { bg: string; ring: string }> = {
  available: { bg: 'bg-[#4A7C59]', ring: '' },
  pending: { bg: 'bg-[#D4A017]', ring: '' },
  confirmed: { bg: 'bg-[#3B82F6]', ring: '' },
  completed: { bg: 'bg-[#9CA3AF]', ring: '' },
}

export const ACTIVITY_DOT_COLOR: Record<string, string> = {
  RESERVATION_CREATED: 'bg-[#4A7C59]',
  RESERVATION_MODIFIED: 'bg-[#8B6914]',
  RESERVATION_RESCHEDULED: 'bg-[#3B82F6]',
  DEPOSIT_CONFIRMED: 'bg-[#8B6914]',
  ORDER_SUBMITTED: 'bg-[#E67E22]',
  ORDER_UPDATED: 'bg-[#E67E22]',
  RESERVATION_CANCELLED: 'bg-[#C4533A]',
  SETTINGS_UPDATED: 'bg-[#3B82F6]',
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount)
}

export function getWeekRange(): { start: string; end: string; dates: Date[] } {
  const now = new Date()
  const day = now.getDay()
  const sunday = new Date(now)
  sunday.setDate(now.getDate() - day) // Sunday start (US convention)
  sunday.setHours(0, 0, 0, 0)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  saturday.setHours(23, 59, 59, 999)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    dates.push(d)
  }

  return {
    start: sunday.toISOString().split('T')[0],
    end: saturday.toISOString().split('T')[0],
    dates,
  }
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function activityText(log: ActivityLog, t: (key: string, params?: any) => string, dateLocale: string = 'en-US'): string {
  const details = log.details as Record<string, string> | null
  const userName = log.user?.name || log.user?.email || 'Unknown'
  switch (log.action) {
    case 'RESERVATION_CREATED':
      return t('activityLog.reservationCreated', { userName, date: details?.date ? new Date(details.date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' }) : '' })
    case 'DEPOSIT_CONFIRMED':
      return t('activityLog.depositConfirmed', { userName })
    case 'ORDER_SUBMITTED':
      return t('activityLog.orderSubmitted', { userName })
    case 'RESERVATION_MODIFIED':
      return t('activityLog.reservationModified', { userName })
    case 'RESERVATION_RESCHEDULED':
      return t('activityLog.reservationRescheduled', { userName })
    case 'RESERVATION_CANCELLED':
      return t('activityLog.reservationCancelled', { userName })
    case 'ORDER_UPDATED':
      return t('activityLog.orderUpdated', { userName })
    case 'SETTINGS_UPDATED':
      return t('activityLog.settingsUpdated', { userName })
    default:
      return t('activityLog.default', { action: log.action, userName })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function timeAgo(dateStr: string, t: (key: string, params?: any) => string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('timeAgo.justNow')
  if (mins < 60) return t('timeAgo.minutesAgo', { minutes: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('timeAgo.hoursAgo', { hours: hrs })
  const days = Math.floor(hrs / 24)
  return t('timeAgo.daysAgo', { days })
}

export function hoursUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 3600000
}

export function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours()
  if (hour < 12) return t('greeting.morning')
  if (hour < 18) return t('greeting.afternoon')
  return t('greeting.evening')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatTodayDate(t: (key: string, params?: any) => string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = t(`weekdays.${now.getDay()}`)
  return t('todayDate', { year, month, day, weekday })
}

// ── Stat card type ─────────────────────────────────────────────────

export interface StatCard {
  icon: typeof CalendarIcon
  iconBg: string
  iconColor: string
  value: string
  label: string
  pulse?: boolean
  href?: string
}

export interface LegendItem {
  status: CellStatus
  label: string
}

export interface ActivityItem {
  color: string
  text: string
  time: string
}

// ── Hook ───────────────────────────────────────────────────────────

export function useDashboardData() {
  const t = useTranslations('admin.dashboard')
  const locale = useLocale()
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'
  const { data: session } = useSession()

  const today = toDateStr(new Date())
  const week = useMemo(() => getWeekRange(), [])
  const monthStart = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return toDateStr(d)
  }, [])
  const monthEnd = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 0)
    return toDateStr(d)
  }, [])

  const [remindingSoon, setRemindingSoon] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Shared SWR options: avoid refetch on focus, dedupe within 30s
  const swrOpts = { revalidateOnFocus: false, dedupingInterval: 30000 }

  // Fetch all data
  const { data: todayRes, error: todayErr, mutate: mutateTodayRes } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${today}&endDate=${today}`,
    fetcher, swrOpts
  )
  const { data: pendingDeposits, error: pendingDepErr, mutate: mutatePendingDeposits } = useSWR<Reservation[]>(
    '/api/reservations?status=PAYMENT_SUBMITTED',
    fetcher, swrOpts
  )
  const { data: pendingPayment, mutate: mutatePendingPayment } = useSWR<Reservation[]>(
    '/api/reservations?status=PENDING_PAYMENT',
    fetcher, swrOpts
  )
  // Cancelled reservations with unrefunded deposits
  const { data: allReservations } = useSWR<Reservation[]>(
    '/api/reservations',
    fetcher, swrOpts
  )
  const pendingRefunds = useMemo(() => {
    if (!allReservations) return []
    return allReservations.filter(r =>
      r.status === 'CANCELLED' && r.depositStatus === 'CONFIRMED' && r.depositAmount > 0
    )
  }, [allReservations])
  const pendingRefundCount = pendingRefunds.length

  const { data: weekRes, error: weekErr, mutate: mutateWeekRes } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${week.start}&endDate=${week.end}`,
    fetcher, swrOpts
  )
  const { data: monthRes, error: monthErr, mutate: mutateMonthRes } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${monthStart}&endDate=${monthEnd}`,
    fetcher, swrOpts
  )
  const { data: yurts } = useSWR<Yurt[]>('/api/yurts', fetcher, swrOpts)
  const { data: activityLogs, mutate: mutateActivityLogs } = useSWR<ActivityLog[]>('/api/activity-logs?limit=6', fetcher, {
    ...swrOpts,
    onError: () => {/* activity logs endpoint may not exist yet, silently ignore */},
  })

  // Fetch real orders counts for the stat card
  const { data: submittedOrders } = useSWR<{ length: number }[]>('/api/orders?status=SUBMITTED', fetcher, {
    ...swrOpts,
    onError: () => {},
  })
  const submittedOrderCount = Array.isArray(submittedOrders) ? submittedOrders.length : 0

  const hasError = !!(todayErr || pendingDepErr || weekErr || monthErr)

  // Compute stats
  const todayCount = todayRes?.length ?? 0
  const pendingDepositCount = pendingDeposits?.length ?? 0
  const monthRevenue = useMemo(() => {
    if (!monthRes) return 0
    return monthRes
      .filter(r => r.depositStatus === 'CONFIRMED')
      .reduce((sum, r) => sum + r.depositAmount, 0)
  }, [monthRes])

  // Expiring soon: PENDING_PAYMENT with deadline within 24h
  const expiringSoon = useMemo(() => {
    if (!pendingPayment) return []
    return pendingPayment.filter(r => {
      if (!r.paymentDeadline) return false
      const hrs = hoursUntil(r.paymentDeadline)
      return hrs > 0 && hrs <= 24
    })
  }, [pendingPayment])

  // Week overview grid
  const activeYurts = useMemo(() => {
    if (!yurts) return []
    return yurts.filter(y => y.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder)
  }, [yurts])

  const weekGrid = useMemo(() => {
    if (!activeYurts.length || !weekRes) return null
    return activeYurts.map(yurt => {
      return week.dates.map(date => {
        const dateStr = toDateStr(date)
        const match = weekRes.find(
          r => r.yurtId === yurt.id && r.date.startsWith(dateStr) &&
            r.status !== 'CANCELLED' && r.status !== 'CANCELLED_PENDING_REFUND' && r.status !== 'EXPIRED'
        )
        if (match) return STATUS_TO_CELL[match.status] || 'confirmed' as CellStatus
        return 'available' as CellStatus
      })
    })
  }, [activeYurts, weekRes, week.dates])

  // Use real activity logs if available, otherwise empty
  const activities: ActivityItem[] = useMemo(() => {
    if (!activityLogs || !Array.isArray(activityLogs)) return []
    return activityLogs.map(log => ({
      color: ACTIVITY_DOT_COLOR[log.action] || 'bg-[#3B82F6]',
      text: activityText(log, t, dateLocale),
      time: timeAgo(log.createdAt, t),
    }))
  }, [activityLogs, t, dateLocale])

  const userName = session?.user?.name || ''

  const statCards: StatCard[] = [
    {
      icon: CalendarIcon,
      iconBg: 'bg-[#EBF4FF]',
      iconColor: 'text-[#3B82F6]',
      value: String(todayCount),
      label: t('stats.todayReservations'),
      href: '/admin/calendar',
    },
    {
      icon: Clock4,
      iconBg: 'bg-[#FFF8E1]',
      iconColor: 'text-[#8B6914]',
      value: String(pendingDepositCount),
      label: t('stats.pendingDeposits'),
      pulse: pendingDepositCount > 0,
      href: '/admin/reservations?status=PAYMENT_SUBMITTED',
    },
    {
      icon: Utensils,
      iconBg: 'bg-[#FFF3E0]',
      iconColor: 'text-[#E67E22]',
      value: String(submittedOrderCount),
      label: t('stats.pendingOrders'),
      pulse: submittedOrderCount > 0,
      href: '/admin/reservations?tab=orders',
    },
    {
      icon: DollarSign,
      iconBg: 'bg-[#E8F5E9]',
      iconColor: 'text-[#4A7C59]',
      value: formatCurrency(monthRevenue),
      label: t('stats.monthRevenue'),
      href: '/admin/reports',
    },
  ]

  const legendItems: LegendItem[] = [
    { status: 'available', label: t('legend.available') },
    { status: 'pending', label: t('legend.pending') },
    { status: 'confirmed', label: t('legend.confirmed') },
    { status: 'completed', label: t('legend.completed') },
  ]

  // Mutation helper: refresh all data after creating a reservation
  const mutateAll = () => {
    mutateTodayRes()
    mutatePendingDeposits()
    mutatePendingPayment()
    mutateWeekRes()
    mutateMonthRes()
    mutateActivityLogs()
  }

  // Remind handler
  const handleRemind = async (reservationId: string) => {
    setRemindingSoon(reservationId)
    try {
      const res = await fetch(`/api/reservations/${reservationId}/remind`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        console.error('Remind failed:', data.error)
      }
    } catch (err) {
      console.error('Remind request failed:', err)
    }
    setTimeout(() => setRemindingSoon(null), 2000)
  }

  return {
    t,
    today,
    week,
    userName,
    hasError,
    todayRes,
    todayCount,
    pendingDeposits,
    pendingDepositCount,
    pendingRefunds,
    pendingRefundCount,
    submittedOrderCount,
    monthRevenue,
    expiringSoon,
    activeYurts,
    weekGrid,
    activities,
    statCards,
    legendItems,
    remindingSoon,
    showCreateModal,
    setShowCreateModal,
    mutateAll,
    handleRemind,
  }
}
