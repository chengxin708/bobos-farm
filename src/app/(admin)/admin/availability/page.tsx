"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'

type DateStatus = 'open' | 'closed' | 'limited' | 'custom'

const statusColors: Record<DateStatus, string> = {
  open: 'bg-white',
  closed: 'bg-[#FDE8E8]',
  limited: 'bg-[#FEF3CD]',
  custom: 'bg-light-blue-bg',
}

// Sample calendar data
const calendarData: Record<number, DateStatus> = {
  1: 'open', 2: 'open', 3: 'open', 4: 'closed', 5: 'closed', 6: 'open', 7: 'open',
  8: 'closed', 9: 'closed', 10: 'open', 11: 'open', 12: 'closed', 13: 'limited', 14: 'open',
  15: 'open', 16: 'open', 17: 'open', 18: 'open', 19: 'open', 20: 'limited', 21: 'open',
  22: 'open', 23: 'open', 24: 'open', 25: 'open', 26: 'open', 27: 'open', 28: 'custom',
  29: 'open', 30: 'open', 31: 'open',
}

const closedDates = [4, 5, 8, 9, 12]

const reservationsOnDay = [
  { name: 'Mike Johnson', dates: 'Mar 14 - Mar 16', guests: 4, status: 'Confirmed' },
]

const perYurtAvailability = [
  { name: 'Golden Meadow', status: 'Available', color: 'bg-green' },
  { name: 'Silver Creek', status: 'Available', color: 'bg-green' },
  { name: 'Jade Valley', status: 'Available', color: 'bg-green' },
]

const dayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export default function Availability() {
  const t = useTranslations('admin.availability')
  const [selectedDate, setSelectedDate] = useState(14)
  const startDay = 6
  const daysInMonth = 31

  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex gap-5 bg-cream-bg overflow-auto">
        {/* Left - Calendar */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Date Range Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-brown">{t('openRange')}</span>
            <input type="text" className="border border-beige rounded-md px-3 py-1.5 text-sm w-28" placeholder="Mar 1" />
            <span className="text-sm text-gray-text">–</span>
            <input type="text" className="border border-beige rounded-md px-3 py-1.5 text-sm w-28" placeholder="Mar 12" />
            <button className="bg-green text-white text-sm font-semibold px-3 py-1.5 rounded-md">{t('openAll')}</button>
            <span className="text-sm font-semibold text-brown ml-4">{t('closeRange')}</span>
            <input type="text" className="border border-beige rounded-md px-3 py-1.5 text-sm w-28" placeholder="Apr 1" />
            <span className="text-sm text-gray-text">–</span>
            <input type="text" className="border border-beige rounded-md px-3 py-1.5 text-sm w-28" placeholder="" />
            <button className="bg-red text-white text-sm font-semibold px-3 py-1.5 rounded-md">{t('closeAll')}</button>
          </div>

          {/* Month Nav */}
          <div className="flex items-center gap-3">
            <ChevronLeft size={16} className="text-brown cursor-pointer" />
            <span className="text-sm font-bold text-brown">March 2026</span>
            <ChevronRight size={16} className="text-brown cursor-pointer" />
            <div className="flex items-center gap-4 ml-4">
              <span className="flex items-center gap-1.5 text-xs text-gray-text">
                <span className="w-3 h-3 rounded-sm bg-white border border-beige" /> {t('legend.open')}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-text">
                <span className="w-3 h-3 rounded-sm bg-[#FDE8E8]" /> {t('legend.closed')}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-text">
                <span className="w-3 h-3 rounded-sm bg-[#FEF3CD]" /> {t('legend.limited')}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-text">
                <span className="w-3 h-3 rounded-sm bg-light-blue-bg" /> {t('legend.custom')}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-text">
                <span className="w-3 h-3 rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,#F5C6CB_3px,#F5C6CB_6px)]" /> {t('legend.noAvailability')}
              </span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-beige overflow-hidden">
            <div className="grid grid-cols-7">
              {dayHeaders.map((d) => (
                <div key={d} className="text-center py-2 text-xs font-semibold text-gray-text border-b border-beige">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                const status = day ? calendarData[day] || 'open' : 'open'
                const isClosed = day ? closedDates.includes(day) : false
                return (
                  <div
                    key={idx}
                    onClick={() => day && setSelectedDate(day)}
                    className={`min-h-[70px] p-2 border-b border-r border-cell-border cursor-pointer ${
                      day === null ? 'bg-gray-50/50' : statusColors[status as DateStatus]
                    } ${day === selectedDate ? 'ring-2 ring-amber ring-inset' : ''} ${
                      isClosed ? 'bg-[repeating-linear-gradient(45deg,#FDE8E8,#FDE8E8_3px,#F5C6CB_3px,#F5C6CB_6px)]' : ''
                    }`}
                  >
                    {day !== null && (
                      <span className={`text-xs font-semibold ${day === selectedDate ? 'text-amber' : 'text-brown'}`}>
                        {day}
                      </span>
                    )}
                    {day && calendarData[day] === 'limited' && (
                      <div className="text-[9px] mt-1 text-[#D4A017]">{t('legend.limited')}</div>
                    )}
                    {day && calendarData[day] === 'custom' && (
                      <div className="text-[9px] mt-1 text-blue">{t('legend.custom')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-beige">
            <span className="text-sm text-brown font-medium">5 {t('datesSelected').replace('{count} ', '')}</span>
            <button className="bg-green text-white text-sm font-semibold px-4 py-1.5 rounded-md">{t('openAll')}</button>
            <button className="bg-red text-white text-sm font-semibold px-4 py-1.5 rounded-md">{t('closeAll')}</button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[280px] flex flex-col gap-4 shrink-0">
          <div className="bg-white rounded-xl border border-beige p-4 flex flex-col gap-3">
            <div className="text-sm font-bold text-brown">
              Saturday, March {selectedDate}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-text">
              <span className="w-3 h-3 rounded-sm bg-white border border-beige" /> {t('legend.open')} • 3 {t('dayDetail.remaining')}
            </div>

            <div className="text-xs font-bold text-brown mt-2">{t('dayDetail.perYurtAvailability')}</div>
            {perYurtAvailability.map((y) => (
              <div key={y.name} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${y.color}`} />
                <span className="text-xs text-brown">{y.name}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-beige p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brown">{t('dayDetail.reservations')} (1)</span>
              <button className="text-xs text-green font-semibold">{t('dayDetail.confirm')}</button>
            </div>
            {reservationsOnDay.map((r) => (
              <div key={r.name} className="text-xs">
                <div className="font-medium text-brown">{r.name}</div>
                <div className="text-gray-text">{r.dates} • {r.guests} guests</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-beige p-4 flex flex-col gap-3">
            <span className="text-xs font-bold text-brown">{t('dayDetail.adminNote')}</span>
            <textarea
              className="border border-beige rounded-md p-2 text-xs h-20 resize-none"
              placeholder="Private note (e.g. overflow / extra shift needed)"
              defaultValue="VIP customer: 1 × meadow & 1 extra shift needed for Golden Meadow in afternoon."
            />
            <button className="bg-green text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 self-end">
              <Save size={12} /> {t('dayDetail.saveNote')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
