"use client"

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import CreateReservationModal from '@/components/admin/CreateReservationModal'
import Link from 'next/link'
import {
  Calendar as CalendarIcon,
  Clock4,
  Utensils,
  DollarSign,
  TriangleAlert,
  Activity,
  CalendarPlus,
  Eye,
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

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

type CellStatus = 'available' | 'pending' | 'confirmed' | 'completed'

const STATUS_TO_CELL: Record<string, CellStatus> = {
  CONFIRMED: 'confirmed',
  PENDING_PAYMENT: 'pending',
  PAYMENT_SUBMITTED: 'pending',
  COMPLETED: 'completed',
}

const CELL_STYLES: Record<CellStatus, { bg: string; ring: string }> = {
  available: { bg: 'bg-[#4A7C59]', ring: '' },
  pending: { bg: 'bg-[#D4A017]', ring: '' },
  confirmed: { bg: 'bg-[#3B82F6]', ring: '' },
  completed: { bg: 'bg-[#9CA3AF]', ring: '' },
}

const ACTIVITY_DOT_COLOR: Record<string, string> = {
  RESERVATION_CREATED: 'bg-[#4A7C59]',
  DEPOSIT_CONFIRMED: 'bg-[#8B6914]',
  ORDER_SUBMITTED: 'bg-[#E67E22]',
  RESERVATION_CANCELLED: 'bg-[#C4533A]',
  SETTINGS_UPDATED: 'bg-[#3B82F6]',
}

function activityText(log: ActivityLog): string {
  const details = log.details as Record<string, string> | null
  const userName = log.user?.name || log.user?.email || 'Unknown'
  switch (log.action) {
    case 'RESERVATION_CREATED':
      return `新预订: ${userName} — ${details?.date ? new Date(details.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : ''}`
    case 'DEPOSIT_CONFIRMED':
      return `定金已确认: ${userName}`
    case 'ORDER_SUBMITTED':
      return `订单已提交: ${userName}`
    case 'RESERVATION_CANCELLED':
      return `已取消: ${userName}`
    case 'SETTINGS_UPDATED':
      return `${userName} 更新了设置`
    default:
      return `${log.action}: ${userName}`
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  return `${days}天前`
}

function hoursUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / 3600000
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function formatTodayDate(): string {
  const now = new Date()
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = weekdays[now.getDay()]
  return `${year}年${month}月${day}日 · ${weekday}`
}

// ── Component ──────────────────────────────────────────────────────

export default function Dashboard() {
  const t = useTranslations('admin.dashboard')
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
        if (match) return STATUS_TO_CELL[match.status] || 'confirmed' as CellStatus
        return 'available' as CellStatus
      })
    })
  }, [activeYurts, weekRes, week.dates])

  // Use real activity logs if available, otherwise empty
  const activities = useMemo(() => {
    if (!activityLogs || !Array.isArray(activityLogs)) return []
    return activityLogs.map(log => ({
      color: ACTIVITY_DOT_COLOR[log.action] || 'bg-[#3B82F6]',
      text: activityText(log),
      time: timeAgo(log.createdAt),
    }))
  }, [activityLogs])

  const userName = session?.user?.name || ''

  const statCards = [
    {
      icon: CalendarIcon,
      iconBg: 'bg-[#EBF4FF]',
      iconColor: 'text-[#3B82F6]',
      value: String(todayCount),
      label: t('stats.todayReservations'),
    },
    {
      icon: Clock4,
      iconBg: 'bg-[#FFF8E1]',
      iconColor: 'text-[#8B6914]',
      value: String(pendingDepositCount),
      label: t('stats.pendingDeposits'),
      pulse: pendingDepositCount > 0,
    },
    {
      icon: Utensils,
      iconBg: 'bg-[#FFF3E0]',
      iconColor: 'text-[#E67E22]',
      value: String(pendingActionCount),
      label: t('stats.pendingOrders'),
    },
    {
      icon: DollarSign,
      iconBg: 'bg-[#E8F5E9]',
      iconColor: 'text-[#4A7C59]',
      value: formatCurrency(monthRevenue),
      label: t('stats.monthRevenue'),
    },
  ]

  const legendItems: { status: CellStatus; label: string }[] = [
    { status: 'available', label: t('legend.available') },
    { status: 'pending', label: t('legend.pending') },
    { status: 'confirmed', label: t('legend.confirmed') },
    { status: 'completed', label: t('legend.completed') },
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F5F2ED' }}>
        <div className="p-6 flex flex-col gap-5 max-w-[1400px]">

          {/* Error Banner */}
          {hasError && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
              Failed to load some dashboard data. Please refresh the page to try again.
            </div>
          )}

          {/* ─── Greeting Banner ─── */}
          <div
            className="rounded-xl p-6 flex items-center justify-between"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', borderLeft: '4px solid #8B6914' }}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold font-playfair" style={{ color: '#2C2416' }}>
                {getGreeting()}{userName ? `，${userName}` : ''}
              </h2>
              <span className="text-sm" style={{ color: '#8A7E6B' }}>
                {formatTodayDate()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 hover:bg-[#F5F0E8] cursor-pointer"
                style={{ color: '#2C2416', border: '1px solid #E8E2D9' }}
              >
                <CalendarPlus size={15} style={{ color: '#8B6914' }} />
                {t('actions.createReservation')}
              </button>
              <Link
                href="/admin/calendar"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 hover:bg-[#F5F0E8]"
                style={{ color: '#2C2416', border: '1px solid #E8E2D9' }}
              >
                <Eye size={15} style={{ color: '#8B6914' }} />
                {t('actions.openCalendar')}
              </Link>
            </div>
          </div>

          {/* ─── Stats Grid ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl p-6 flex flex-col gap-4"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <span className="text-xs font-medium tracking-wide uppercase" style={{ color: '#8A7E6B' }}>
                  {card.label}
                </span>
                <span className="text-[32px] font-bold leading-none" style={{ color: '#2C2416' }}>
                  {card.value}
                </span>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.iconBg.replace('bg-[', '').replace(']', '') }}>
                    <card.icon size={20} className={card.iconColor} />
                  </div>
                  {card.pulse && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#D4A017' }} />
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: '#8B6914' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ─── Two Column: Week Overview + Activity Feed ─── */}
          <div className="flex flex-col lg:flex-row gap-5">

            {/* Week Overview (60%) */}
            <div
              className="lg:w-[60%] rounded-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: '#2C2416' }}>
                  {t('weekOverview.title')}
                </span>
                <Link href="/admin/calendar" className="text-[13px] font-medium" style={{ color: '#8B6914' }}>
                  {t('weekOverview.viewCalendar')}
                </Link>
              </div>

              {/* Grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-3 w-[110px]" />
                      {DAY_LABELS.map((day, di) => {
                        const isToday = toDateStr(week.dates[di]) === today
                        return (
                          <th key={day} className="text-center py-2 px-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] font-semibold" style={{ color: isToday ? '#8B6914' : '#8A7E6B' }}>
                                {day}
                              </span>
                              <span
                                className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'text-white' : ''}`}
                                style={isToday ? { backgroundColor: '#8B6914', color: '#fff' } : { color: '#2C2416' }}
                              >
                                {week.dates[di]?.getDate()}
                              </span>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeYurts.map((yurt, ri) => (
                      <tr key={yurt.id} style={ri < activeYurts.length - 1 ? { borderBottom: '1px solid #F0EBE4' } : {}}>
                        <td className="py-2.5 pr-3">
                          <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: '#2C2416' }}>
                            {yurt.name}
                          </span>
                        </td>
                        {DAY_LABELS.map((_, di) => {
                          const cellStatus: CellStatus = weekGrid ? weekGrid[ri][di] : 'available'
                          const isLoading = !weekGrid
                          return (
                            <td key={di} className="text-center py-2.5 px-1">
                              {isLoading ? (
                                <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-200 animate-pulse" />
                              ) : (
                                <span
                                  className={`inline-block w-3.5 h-3.5 rounded-full ${CELL_STYLES[cellStatus].bg}`}
                                  title={legendItems.find(l => l.status === cellStatus)?.label}
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {activeYurts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm" style={{ color: '#8A7E6B' }}>
                          暂无营地数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 pt-1">
                {legendItems.map((l) => (
                  <div key={l.status} className="flex items-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${CELL_STYLES[l.status].bg}`} />
                    <span className="text-[11px]" style={{ color: '#8A7E6B' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Feed (40%) */}
            <div
              className="lg:w-[40%] rounded-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: '#2C2416' }}>
                  {t('activity.title')}
                </span>
                <span className="text-[13px] font-medium cursor-pointer" style={{ color: '#8B6914' }}>
                  {t('activity.viewAll')}
                </span>
              </div>

              {activities.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F5F2ED' }}>
                    <Activity size={22} style={{ color: '#8A7E6B' }} />
                  </div>
                  <span className="text-sm" style={{ color: '#8A7E6B' }}>暂无最近活动</span>
                </div>
              ) : (
                <div className="relative flex flex-col">
                  {/* Vertical timeline line */}
                  <div
                    className="absolute left-[5px] top-2 bottom-2 w-px"
                    style={{ backgroundColor: '#E8E2D9' }}
                  />
                  {activities.map((a, i) => (
                    <div
                      key={i}
                      className="relative flex items-start gap-3.5 py-3"
                      style={i < activities.length - 1 ? {} : {}}
                    >
                      {/* Timeline dot */}
                      <span className={`relative z-10 mt-1 shrink-0 w-[11px] h-[11px] rounded-full ring-2 ring-white ${a.color}`} />
                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium leading-snug" style={{ color: '#2C2416' }}>
                          {a.text}
                        </span>
                        <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                          {a.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Expiring Soon Alerts ─── */}
          {expiringSoon.length > 0 && (
            <div
              className="rounded-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', borderLeft: '4px solid #C4533A', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                  <TriangleAlert size={16} style={{ color: '#C4533A' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold" style={{ color: '#C4533A' }}>
                    {t('expiringSoon.title')}
                  </span>
                  <span className="text-[12px]" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.description')}
                  </span>
                </div>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8E2D9' }}>
                {/* Table Head */}
                <div className="flex items-center px-5 py-2.5" style={{ backgroundColor: '#FAF8F5' }}>
                  <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colCustomer')}
                  </span>
                  <span className="w-[100px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colDate')}
                  </span>
                  <span className="w-[130px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colYurt')}
                  </span>
                  <span className="w-[110px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colExpiresIn')}
                  </span>
                  <span className="w-[80px] text-[11px] font-semibold uppercase tracking-wide text-right" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colAction')}
                  </span>
                </div>
                {/* Table Rows */}
                {expiringSoon.map((row, i) => {
                  const hrs = row.paymentDeadline ? Math.max(0, Math.round(hoursUntil(row.paymentDeadline))) : 0
                  const isUrgent = hrs <= 6
                  return (
                    <div
                      key={row.id}
                      className="flex items-center px-5 py-3"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderTop: '1px solid #F0EBE4',
                      }}
                    >
                      <span className="flex-1 text-[13px] font-medium" style={{ color: '#2C2416' }}>
                        {row.user.name || row.user.email}
                      </span>
                      <span className="w-[100px] text-[13px]" style={{ color: '#2C2416' }}>
                        {new Date(row.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="w-[130px] text-[13px]" style={{ color: '#2C2416' }}>
                        {row.yurt.name}
                      </span>
                      <div className="w-[110px]">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={
                            isUrgent
                              ? { backgroundColor: '#FEF2F2', color: '#C4533A' }
                              : { backgroundColor: '#FFF8E1', color: '#8B6914' }
                          }
                        >
                          <Clock4 size={11} />
                          {hrs} 小时
                        </span>
                      </div>
                      <div className="w-[80px] text-right">
                        <button
                          onClick={async () => {
                            setRemindingSoon(row.id)
                            try {
                              const res = await fetch(`/api/reservations/${row.id}/remind`, {
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
                          }}
                          disabled={remindingSoon === row.id}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-md transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                          style={
                            remindingSoon === row.id
                              ? { backgroundColor: '#E8E2D9', color: '#8A7E6B' }
                              : { backgroundColor: '#C4533A', color: '#FFFFFF' }
                          }
                        >
                          {remindingSoon === row.id ? '已发送' : t('expiringSoon.remind')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateReservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          mutateTodayRes()
          mutatePendingDeposits()
          mutatePendingPayment()
          mutateWeekRes()
          mutateMonthRes()
          mutateActivityLogs()
        }}
      />
    </>
  )
}
