"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { Download } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const reservationTrend = [
  { name: 'W1', reservations: 8, cancellations: 1 },
  { name: 'W2', reservations: 12, cancellations: 2 },
  { name: 'W3', reservations: 10, cancellations: 1 },
  { name: 'W4', reservations: 15, cancellations: 3 },
  { name: 'W5', reservations: 11, cancellations: 2 },
  { name: 'W6', reservations: 14, cancellations: 1 },
  { name: 'W7', reservations: 9, cancellations: 2 },
  { name: 'W8', reservations: 13, cancellations: 1 },
]

const monthlyRevenue = [
  { name: 'Jan', revenue: 8500 },
  { name: 'Feb', revenue: 9200 },
  { name: 'Mar', revenue: 14100 },
  { name: 'Apr', revenue: 11300 },
  { name: 'May', revenue: 12800 },
  { name: 'Jun', revenue: 15600 },
  { name: 'Jul', revenue: 16200 },
  { name: 'Aug', revenue: 14500 },
  { name: 'Sep', revenue: 11000 },
  { name: 'Oct', revenue: 9800 },
  { name: 'Nov', revenue: 8200 },
  { name: 'Dec', revenue: 10500 },
]

const popularDishes = [
  { name: 'Grilled Lamb', orders: 145 },
  { name: 'Grilled Lamb', orders: 128 },
  { name: 'Harvest Salad', orders: 115 },
  { name: 'BBQ Ribs', orders: 98 },
  { name: 'Mushroom Medl', orders: 84 },
  { name: 'Berry Cobbler', orders: 76 },
  { name: 'Roast Chicken', orders: 65 },
]

const yurtUtilization = [
  { name: 'Golden Meadow', value: 35, color: '#8B6914' },
  { name: 'Silver Creek', value: 28, color: '#5B8C3E' },
  { name: 'Jade Valley', value: 22, color: '#C4724B' },
  { name: 'Unused', value: 15, color: '#E8DFD0' },
]

export default function Reports() {
  const t = useTranslations('admin.reports')
  const [activeRange, setActiveRange] = useState(0)

  const timeRanges = [
    t('timeRanges.thisWeek'),
    t('timeRanges.thisMonth'),
    t('timeRanges.lastMonth'),
    t('timeRanges.thisYear'),
    t('timeRanges.custom'),
  ]

  const statCards = [
    { value: '47', label: t('stats.totalReservations'), bg: 'bg-amber', icon: '📋' },
    { value: '$14,100', label: t('stats.revenue'), bg: 'bg-green', icon: '💰' },
    { value: '11.3', label: t('stats.avgPartySize'), bg: 'bg-[#C4724B]', icon: '👥' },
    { value: '8.5%', label: t('stats.cancelRate'), bg: 'bg-brown', icon: '📊' },
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* Time Range + Export */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {timeRanges.map((r, i) => (
              <button
                key={r}
                onClick={() => setActiveRange(i)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md ${
                  activeRange === i ? 'bg-amber text-white' : 'bg-white text-brown border border-beige'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 text-sm text-brown border border-beige bg-white px-3 py-1.5 rounded-md">
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
              <div className={`w-10 h-10 ${card.bg} rounded-full flex items-center justify-center text-white text-lg`}>
                {card.icon}
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
                  <span className="w-3 h-0.5 bg-blue" /> {t('charts.reservations')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-text">
                  <span className="w-3 h-0.5 bg-red" /> {t('charts.cancellations')}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={reservationTrend}>
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
              <BarChart data={monthlyRevenue.slice(0, 7)}>
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
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={yurtUtilization}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {yurtUtilization.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="#3D2B1F">
                    72%
                  </text>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {yurtUtilization.map((y) => (
                  <div key={y.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: y.color }} />
                    <span className="text-xs text-brown">{y.name}</span>
                    <span className="text-xs font-semibold text-brown">{y.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
