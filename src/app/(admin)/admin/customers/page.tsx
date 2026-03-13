"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { Search, X, Save } from 'lucide-react'

interface Customer {
  name: string
  initials: string
  initialsColor: string
  email: string
  phone: string
  visits: number
  lastVisit: string
  tag?: string
  tagColor?: string
}

const customers: Customer[] = [
  { name: 'Sarah Lee', initials: 'SL', initialsColor: 'bg-[#C4724B]', email: 'sarah.lee@email.com', phone: '+1 555 1001', visits: 12, lastVisit: 'Mar 16', tag: 'Regular', tagColor: 'bg-light-blue-bg text-blue' },
  { name: 'Matsui Kiku', initials: 'MK', initialsColor: 'bg-amber', email: 'matsui.kikujumo@email.com', phone: '+1 555 1002', visits: 3, lastVisit: '—', tag: 'Regular', tagColor: 'bg-light-blue-bg text-blue' },
  { name: 'Emma Nakamura', initials: 'EN', initialsColor: 'bg-green', email: 'emma@emma.com', phone: '+1 555 1003', visits: 24, lastVisit: 'Mar 22', tag: 'VIP', tagColor: 'bg-[#FEF3CD] text-amber' },
  { name: 'Jason Park', initials: 'JP', initialsColor: 'bg-blue', email: 'jason@park.com', phone: '+1 555 0091', visits: 1, lastVisit: 'Feb 12' },
  { name: 'Diana Wiris', initials: 'DW', initialsColor: 'bg-red', email: 'diana.w@gmail.com', phone: '+1 555 1637', visits: 5, lastVisit: 'Jan 01', tag: 'Blocked', tagColor: 'bg-light-red-bg text-red' },
]

const selectedCustomer = customers[2]

const reservationHistory = [
  { date: 'Feb 22, 2026', status: 'Confirmed', statusColor: 'text-green' },
  { date: 'Nov 01, 2024', status: 'Completed', statusColor: 'text-gray-completed' },
  { date: 'Jun 14, 2024', status: 'Cancelled', statusColor: 'text-red' },
]

export default function Customers() {
  const t = useTranslations('admin.customers')
  const [detailOpen, setDetailOpen] = useState(true)

  const filterLabels = [
    t('filters.all'),
    t('filters.vip'),
    t('filters.regular'),
    t('filters.blocked'),
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex bg-cream-bg overflow-hidden">
        {/* Left - Table */}
        <div className="flex-1 p-6 overflow-auto flex flex-col gap-5">
          {/* Search & Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-beige rounded-md px-3 py-2 gap-2 flex-1 max-w-md">
              <Search size={16} className="text-gray-text" />
              <input type="text" placeholder={t('searchPlaceholder')} className="text-sm bg-transparent outline-none flex-1" />
            </div>
            <div className="flex gap-1">
              {filterLabels.map((f, i) => (
                <button
                  key={f}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                    i === 0 ? 'bg-amber text-white border-amber' : 'bg-white text-brown border-beige'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-beige overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-beige">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.email')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.phone')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.visits')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.lastVisit')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.tag')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.email}
                    className={`border-b border-beige last:border-b-0 hover:bg-cream-bg/50 cursor-pointer ${
                      c.name === selectedCustomer.name ? 'bg-amber-light-bg' : ''
                    }`}
                    onClick={() => setDetailOpen(true)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${c.initialsColor} rounded-full flex items-center justify-center text-white text-xs font-semibold`}>
                          {c.initials}
                        </div>
                        <span className="text-sm font-medium text-brown">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-text">{c.email}</td>
                    <td className="px-4 py-3 text-sm text-brown">{c.phone}</td>
                    <td className="px-4 py-3 text-sm text-brown">{c.visits}</td>
                    <td className="px-4 py-3 text-sm text-brown">{c.lastVisit}</td>
                    <td className="px-4 py-3">
                      {c.tag && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.tagColor}`}>
                          {c.tag}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs font-semibold text-amber">{t('actions.view')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right - Customer Detail */}
        {detailOpen && (
          <div className="w-[380px] bg-white border-l border-beige p-5 flex flex-col gap-4 overflow-auto shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-brown">{t('detail.title')}</span>
              <button onClick={() => setDetailOpen(false)}>
                <X size={16} className="text-gray-text" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-green rounded-full flex items-center justify-center text-white text-xl font-bold">
                EN
              </div>
              <span className="text-base font-bold text-brown">{selectedCustomer.name}</span>
              <span className="text-xs text-gray-text">{selectedCustomer.email}</span>
              <span className="text-xs text-gray-text">{selectedCustomer.phone}</span>
              <span className="text-xs text-gray-text">{t('detail.memberSince')} Feb 2024</span>
            </div>

            <div className="flex gap-1 justify-center">
              {['VIP', 'Regular'].map((tag, i) => (
                <button
                  key={tag}
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    i === 0 ? 'bg-[#FEF3CD] text-amber' : 'bg-gray-100 text-gray-text'
                  }`}
                >
                  {tag}
                </button>
              ))}
              <button className="px-3 py-1 text-xs text-gray-text">{t('actions.addTag')}</button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { value: '24', label: t('detail.stats.totalVisits') },
                { value: '$4,280', label: t('detail.stats.totalSpent') },
                { value: '4%', label: t('detail.stats.cancelRate') },
                { value: '2', label: t('detail.stats.noShows') },
              ].map((s) => (
                <div key={s.label} className="bg-cream-bg rounded-lg p-2">
                  <div className="text-base font-bold text-brown">{s.value}</div>
                  <div className="text-[10px] text-gray-text">{s.label}</div>
                </div>
              ))}
            </div>

            <div>
              <span className="text-xs font-bold text-brown">{t('detail.reservationHistory')}</span>
              <div className="mt-2 flex flex-col gap-2">
                {reservationHistory.map((r) => (
                  <div key={r.date} className="flex items-center justify-between text-xs">
                    <span className="text-brown">{r.date}</span>
                    <span className={`font-semibold ${r.statusColor}`}>{r.status}</span>
                  </div>
                ))}
                <button className="text-xs text-amber font-semibold mt-1">Show 23 More →</button>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-brown">{t('detail.adminNotes')}</span>
              <textarea
                className="w-full border border-beige rounded-md p-2 text-xs h-20 resize-none mt-2"
                defaultValue="VIP customer: prefers 'Large' first floor. Usually visits for holidays. Allergic to nuts. Has a dog (allowed on leash)."
              />
              <button className="flex items-center gap-1.5 bg-green text-white text-xs font-semibold px-3 py-1.5 rounded-md mt-2">
                <Save size={12} /> {t('detail.saveNote')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
