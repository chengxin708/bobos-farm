"use client"

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import Link from 'next/link'
import {
  Calendar as CalendarIcon,
  Clock4,
  Utensils,
  DollarSign,
  Plus,
  Settings,
  TriangleAlert,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface ReservationUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

interface ReservationYurt {
  id: string
  name: string
  capacity: number
}

interface Reservation {
  id: string
  userId: string
  yurtId: string
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  paymentDeadline: string | null
  createdAt: string
  updatedAt: string
  user: ReservationUser
  yurt: ReservationYurt
}

interface Yurt {
  id: string
  name: string
  capacity: number
  status: string
  sortOrder: number
}

interface ActivityLog {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  user?: { name: string | null; email: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount)
}

function getWeekRange(): { start: string; end: string; dates: Date[] } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    dates,
  }
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: 'bg-green',
  PENDING_PAYMENT: 'bg-[#D4A017]',
  PAYMENT_SUBMITTED: 'bg-[#C4724B]',
  COMPLETED: 'bg-[#4A4A4A]',
}

const ACTIVITY_COLOR: Record<string, string> = {
  RESERVATION_CREATED: 'bg-blue',
  DEPOSIT_CONFIRMED: 'bg-green',
  ORDER_SUBMITTED: 'bg-[#C4724B]',
  RESERVATION_CANCELLED: 'bg-[#DC2626]',
  SETTINGS_UPDATED: 'bg-amber',
}

