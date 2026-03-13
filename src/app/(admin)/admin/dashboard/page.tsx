"use client"

import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import {
  Calendar as CalendarIcon,
  Clock4,
  Utensils,
  DollarSign,
  Plus,
  Settings,
  TriangleAlert,
} from 'lucide-react'

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekDates = ['24', '25', '26', '27', '28', '29', '30']
const yurtColors = [
  ['bg-green', 'bg-blue', 'bg-green', 'bg-[#D4A017]', 'bg-blue', 'bg-[#4A4A4A]', 'bg-green'],
  ['bg-blue', 'bg-blue', 'bg-[#D4A017]', 'bg-green', 'bg-blue', 'bg-blue', 'bg-green'],
  ['bg-green', 'bg-[#D4A017]', 'bg-green', 'bg-blue', 'bg-blue', 'bg-green', 'bg-green'],
]

const yurtLabels = ['Yurt 1', 'Yurt 2', 'Yurt 3']

const activities = [
  { color: 'bg-blue', text: 'New booking: John Smith — Mar 15', time: '2h' },
  { color: 'bg-green', text: 'Deposit confirmed: Sarah Lee — Mar 20', time: '3h' },
  { color: 'bg-[#C4724B]', text: 'Order submitted: Tom Chen — Mar 18', time: '5h' },
  { color: 'bg-[#DC2626]', text: 'Cancelled: Lisa Wang — Mar 22', time: '6h' },
  { color: 'bg-blue', text: 'New booking: Amy Park — Mar 28', time: '8h' },
  { color: 'bg-green', text: 'Deposit confirmed: Ray Gupta — Mar 25', time: '1d' },
]

const alertRows = [
  { customer: 'Mike Johnson', date: 'Mar 25', yurt: 'Silver Creek', expires: '10 hrs', expBg: 'bg-[#FEE2E2]', expColor: 'text-[#991B1B]' },
  { customer: 'Nina Patel', date: 'Mar 27', yurt: 'Willow Bend', expires: '3 days', expBg: 'bg-[#FFF3E0]', expColor: 'text-[#E65100]' },
]

export default function Dashboard() {
  const t = useTranslations('admin.dashboard')

  const statCards = [
    { icon: CalendarIcon, iconBg: 'bg-blue', value: '3', label: t('stats.todayReservations') },
    { icon: Clock4, iconBg: 'bg-amber', value: '2', label: t('stats.pendingDeposits'), highlight: true },
    { icon: Utensils, iconBg: 'bg-[#C4724B]', value: '1', label: t('stats.pendingOrders') },
    { icon: DollarSign, iconBg: 'bg-green', value: '$2,400', label: t('stats.monthRevenue') },
  ]

  const legend = [
    { color: 'bg-green', label: t('legend.available') },
    { color: 'bg-[#D4A017]', label: t('legend.pending') },
    { color: 'bg-blue', label: t('legend.confirmed') },
    { color: 'bg-[#4A4A4A]', label: t('legend.completed') },
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-6 bg-cream-bg overflow-auto">
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
          <button className="flex items-center gap-1.5 bg-amber text-white text-[13px] font-semibold px-4 py-2 rounded-md">
            <Plus size={14} /> {t('actions.createReservation')}
          </button>
          <button className="flex items-center gap-1.5 bg-white text-brown text-[13px] font-semibold px-4 py-2 rounded-md border border-beige">
            <CalendarIcon size={14} /> {t('actions.openCalendar')}
          </button>
          <button className="flex items-center gap-1.5 bg-white text-brown text-[13px] font-semibold px-4 py-2 rounded-md border border-beige">
            <Settings size={14} /> {t('actions.manageAvailability')}
          </button>
        </div>

        {/* Two Column: Week Overview + Activity Feed */}
        <div className="flex gap-5">
          {/* Week Overview */}
          <div className="flex-1 bg-white rounded-xl p-5 border border-beige shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-brown">{t('weekOverview.title')}</span>
              <span className="text-[13px] font-semibold text-amber cursor-pointer">{t('weekOverview.viewCalendar')}</span>
            </div>
            {/* Grid */}
            <div className="flex gap-1">
              {/* Labels column */}
              <div className="flex flex-col gap-1 w-[70px]">
                <div className="h-8" />
                {yurtLabels.map((name) => (
                  <div key={name} className="h-8 flex items-center px-2">
                    <span className="text-xs font-semibold text-brown">{name}</span>
                  </div>
                ))}
              </div>
              {/* Day columns */}
              {weekDays.map((day, di) => (
                <div key={day} className="flex-1 flex flex-col gap-1 items-center">
                  <div className="h-8 flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold text-gray-text">{day}</span>
                    <span className="text-[10px] text-muted-beige">{weekDates[di]}</span>
                  </div>
                  {yurtColors.map((row, ri) => (
                    <div key={ri} className={`h-8 w-8 rounded ${row[di]}`} />
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
            {alertRows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center bg-white px-4 py-2.5 ${
                  i < alertRows.length - 1 ? 'border-b border-[#FECACA]' : ''
                }`}
              >
                <span className="flex-1 text-[13px] font-medium text-brown">{row.customer}</span>
                <span className="w-[100px] text-[13px] text-brown">{row.date}</span>
                <span className="w-[120px] text-[13px] text-brown">{row.yurt}</span>
                <div className="w-[100px]">
                  <span className={`${row.expBg} ${row.expColor} text-[11px] font-semibold px-2 py-0.5 rounded-full`}>
                    {row.expires}
                  </span>
                </div>
                <div className="w-[80px]">
                  <button className="bg-[#DC2626] text-white text-[11px] font-semibold px-3 py-1 rounded-md">
                    {t('expiringSoon.remind')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
