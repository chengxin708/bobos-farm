"use client"

import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { Search, Filter, Plus } from 'lucide-react'

const reservations = [
  { id: 'R-1001', guest: 'John Smith', email: 'john@example.com', yurt: 'Golden Meadow', dates: 'Mar 15 - Mar 18', guests: 4, status: 'Confirmed', deposit: '$250' },
  { id: 'R-1002', guest: 'Sarah Lee', email: 'sarah@example.com', yurt: 'Silver Creek', dates: 'Mar 20 - Mar 22', guests: 2, status: 'Pending', deposit: '$150' },
  { id: 'R-1003', guest: 'Tom Chen', email: 'tom@example.com', yurt: 'Jade Valley', dates: 'Mar 18 - Mar 19', guests: 6, status: 'Checked In', deposit: '$300' },
  { id: 'R-1004', guest: 'Lisa Wang', email: 'lisa@example.com', yurt: 'Golden Meadow', dates: 'Mar 22 - Mar 25', guests: 3, status: 'Cancelled', deposit: '$200' },
  { id: 'R-1005', guest: 'Amy Park', email: 'amy@example.com', yurt: 'Silver Creek', dates: 'Mar 28 - Mar 30', guests: 5, status: 'Confirmed', deposit: '$250' },
]

const statusStyles: Record<string, string> = {
  Confirmed: 'bg-light-green-bg text-green',
  Pending: 'bg-light-yellow-bg text-[#D4A017]',
  'Checked In': 'bg-light-blue-bg text-blue',
  Cancelled: 'bg-light-red-bg text-red',
  Completed: 'bg-gray-100 text-gray-completed',
}

export default function Reservations() {
  const t = useTranslations('admin.reservations')

  const tabs = [
    t('tabs.all'),
    t('tabs.upcoming'),
    t('tabs.checkedIn'),
    t('tabs.completed'),
    t('tabs.cancelled'),
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-beige rounded-md px-3 py-2 gap-2 w-64">
              <Search size={16} className="text-gray-text" />
              <input type="text" placeholder={t('searchPlaceholder')} className="text-sm bg-transparent outline-none flex-1" />
            </div>
            <button className="flex items-center gap-1.5 bg-white border border-beige rounded-md px-3 py-2 text-sm text-brown">
              <Filter size={14} /> {t('filters')}
            </button>
          </div>
          <button className="flex items-center gap-1.5 bg-amber text-white text-sm font-semibold px-4 py-2 rounded-md">
            <Plus size={14} /> {t('newReservation')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-beige">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                i === 0 ? 'border-amber text-amber' : 'border-transparent text-gray-text hover:text-brown'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-beige overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-beige">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.id')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.guest')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.yurt')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.dates')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.guests')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.status')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.deposit')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-b border-beige last:border-b-0 hover:bg-cream-bg/50">
                  <td className="px-4 py-3 text-sm text-gray-text">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-brown">{r.guest}</div>
                    <div className="text-xs text-gray-text">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-brown">{r.yurt}</td>
                  <td className="px-4 py-3 text-sm text-brown">{r.dates}</td>
                  <td className="px-4 py-3 text-sm text-brown">{r.guests}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-brown">{r.deposit}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs font-semibold text-amber hover:underline">{t('actions.view')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
