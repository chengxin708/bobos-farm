"use client"

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { Download, Calendar, DollarSign, Users, TrendingDown } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────

interface Reservation {
  id: string
  userId: string
  yurtId: string
  date: string
  guestCount: number
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  createdAt: string
  user: { id: string; name: string | null; email: string }
  yurt: { id: string; name: string; capacity: number }
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

type TimeRange = 'week' | 'month' | 'lastMonth' | 'year' | 'custom'

function getDateRange(range: TimeRange): { start: string; end: string; label: string } {
  const now = new Date()

  switch (range) {
    case 'week': {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((day + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0],
        label: 'This Week',
      }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        label: 'This Month',
      }
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        label: 'Last Month',
      }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31)
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        label: 'This Year',
      }
    }
    default: {
      // Default to this year for custom
      const start = new Date(now.getFullYear(), 0, 1)
      return {
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        label: 'Custom',
      }
    }
  }
}

const YURT_COLORS = ['#8B6914', '#5B8C3E', '#C4724B', '#3B82F6', '#9333EA']

// ── Component ──────────────────────────────────────────────────────

export default function Reports() {
  const t = useTranslations('admin.reports')
  const [activeRange, setActiveRange] = useState<TimeRange>('year')

  const dateRange = useMemo(() => getDateRange(activeRange), [activeRange])

  // Fetch all reservations in range
  const { data: reservations } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${dateRange.start}&endDate=${dateRange.end}`,
    fetcher
  )

  // ── Computed stats ──────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!reservations) return { total: 0, revenue: 0, avgParty: 0, cancelRate: 0 }

    const total = reservations.length
    const revenue = reservations
      .filter(r => r.depositStatus === 'CONFIRMED')
      .reduce((sum, r) => sum + r.depositAmount, 0)
    const cancelled = reservations.filter(r => r.status === 'CANCELLED').length
    const avgParty = total > 0
      ? Math.round((reservations.reduce((s, r) => s + r.guestCount, 0) / total) * 10) / 10
      : 0
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0

    return { total, revenue, avgParty, cancelRate }
  }, [reservations])

  // ── Reservation trend (weekly) ──────────────────────────────────

  const trendData = useMemo(() => {
    if (!reservations || reservations.length === 0) return []

    // Group by week number
    const weekMap = new Map<string, { reservations: number; cancellations: number }>()
    reservations.forEach(r => {
      const d = new Date(r.date)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = `W${Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000))}`

      const existing = weekMap.get(key) || { reservations: 0, cancellations: 0 }
      existing.reservations++
      if (r.status === 'CANCELLED') existing.cancellations++
      weekMap.set(key, existing)
    })

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([name, data]) => ({ name, ...data }))
  }, [reservations])

  // ── Monthly revenue (bar chart) ─────────────────────────────────

  const revenueData = useMemo(() => {
    if (!reservations) return []

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthMap = new Map<number, number>()

    reservations
      .filter(r => r.depositStatus === 'CONFIRMED')
      .forEach(r => {
        const month = new Date(r.date).getMonth()
        monthMap.set(month, (monthMap.get(month) || 0) + r.depositAmount)
      })

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([month, revenue]) => ({ name: monthNames[month], revenue }))
  }, [reservations])

  // ── Yurt utilization (pie chart) ────────────────────────────────

  const yurtData = useMemo(() => {
    if (!reservations || reservations.length === 0) return []

    const yurtMap = new Map<string, { name: string; count: number }>()
    reservations.forEach(r => {
      const existing = yurtMap.get(r.yurtId)
      if (existing) {
        existing.count++
      } else {
        yurtMap.set(r.yurtId, { name: r.yurt.name, count: 1 })
      }
    })

    const total = reservations.length
    return Array.from(yurtMap.values()).map((y, i) => ({
      name: y.name,
      value: Math.round((y.count / total) * 100),
      color: YURT_COLORS[i % YURT_COLORS.length],
    }))
  }, [reservations])

  const totalUtilization = yurtData.reduce((s, y) => s + y.value, 0)

  // ── Popular dishes (placeholder until orders data available) ────

  const popularDishes = [
    { name: 'Whole Roasted Lamb', orders: 145 },
    { name: 'Grilled Lamb Chops', orders: 128 },
    { name: 'Harvest Salad', orders: 115 },
    { name: 'BBQ Ribs', orders: 98 },
    { name: 'Mushroom Medley', orders: 84 },
    { name: 'Berry Cobbler', orders: 76 },
    { name: 'Roast Chicken', orders: 65 },
  ]

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: 'week', label: t('timeRanges.thisWeek') },
    { key: 'month', label: t('timeRanges.thisMonth') },
    { key: 'lastMonth', label: t('timeRanges.lastMonth') },
    { key: 'year', label: t('timeRanges.thisYear') },
    { key: 'custom', label: t('timeRanges.custom') },
  ]

  const statCards = [
    { value: String(stats.total), label: t('stats.totalReservations'), bg: 'bg-amber', icon: Calendar },
    { value: `$${stats.revenue.toLocaleString()}`, label: t('stats.revenue'), bg: 'bg-green', icon: DollarSign },
    { value: String(stats.avgParty), label: t('stats.avgPartySize'), bg: 'bg-[#C4724B]', icon: Users },
    { value: `${stats.cancelRate}%`, label: t('stats.cancelRate'), bg: 'bg-brown', icon: TrendingDown },
  ]

  // ── CSV export ──────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (!reservations) return
    const headers = ['Date', 'Guest', 'Yurt', 'Guests', 'Status', 'Deposit', 'Deposit Status']
    const rows = reservations.map(r => [
      r.date,
      r.user.name || r.user.email,
      r.yurt.name,
      r.guestCount,
      r.status,
      r.depositAmount,
      r.depositStatus,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reservations-${dateRange.start}-${dateRange.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* Time Range + Export */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {timeRanges.map((r) => (
              <button
                key={r.key}
                onClick={() => setActiveRange(r.key)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md ${
                  activeRange === r.key ? 'bg-amber text-white' : 'bg-white text-brown border border-beige'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-sm text-brown border border-beige bg-white px-3 py-1.5 rounded-md"
            >
              <Download size={14} /> {t('export.csv')}
            </button>
            <button className="flex items-center gap-1.5 text-sm text-brown border border-beige bg-white px-3 py-1.5 rounded-md">
              <Download size={14} /> {t('export.pdf')}
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="flex gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 ${card.bg} rounded-full flex items-center justify-center text-white`}>
                <card.icon size={20} />
              </div>
              <div>
                <div className="text-2xl font-bold text-brown">{card.value}</div>
                <div className="text-xs text-gray-text">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="flex gap-5">
          {/* Reservation Trend */}
          <div className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-brown">{t('charts.reservationTrend')}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-text">
                  <span className="w-3 h-0.5 bg-blue inline-block" /> {t('charts.reservations')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-text">
                  <span className="w-3 h-0.5 bg-red inline-block" /> {t('charts.cancellations')}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8A8A8A' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A8A' }} />
                <Tooltip />
                <Line type="monotone" dataKey="reservations" stroke="#3B82F6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cancellations" stroke="#DC3545" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Revenue */}
          <div className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-brown">{t('charts.monthlyRevenue')}</span>
              <span className="text-xs text-gray-text">{t('charts.last7Months')}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8A8A8A' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A8A' }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8B6914" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="flex gap-5">
          {/* Popular Dishes */}
          <div className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-brown">{t('charts.popularDishes')}</span>
              <span className="text-xs text-gray-text">{t('charts.totalOrdersPerItem')}</span>
            </div>
            <div className="flex flex-col gap-3">
              {popularDishes.map((dish, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-brown w-28 truncate">{dish.name}</span>
                  <div className="flex-1 bg-cream-bg rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber"
                      style={{ width: `${(dish.orders / 145) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-brown w-8 text-right">{dish.orders}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Yurt Utilization */}
          <div className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm">
            <span className="text-sm font-bold text-brown block mb-4">{t('charts.yurtUtilization')}</span>
            <div className="flex items-center gap-6">
              {yurtData.length > 0 ? (
                <>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={yurtData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {yurtData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="#3D2B1F">
                        {totalUtilization}%
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {yurtData.map((y) => (
                      <div key={y.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: y.color }} />
                        <span className="text-xs text-brown">{y.name}</span>
                        <span className="text-xs font-semibold text-brown">{y.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full text-center py-8 text-sm text-gray-text">
                  No reservation data available for this period
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
