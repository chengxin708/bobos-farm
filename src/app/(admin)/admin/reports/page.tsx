"use client"

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import AdminTopBar from '@/components/admin/AdminTopBar'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Download, Calendar, DollarSign, Users, TrendingDown, ClipboardList, ShoppingCart, Lock, Send } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

interface OrderReportData {
  topItems: { nameEn: string; nameZh: string | null; totalQuantity: number; totalRevenue: number }[]
  stats: {
    totalOrders: number
    submittedOrders: number
    lockedOrders: number
    totalRevenue: number
  }
  monthlyOrders: { month: string; count: number; revenue: number }[]
  categoryBreakdown: { category: string; itemCount: number; revenue: number }[]
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

const YURT_COLORS = ['#6B7F5E', '#C47D52', '#2980B9', '#9333EA', '#DC3545']
const CATEGORY_COLORS = ['#6B7F5E', '#C47D52', '#2980B9', '#9333EA', '#EC4899', '#D97706', '#7C3AED', '#059669']

// ── Component ──────────────────────────────────────────────────────

export default function Reports() {
  const t = useTranslations('admin.reports')
  const isMobile = useIsMobile()
  const [activeRange, setActiveRange] = useState<TimeRange>('year')

  const dateRange = useMemo(() => getDateRange(activeRange), [activeRange])

  // Fetch all reservations in range
  const { data: reservations } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${dateRange.start}&endDate=${dateRange.end}`,
    fetcher
  )

  // Fetch order analytics
  const { data: orderData } = useSWR<OrderReportData>(
    '/api/reports/orders',
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

  // ── Popular dishes data (for bar chart) ─────────────────────────

  const popularDishesData = useMemo(() => {
    if (!orderData?.topItems) return []
    return orderData.topItems.map(item => ({
      name: item.nameEn.length > 20 ? item.nameEn.slice(0, 18) + '...' : item.nameEn,
      quantity: item.totalQuantity,
      revenue: item.totalRevenue,
    }))
  }, [orderData])

  // ── Category pie data ───────────────────────────────────────────

  const categoryPieData = useMemo(() => {
    if (!orderData?.categoryBreakdown) return []
    return orderData.categoryBreakdown.map((cat, i) => ({
      name: cat.category,
      value: cat.revenue,
      itemCount: cat.itemCount,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
  }, [orderData])

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: 'week', label: t('timeRanges.thisWeek') },
    { key: 'month', label: t('timeRanges.thisMonth') },
    { key: 'lastMonth', label: t('timeRanges.lastMonth') },
    { key: 'year', label: t('timeRanges.thisYear') },
    { key: 'custom', label: t('timeRanges.custom') },
  ]

  const statCards = [
    { value: String(stats.total), label: t('stats.totalReservations'), bg: 'bg-[#6B7F5E]', icon: Calendar },
    { value: `$${stats.revenue.toLocaleString()}`, label: t('stats.revenue'), bg: 'bg-[#C47D52]', icon: DollarSign },
    { value: String(stats.avgParty), label: t('stats.avgPartySize'), bg: 'bg-[#2980B9]', icon: Users },
    { value: `${stats.cancelRate}%`, label: t('stats.cancelRate'), bg: 'bg-[#8C8478]', icon: TrendingDown },
  ]

  const orderStatCards = orderData ? [
    { value: String(orderData.stats.totalOrders), label: t('orderStats.totalOrders'), bg: 'bg-[#6B7F5E]', icon: ClipboardList },
    { value: `$${orderData.stats.totalRevenue.toLocaleString()}`, label: t('orderStats.preOrderRevenue'), bg: 'bg-[#C47D52]', icon: ShoppingCart },
    { value: String(orderData.stats.submittedOrders), label: t('orderStats.submitted'), bg: 'bg-[#2980B9]', icon: Send },
    { value: String(orderData.stats.lockedOrders), label: t('orderStats.locked'), bg: 'bg-[#8C8478]', icon: Lock },
  ] : []

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
      {isMobile && <AdminTopBar title={t('title')} />}
      <div className="flex-1 p-4 md:p-6 flex flex-col gap-4 md:gap-5 overflow-auto">
        {/* Time Range + Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1 flex-wrap">
            {timeRanges.map((r) => (
              <button
                key={r.key}
                onClick={() => setActiveRange(r.key)}
                className={`px-3 md:px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  activeRange === r.key
                    ? 'bg-[#6B7F5E] text-white'
                    : 'bg-white text-[#1A1208] border border-[#E8ECE4] hover:bg-[#F8F7F4]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-sm text-[#1A1208] border border-[#E8ECE4] bg-white px-3 py-1.5 rounded-lg hover:bg-[#F8F7F4] transition-colors"
            >
              <Download size={14} /> {t('export.csv')}
            </button>
            <button className="flex items-center gap-1.5 text-sm text-[#1A1208] border border-[#E8ECE4] bg-white px-3 py-1.5 rounded-lg hover:bg-[#F8F7F4] transition-colors">
              <Download size={14} /> {t('export.pdf')}
            </button>
          </div>
        </div>

        {/* Reservation Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-4 md:p-5 border border-[#E8ECE4] flex items-center gap-3 md:gap-4">
              <div className={`w-10 h-10 ${card.bg} rounded-full flex items-center justify-center text-white shrink-0`}>
                <card.icon size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-xl md:text-2xl font-bold text-[#1A1208]">{card.value}</div>
                <div className="text-xs text-[#8C8478] truncate">{card.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Stat Cards */}
        {orderStatCards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {orderStatCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl p-4 md:p-5 border border-[#E8ECE4] flex items-center gap-3 md:gap-4">
                <div className={`w-10 h-10 ${card.bg} rounded-full flex items-center justify-center text-white shrink-0`}>
                  <card.icon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl md:text-2xl font-bold text-[#1A1208]">{card.value}</div>
                  <div className="text-xs text-[#8C8478] truncate">{card.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {/* Reservation Trend */}
          <div className="flex-1 bg-white rounded-xl p-5 md:p-6 border border-[#E8ECE4]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[#1A1208] font-serif">{t('charts.reservationTrend')}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-[#8C8478]">
                  <span className="w-3 h-0.5 bg-[#2980B9] inline-block" /> {t('charts.reservations')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#8C8478]">
                  <span className="w-3 h-0.5 bg-[#DC3545] inline-block" /> {t('charts.cancellations')}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8ECE4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8C8478' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8C8478' }} />
                <Tooltip />
                <Line type="monotone" dataKey="reservations" stroke="#2980B9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cancellations" stroke="#DC3545" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Revenue */}
          <div className="flex-1 bg-white rounded-xl p-5 md:p-6 border border-[#E8ECE4]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[#1A1208] font-serif">{t('charts.monthlyRevenue')}</span>
              <span className="text-xs text-[#8C8478]">{t('charts.last7Months')}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueData.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8ECE4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8C8478' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8C8478' }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#6B7F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 — Popular Dishes + Yurt Utilization */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {/* Popular Dishes — horizontal bar chart */}
          <div className="flex-1 bg-white rounded-xl p-5 md:p-6 border border-[#E8ECE4]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[#1A1208] font-serif">{t('charts.popularDishes')}</span>
              <span className="text-xs text-[#8C8478]">{t('charts.totalOrdersPerItem')}</span>
            </div>
            {popularDishesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, popularDishesData.length * 36)}>
                <BarChart data={popularDishesData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8ECE4" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8C8478' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11, fill: '#8C8478' }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const v = Number(value ?? 0)
                      return [
                        name === 'quantity' ? `${v} ordered` : `$${v.toFixed(2)}`,
                        name === 'quantity' ? 'Quantity' : 'Revenue',
                      ]
                    }}
                  />
                  <Bar dataKey="quantity" fill="#C47D52" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList size={32} className="text-[#E8ECE4] mb-3" />
                <p className="text-sm text-[#8C8478]">
                  {t('charts.noOrderData')}
                </p>
              </div>
            )}
          </div>

