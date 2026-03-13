"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ViewMode = 'month' | 'week'

const yurtNames = ['Golden Meadow', 'Silver Creek', 'Jade Valley']
const statusColors: Record<string, string> = {
  available: 'text-green',
  pending: 'text-[#D4A017]',
  confirmed: 'text-blue',
  cancelled: 'text-red',
  completed: 'text-gray-completed',
}
const statusBg: Record<string, string> = {
  available: 'bg-green/10',
  pending: 'bg-[#D4A017]/10',
  confirmed: 'bg-blue/10',
  cancelled: 'bg-red/10',
  completed: 'bg-gray-completed/10',
}

interface Booking {
  guest: string
  yurt: string
  guests: number
  status: string
}

// Sample month data
const monthBookings: Record<number, Booking[]> = {
  1: [
    { guest: 'Tom C.', yurt: 'Golden Meadow', guests: 4, status: 'confirmed' },
    { guest: 'Iris P.', yurt: 'Jade Valley', guests: 2, status: 'pending' },
  ],
  3: [
    { guest: 'Amy R.', yurt: 'Silver Creek', guests: 3, status: 'available' },
  ],
  5: [
    { guest: 'Golden Meadow', yurt: 'Golden Meadow', guests: 0, status: 'available' },
    { guest: 'Silver Creek', yurt: 'Silver Creek', guests: 0, status: 'available' },
  ],
  8: [
    { guest: 'Sarah L.', yurt: 'Golden Meadow', guests: 6, status: 'confirmed' },
  ],
  10: [
    { guest: 'Ray G.', yurt: 'Silver Creek', guests: 2, status: 'pending' },
  ],
  12: [
    { guest: 'Mike J.', yurt: 'Golden Meadow', guests: 4, status: 'confirmed' },
  ],
  15: [
    { guest: 'John Smith', yurt: 'Golden Meadow', guests: 5, status: 'confirmed' },
    { guest: 'Jade Valley', yurt: 'Jade Valley', guests: 0, status: 'available' },
  ],
  16: [{ guest: '', yurt: '', guests: 0, status: 'cancelled' }],
  17: [{ guest: '', yurt: '', guests: 0, status: 'cancelled' }],
  20: [
    { guest: 'Nina P.', yurt: 'Silver Creek', guests: 3, status: 'pending' },
  ],
  22: [
    { guest: 'Golden Meadow', yurt: 'Golden Meadow', guests: 0, status: 'available' },
  ],
  25: [
    { guest: 'Party!', yurt: 'Golden Meadow', guests: 12, status: 'confirmed' },
    { guest: 'Lisa W.', yurt: 'Silver Creek', guests: 2, status: 'cancelled' },
  ],
  27: [
    { guest: 'Cabin Retreat', yurt: 'Jade Valley', guests: 4, status: 'confirmed' },
  ],
  29: [
    { guest: 'Group Event', yurt: 'Golden Meadow', guests: 8, status: 'available' },
  ],
  30: [
    { guest: 'Earlybird booking', yurt: 'Silver Creek', guests: 2, status: 'pending' },
  ],
  31: [
    { guest: 'Walk-in', yurt: 'Golden Meadow', guests: 3, status: 'available' },
  ],
}

// Week view data
const weekData = [
  { day: 'Mon', date: '23', bookings: [{ guest: 'Golden Meadow', capacity: '6 guests', status: 'available', yurt: 'Golden Meadow' }] },
  { day: 'Tue', date: '24', bookings: [{ guest: 'Tom C.', capacity: 'Guests: 4', status: 'pending', yurt: 'Golden Meadow' }, { guest: 'Brooke L.', capacity: 'Guests: 2', status: 'confirmed', yurt: 'Silver Creek' }] },
  { day: 'Wed', date: '25', bookings: [{ guest: 'Ava R.', capacity: 'Guests: 6', status: 'confirmed', yurt: 'Golden Meadow' }] },
  { day: 'Thu', date: '26', bookings: [] },
  { day: 'Fri', date: '27', bookings: [{ guest: 'Dan K.', capacity: 'Guests: 3', status: 'available', yurt: 'Silver Creek' }] },
  { day: 'Sat', date: '28', bookings: [{ guest: 'Ryan E.', capacity: 'Guests: 8', status: 'confirmed', yurt: 'Golden Meadow' }] },
  { day: 'Sun', date: '29', bookings: [] },
]

const dayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function Calendar() {
  const t = useTranslations('admin.calendar')
  const [view, setView] = useState<ViewMode>('month')
  const daysInMonth = 31
  const startDay = 6 // March 2026 starts on Sunday (6 in 0-indexed Mon-start)

  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const legendItems = [
    { color: 'bg-green', label: t('legend.available') },
    { color: 'bg-[#D4A017]', label: t('legend.pending') },
    { color: 'bg-blue', label: t('legend.confirmed') },
    { color: 'bg-red', label: t('legend.cancelled') },
    { color: 'bg-gray-completed', label: t('legend.done') },
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-4 bg-cream-bg overflow-auto">
        {/* View Toggle + Month Nav */}
        <div className="flex items-center justify-between">
          <div className="flex gap-0">
            <button
              onClick={() => setView('month')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-l-md border border-beige ${
                view === 'month' ? 'bg-amber text-white border-amber' : 'bg-white text-brown'
              }`}
            >
              {t('views.month')}
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-r-md border border-beige ${
                view === 'week' ? 'bg-amber text-white border-amber' : 'bg-white text-brown'
              }`}
            >
              {t('views.week')}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <ChevronLeft size={18} className="text-brown cursor-pointer" />
            <span className="text-base font-bold text-brown">March 2026</span>
            <ChevronRight size={18} className="text-brown cursor-pointer" />
          </div>
          <button className="text-sm font-semibold text-amber">{t('today')}</button>
        </div>

        {view === 'month' ? (
          <>
            {/* Month Grid */}
            <div className="bg-white rounded-xl border border-beige overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-beige">
                {dayHeaders.map((d) => (
                  <div key={d} className="text-center py-2 text-xs font-semibold text-gray-text">
                    {d}
                  </div>
                ))}
              </div>
              {/* Day Cells */}
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => (
                  <div
                    key={idx}
                    className={`min-h-[100px] p-2 border-b border-r border-cell-border ${
                      day === null ? 'bg-gray-50/50' : ''
                    }`}
                  >
                    {day !== null && (
                      <>
                        <span className="text-xs font-semibold text-brown">{day}</span>
                        <div className="mt-1 flex flex-col gap-0.5">
                          {monthBookings[day]?.map((b, bi) => (
                            <div
                              key={bi}
                              className={`text-[10px] px-1 py-0.5 rounded ${statusBg[b.status]} ${statusColors[b.status]} truncate`}
                            >
                              {b.guest || b.status}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6">
              {legendItems.map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-xs text-gray-text">{l.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Week View */
          <div className="bg-white rounded-xl border border-beige overflow-hidden">
            <div className="grid grid-cols-7">
              {weekData.map((wd) => (
                <div key={wd.day} className="border-r border-beige last:border-r-0">
                  {/* Day header */}
                  <div className="text-center py-3 border-b border-beige">
                    <div className="text-xs font-semibold text-gray-text">{wd.day}</div>
                    <div className={`text-lg font-bold ${wd.date === '25' ? 'bg-amber text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-brown'}`}>
                      {wd.date}
                    </div>
                  </div>
                  {/* Bookings */}
                  <div className="min-h-[400px] p-2 flex flex-col gap-2">
                    {wd.bookings.map((b, i) => (
                      <div key={i} className={`p-2 rounded-lg ${statusBg[b.status]} border-l-2 ${b.status === 'confirmed' ? 'border-blue' : b.status === 'pending' ? 'border-[#D4A017]' : 'border-green'}`}>
                        <div className={`text-xs font-semibold ${statusColors[b.status]}`}>{b.guest}</div>
                        <div className="text-[10px] text-gray-text">{b.capacity}</div>
                        <div className={`text-[10px] font-medium mt-1 ${statusColors[b.status]}`}>
                          {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </div>
                      </div>
                    ))}
                    {yurtNames.filter(y => !wd.bookings.some(b => b.yurt === y)).map((y) => (
                      <div key={y} className="p-2 rounded-lg bg-green/5">
                        <div className="text-[10px] text-green font-medium">{t('status.available')}</div>
                        <div className="text-[10px] text-gray-text">{y}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
