"use client"

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { useBooking } from '@/contexts/BookingContext'

type DateStatus = 'available' | 'limited' | 'full' | 'closed'

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

/** Format date as YYYY-MM-DD in local time */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Get days in month (1-indexed month param) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Get day-of-week for first of month (0=Sun) */
function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function BookingDatePage() {
  const t = useTranslations('booking.date')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { selectedDate, setSelectedDate } = useBooking()

  const [today] = useState(() => new Date())
  const todayStr = toLocalDateStr(today)

  // Current displayed month (1-indexed)
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) return parseInt(selectedDate.slice(0, 4), 10)
    return today.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return parseInt(selectedDate.slice(5, 7), 10)
    return today.getMonth() + 1
  })

  const startDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
  const endDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${daysInMonth(viewYear, viewMonth)}`

  // Fetch availability for the month
  const { data: availability, isLoading: loadingAvail } = useSWR(
    `/api/availability?startDate=${startDate}&endDate=${endDate}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Fetch yurts to know total count
  const { data: yurts } = useSWR('/api/yurts', fetcher, {
    revalidateOnFocus: false,
  })

  // Fetch reservations for this month (current user's own come back;
  // we only need to count booked yurts per date).
  // Note: The reservations API returns the user's own reservations for non-admin.
  // For date availability we rely on availability + yurts data.
  // The availability API returns yurt-level open/close status.
  // A yurt is "booked" if there's a reservation with that yurtId+date.
  // Since we can't query all reservations as customer, we infer from availability:
  // - If a yurtAvailability record says isOpen=false, the yurt is closed
  // - If no availability record, the yurt is open by default
  // - Reservation conflicts are checked server-side at booking time
  // For a richer UX, we compute status from availability records only.

  const totalYurts = Array.isArray(yurts) ? yurts.filter((y: { status: string }) => y.status === 'ACTIVE').length : 3

  // Build date→status map
  const dateStatusMap = useMemo<Record<string, DateStatus>>(() => {
    if (!Array.isArray(availability)) return {}
    const map: Record<string, DateStatus> = {}

    // Group availability by date
    const byDate: Record<string, { open: number; closed: number }> = {}
    for (const rec of availability) {
      const dateKey = rec.date.slice(0, 10) // "2026-03-15"
      if (!byDate[dateKey]) byDate[dateKey] = { open: 0, closed: 0 }
      if (rec.isOpen) {
        byDate[dateKey].open++
      } else {
        byDate[dateKey].closed++
      }
    }

    // For each day in the month, compute status
    const total = daysInMonth(viewYear, viewMonth)
    for (let d = 1; d <= total; d++) {
      const dateKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const info = byDate[dateKey]

      if (!info) {
        // No availability records => all yurts open by default
        map[dateKey] = 'available'
      } else if (info.closed >= totalYurts) {
        // All yurts explicitly closed
        map[dateKey] = 'closed'
      } else if (info.open === 1 && info.closed === totalYurts - 1) {
        // Only 1 yurt left open
        map[dateKey] = 'limited'
      } else if (info.closed > 0 && info.open > 1) {
        // Some closed but more than 1 open
        map[dateKey] = 'available'
      } else if (info.open === 0 && info.closed < totalYurts) {
        // Some closed, rest have no records (default open)
        const defaultOpen = totalYurts - info.closed
        if (defaultOpen === 1) map[dateKey] = 'limited'
        else map[dateKey] = 'available'
      } else {
        map[dateKey] = 'available'
      }
    }

    return map
  }, [availability, viewYear, viewMonth, totalYurts])

  const numDays = daysInMonth(viewYear, viewMonth)
  const startDay = firstDayOfMonth(viewYear, viewMonth)

  const cells: (number | null)[] = useMemo(() => {
    const arr: (number | null)[] = []
    for (let i = 0; i < startDay; i++) arr.push(null)
    for (let d = 1; d <= numDays; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [startDay, numDays])

  const navigateMonth = useCallback((delta: number) => {
    setViewMonth((m) => {
      let newMonth = m + delta
      if (newMonth < 1) { newMonth = 12; setViewYear(y => y - 1) }
      if (newMonth > 12) { newMonth = 1; setViewYear(y => y + 1) }
      return newMonth
    })
  }, [])

  const canGoBack = useMemo(() => {
    // Don't go before current month
    return viewYear > today.getFullYear() ||
      (viewYear === today.getFullYear() && viewMonth > today.getMonth() + 1)
  }, [viewYear, viewMonth, today])

  const dayHeaders = [
    t('days.sun'), t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat'),
  ]

  const legend = [
    { color: 'bg-green', label: t('legend.available') },
    { color: 'bg-[#F4A623]', label: t('legend.selective') },
    { color: 'bg-[#DC3545]', label: t('legend.limited') },
    { color: 'bg-gray-300', label: t('legend.full') },
  ]

  function getDateKey(day: number): string {
    return `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function isPast(day: number): boolean {
    const dateKey = getDateKey(day)
    return dateKey < todayStr
  }

  function isToday(day: number): boolean {
    return getDateKey(day) === todayStr
  }

  function getStatus(day: number): DateStatus | 'past' {
    if (isPast(day)) return 'past'
    const dateKey = getDateKey(day)
    return dateStatusMap[dateKey] || 'available'
  }

  function isSelected(day: number): boolean {
    return selectedDate === getDateKey(day)
  }

  function handleDayClick(day: number) {
    const status = getStatus(day)
    if (status === 'past' || status === 'closed' || status === 'full') return
    const dateKey = getDateKey(day)
    setSelectedDate(isSelected(day) ? null : dateKey)
  }

  function getDateStyle(day: number): string {
    const status = getStatus(day)
    const sel = isSelected(day)
    const base = 'flex items-center justify-center cursor-pointer border-none transition-all relative'

    if (sel) {
      return `${base} bg-amber text-white w-12 h-12 rounded-full text-lg font-bold ring-[3px] ring-amber/30`
    }

    switch (status) {
      case 'past':
        return `${base} text-beige w-10 h-10 rounded-full cursor-not-allowed`
      case 'closed':
        return `${base} bg-gray-200 text-gray-400 w-10 h-10 rounded-full cursor-not-allowed`
      case 'full':
        return `${base} bg-[#DC3545]/80 text-white w-10 h-10 rounded-full cursor-not-allowed`
      case 'limited':
        return `${base} bg-[#F4A623] text-white w-10 h-10 rounded-full hover:ring-2 hover:ring-amber/30`
      case 'available':
        return `${base} bg-green text-white w-10 h-10 rounded-full hover:ring-2 hover:ring-green/30`
      default:
        return `${base} text-brown w-10 h-10 hover:bg-amber/10 hover:rounded-full`
    }
  }

  const monthLabel = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`

  return (
    <>
      {/* Calendar Section */}
      <div className="flex-1 flex justify-center py-6 px-4 sm:px-10 lg:px-20 overflow-y-auto">
        <div className="w-[700px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-4">
          {/* Month Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => canGoBack && navigateMonth(-1)}
              className={`border-none bg-transparent p-1 ${canGoBack ? 'cursor-pointer text-brown' : 'cursor-not-allowed text-beige'}`}
              disabled={!canGoBack}
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="font-playfair text-2xl font-bold text-brown italic">{monthLabel}</h2>
            <button
              onClick={() => navigateMonth(1)}
              className="border-none bg-transparent p-1 cursor-pointer text-brown"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 text-center">
            {dayHeaders.map((d) => (
              <div key={d} className="py-2 text-xs font-semibold text-[#8E8E93]">{d}</div>
            ))}
          </div>

          {/* Date Grid */}
          {loadingAvail ? (
            <div className="grid grid-cols-7 gap-y-3">
              {Array.from({ length: 35 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-beige/30 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-y-3">
              {cells.map((day, idx) => (
                <div key={idx} className="flex items-center justify-center">
                  {day !== null ? (
                    <button
                      onClick={() => handleDayClick(day)}
                      disabled={getStatus(day) === 'past' || getStatus(day) === 'closed' || getStatus(day) === 'full'}
                      className={getDateStyle(day)}
                    >
                      {day}
                      {isToday(day) && !isSelected(day) && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber" />
                      )}
                    </button>
                  ) : (
                    <div className="w-10 h-10" />
                  )}
                </div>
              ))}
            </div>
          )}

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
      <div className="h-16 shrink-0 bg-white border-t border-beige flex items-center justify-end px-4 sm:px-10 lg:px-20">
        <div className="flex items-center gap-3">
          {!selectedDate && (
            <span className="text-sm text-[#8E8E93]">Select a date to continue</span>
          )}
          <button
            onClick={() => selectedDate && router.push('/booking/yurt')}
            disabled={!selectedDate}
            aria-label={!selectedDate ? 'Select a date to continue' : 'Continue to yurt selection'}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-semibold border-none transition-colors ${
              selectedDate
                ? 'bg-gradient-to-r from-amber to-[#A67C2E] text-white cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)]'
                : 'bg-[#BFBFBF] text-white/70 cursor-not-allowed'
            }`}
          >
            {tCommon('next')} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </>
  )
}