          {/* Yurt Utilization */}
          <div className="flex-1 bg-white rounded-xl p-5 md:p-6 border border-[#E8ECE4]">
            <span className="text-sm font-semibold text-[#1A1208] font-serif block mb-4">{t('charts.yurtUtilization')}</span>
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
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="#1A1208">
                        {totalUtilization}%
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {yurtData.map((y) => (
                      <div key={y.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: y.color }} />
                        <span className="text-xs text-[#1A1208]">{y.name}</span>
                        <span className="text-xs font-semibold text-[#1A1208]">{y.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full text-center py-8 text-sm text-[#8C8478]">
                  No reservation data available for this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 3 — Monthly Orders Trend + Category Breakdown */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-5">
          {/* Monthly Orders Trend */}
          <div className="flex-1 bg-white rounded-xl p-5 md:p-6 border border-[#E8ECE4]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-[#1A1208] font-serif">{t('charts.monthlyOrders')}</span>
              <span className="text-xs text-[#8C8478]">{t('charts.last6Months')}</span>
            </div>
            {orderData?.monthlyOrders && orderData.monthlyOrders.some(m => m.count > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={orderData.monthlyOrders}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8ECE4" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8C8478' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#8C8478' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#8C8478' }} />
                  <Tooltip />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) =>
                      value === 'count' ? t('charts.orderCount') : t('charts.orderRevenue')
                    }
                  />
                  <Line yAxisId="left" type="monotone" dataKey="count" stroke="#6B7F5E" strokeWidth={2} dot={{ fill: '#6B7F5E', r: 3 }} name="count" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#C47D52" strokeWidth={2} dot={{ fill: '#C47D52', r: 3 }} name="revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList size={32} className="text-[#E8ECE4] mb-3" />
                <p className="text-sm text-[#8C8478]">{t('charts.noOrderData')}</p>
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="flex-1 bg-white rounded-xl p-5 md:p-6 border border-[#E8ECE4]">
            <span className="text-sm font-semibold text-[#1A1208] font-serif block mb-4">{t('charts.categoryBreakdown')}</span>
            <div className="flex items-center gap-6">
              {categoryPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {categoryPieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, 'Revenue']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {categoryPieData.map((c) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
                        <span className="text-xs text-[#1A1208]">{c.name}</span>
                        <span className="text-xs font-semibold text-[#1A1208]">${c.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="w-full text-center py-8 text-sm text-[#8C8478]">
                  {t('charts.noOrderData')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
