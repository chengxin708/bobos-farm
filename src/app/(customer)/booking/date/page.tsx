"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

type DateStatus = 'available' | 'limited' | 'full' | 'closed' | 'selected'

const calendarData: Record<number, DateStatus> = {
  4: 'limited', 5: 'limited', 8: 'limited', 14: 'selected',
  17: 'limited', 18: 'limited', 21: 'limited', 25: 'available',
  26: 'limited', 28: 'limited',
}

export default function BookingDatePage() {
  const t = useTranslations('booking.date')
  const tCommon = useTranslations('common')

  const [selectedDate, setSelectedDate] = useState(14)
  const startDay = 6 // March 2026 starts on Sunday
  const daysInMonth = 31

  const dayHeaders = [
    t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat'),
  ]

  const legend = [
    { color: 'bg-green', label: t('legend.available') },
    { color: 'bg-[#D4A017]', label: t('legend.selective') },
    { color: 'bg-[#DC3545]', label: t('legend.limited') },
    { color: 'bg-gray-300', label: t('legend.full') },
  ]

  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const getDateStyle = (day: number) => {
    if (day === selectedDate) return 'bg-amber text-white w-12 h-12 rounded-full text-lg font-bold'
    const status = calendarData[day]
    if (status === 'limited') return 'bg-beige/60 text-brown/60 w-10 h-10 rounded-full'
    if (status === 'full') return 'bg-gray-200 text-gray-400 w-10 h-10 rounded-full'
    if (day === 21 || day === 28) return 'bg-amber/20 text-amber w-10 h-10 rounded-full border-2 border-amber/40'
    return 'text-brown w-10 h-10'
  }

  return (
    <>
      {/* Calendar Section */}
      <div className="flex-1 flex justify-center py-10 px-20">
        <div className="w-[700px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-4">
          {/* Month Header */}
          <div className="flex items-center justify-between">
            <ChevronLeft size={20} className="text-brown cursor-pointer" />
            <h2 className="font-playfair text-2xl font-bold text-brown italic">{t('monthYear')}</h2>
            <ChevronRight size={20} className="text-brown cursor-pointer" />
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 text-center">
            {dayHeaders.map((d) => (
              <div key={d} className="py-2 text-xs font-semibold text-[#8E8E93]">{d}</div>
            ))}
          </div>

          {/* Date Grid */}
          <div className="grid grid-cols-7 gap-y-3">
            {cells.map((day, idx) => (
              <div key={idx} className="flex items-center justify-center">
                {day !== null ? (
                  <button
                    onClick={() => setSelectedDate(day)}
                    className={`flex items-center justify-center cursor-pointer border-none bg-transparent ${getDateStyle(day)}`}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="w-10 h-10" />
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-4">
            {legend.map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                <span className="text-xs text-[#8E8E93]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-20 bg-white border-t border-beige flex items-center justify-end px-20">
        <Link
          href="/booking/yurt"
          className="no-underline flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber to-[#A67C2E] text-white text-base font-semibold shadow-[0_4px_16px_rgba(139,105,20,0.2)]"
        >
          {tCommon('next')} <ArrowRight size={18} />
        </Link>
      </div>
    </>
  )
}