function activityText(log: ActivityLog): string {
  const details = log.details as Record<string, string> | null
  const userName = log.user?.name || log.user?.email || 'Unknown'
  switch (log.action) {
    case 'RESERVATION_CREATED':
      return `New booking: ${userName} — ${details?.date ? new Date(details.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
    case 'DEPOSIT_CONFIRMED':
      return `Deposit confirmed: ${userName}`
    case 'ORDER_SUBMITTED':
      return `Order submitted: ${userName}`
    case 'RESERVATION_CANCELLED':
      return `Cancelled: ${userName}`
    case 'SETTINGS_UPDATED':
      return `Settings updated by ${userName}`
    default:
      return `${log.action}: ${userName}`
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function hoursUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 3600000
}

// ── Component ──────────────────────────────────────────────────────

export default function Dashboard() {
  const t = useTranslations('admin.dashboard')

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

  // Shared SWR options: avoid refetch on focus, dedupe within 30s
  const swrOpts = { revalidateOnFocus: false, dedupingInterval: 30000 }

  // Fetch all data
  const { data: todayRes, error: todayErr } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${today}&endDate=${today}`,
    fetcher, swrOpts
  )
  const { data: pendingDeposits, error: pendingDepErr } = useSWR<Reservation[]>(
    '/api/reservations?status=PAYMENT_SUBMITTED',
    fetcher, swrOpts
  )
  const { data: pendingPayment } = useSWR<Reservation[]>(
    '/api/reservations?status=PENDING_PAYMENT',
    fetcher, swrOpts
  )
  const { data: weekRes, error: weekErr } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${week.start}&endDate=${week.end}`,
    fetcher, swrOpts
  )
  const { data: monthRes, error: monthErr } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${monthStart}&endDate=${monthEnd}`,
    fetcher, swrOpts
  )
  const { data: yurts } = useSWR<Yurt[]>('/api/yurts', fetcher, swrOpts)
  const { data: activityLogs } = useSWR<ActivityLog[]>('/api/activity-logs?limit=6', fetcher, {
    ...swrOpts,
    onError: () => {/* activity logs endpoint may not exist yet, silently ignore */},
  })

  const hasError = !!(todayErr || pendingDepErr || weekErr || monthErr)

  // Compute stats
  const todayCount = todayRes?.length ?? 0
  const pendingDepositCount = pendingDeposits?.length ?? 0
  const pendingActionCount = pendingDeposits?.length ?? 0
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
            r.status !== 'CANCELLED' && r.status !== 'EXPIRED'
        )
        if (match) return STATUS_COLOR[match.status] || 'bg-blue'
        return 'bg-blue' // available
      })
    })
  }, [activeYurts, weekRes, week.dates])

  const statCards = [
    { icon: CalendarIcon, iconBg: 'bg-blue', value: String(todayCount), label: t('stats.todayReservations') },
    { icon: Clock4, iconBg: 'bg-amber', value: String(pendingDepositCount), label: t('stats.pendingDeposits'), highlight: true },
    { icon: Utensils, iconBg: 'bg-[#C4724B]', value: String(pendingActionCount), label: t('stats.pendingOrders') },
    { icon: DollarSign, iconBg: 'bg-green', value: formatCurrency(monthRevenue), label: t('stats.monthRevenue') },
  ]

  const legend = [
    { color: 'bg-green', label: t('legend.available') },
    { color: 'bg-[#D4A017]', label: t('legend.pending') },
    { color: 'bg-blue', label: t('legend.confirmed') },
    { color: 'bg-[#4A4A4A]', label: t('legend.completed') },
  ]

  // Use real activity logs if available, otherwise empty
  const activities = useMemo(() => {
    if (!activityLogs || !Array.isArray(activityLogs)) return []
    return activityLogs.map(log => ({
      color: ACTIVITY_COLOR[log.action] || 'bg-blue',
      text: activityText(log),
      time: timeAgo(log.createdAt),
    }))
  }, [activityLogs])

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-6 bg-cream-bg overflow-auto">
        {/* Error Banner */}
        {hasError && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] rounded-lg px-4 py-3 text-sm">
            Failed to load some dashboard data. Please refresh the page to try again.
          </div>
        )}

        {/* Stat Cards */}
        <div className="flex gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`flex-1 flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border ${
                card.highlight
                  ? 'border-amber/25 shadow-[0_0_12px_2px_rgba(139,105,20,0.19)]'
                  : 'border-beige'
              }`}
            >
              <div className={`w-10 h-10 ${card.iconBg} rounded-full flex items-center justify-center`}>
                <card.icon size={20} className="text-white" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[28px] font-bold text-brown">{card.value}</span>
                <span className="text-sm text-gray-text">{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Link href="/admin/reservations" className="flex items-center gap-1.5 bg-amber text-white text-[13px] font-semibold px-4 py-2 rounded-md">
            <Plus size={14} /> {t('actions.createReservation')}
          </Link>
          <Link href="/admin/calendar" className="flex items-center gap-1.5 bg-white text-brown text-[13px] font-semibold px-4 py-2 rounded-md border border-beige">
            <CalendarIcon size={14} /> {t('actions.openCalendar')}
          </Link>
          <Link href="/admin/availability" className="flex items-center gap-1.5 bg-white text-brown text-[13px] font-semibold px-4 py-2 rounded-md border border-beige">
            <Settings size={14} /> {t('actions.manageAvailability')}
          </Link>
        </div>

        {/* Two Column: Week Overview + Activity Feed */}
        <div className="flex gap-5">
          {/* Week Overview */}
          <div className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-brown">{t('weekOverview.title')}</span>
              <Link href="/admin/calendar" className="text-[13px] font-semibold text-amber cursor-pointer">{t('weekOverview.viewCalendar')}</Link>
            </div>
            {/* Grid */}
            <div className="flex gap-1">
              {/* Labels column */}
              <div className="flex flex-col gap-1 w-[70px]">
                <div className="h-8" />
                {activeYurts.map((yurt) => (
                  <div key={yurt.id} className="h-8 flex items-center px-2">
                    <span className="text-xs font-semibold text-brown truncate">{yurt.name}</span>
                  </div>
                ))}
              </div>
              {/* Day columns */}
              {DAY_LABELS.map((day, di) => (
                <div key={day} className="flex-1 flex flex-col gap-1 items-center">
                  <div className="h-8 flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold text-gray-text">{day}</span>
                    <span className="text-[10px] text-muted-beige">{week.dates[di]?.getDate()}</span>
                  </div>
                  {weekGrid ? weekGrid.map((row, ri) => (
                    <div key={ri} className={`h-8 w-8 rounded ${row[di]}`} />
                  )) : activeYurts.map((_, ri) => (
                    <div key={ri} className="h-8 w-8 rounded bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4">
              {legend.map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                  <span className="text-[11px] text-gray-text">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="w-[420px] bg-white rounded-xl p-4 border border-beige shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-brown">{t('activity.title')}</span>
              <span className="text-xs font-semibold text-amber cursor-pointer">{t('activity.viewAll')}</span>
            </div>
            <div className="flex flex-col">
              {activities.length === 0 && (
                <div className="py-4 text-center text-xs text-gray-text">No recent activity</div>
              )}
              {activities.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 py-2 ${
                    i < activities.length - 1 ? 'border-b border-[#F0EBE4]' : ''
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${a.color} shrink-0`} />
                  <span className="text-xs font-medium text-brown flex-1 truncate">{a.text}</span>
                  <span className="text-[11px] text-muted-beige">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expiring Soon Alerts */}
        {expiringSoon.length > 0 && (
          <div className="bg-[#FFF0F0] rounded-xl p-5 border border-[#FECACA] flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <TriangleAlert size={18} className="text-[#DC2626]" />
              <span className="text-base font-bold text-[#DC2626]">{t('expiringSoon.title')}</span>
            </div>
            <p className="text-[13px] text-gray-text">
              {t('expiringSoon.description')}
            </p>
            <div className="rounded-lg border border-[#FECACA] overflow-hidden">
              {/* Table Head */}
              <div className="flex items-center bg-[#FEE2E2] px-4 py-2">
                <span className="flex-1 text-xs font-semibold text-[#991B1B]">{t('expiringSoon.colCustomer')}</span>
                <span className="w-[100px] text-xs font-semibold text-[#991B1B]">{t('expiringSoon.colDate')}</span>
                <span className="w-[120px] text-xs font-semibold text-[#991B1B]">{t('expiringSoon.colYurt')}</span>
                <span className="w-[100px] text-xs font-semibold text-[#991B1B]">{t('expiringSoon.colExpiresIn')}</span>
                <span className="w-[80px] text-xs font-semibold text-[#991B1B]">{t('expiringSoon.colAction')}</span>
              </div>
              {/* Table Rows */}
              {expiringSoon.map((row, i) => {
                const hrs = row.paymentDeadline ? Math.max(0, Math.round(hoursUntil(row.paymentDeadline))) : 0
                const isUrgent = hrs <= 10
                return (
                  <div
                    key={row.id}
                    className={`flex items-center bg-white px-4 py-2.5 ${
                      i < expiringSoon.length - 1 ? 'border-b border-[#FECACA]' : ''
                    }`}
                  >
                    <span className="flex-1 text-[13px] font-medium text-brown">{row.user.name || row.user.email}</span>
                    <span className="w-[100px] text-[13px] text-brown">
                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="w-[120px] text-[13px] text-brown">{row.yurt.name}</span>
                    <div className="w-[100px]">
                      <span className={`${isUrgent ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#FFF3E0] text-[#E65100]'} text-[11px] font-semibold px-2 py-0.5 rounded-full`}>
                        {hrs} hrs
                      </span>
                    </div>
                    <div className="w-[80px]">
                      <button
                        onClick={() => {
                          setRemindingSoon(row.id)
                          // Reminder is a placeholder — navigate to deposits for now
                          setTimeout(() => setRemindingSoon(null), 1500)
                        }}
                        disabled={remindingSoon === row.id}
                        className="bg-[#DC2626] text-white text-[11px] font-semibold px-3 py-1 rounded-md disabled:opacity-50"
                      >
                        {remindingSoon === row.id ? 'Sent' : t('expiringSoon.remind')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
