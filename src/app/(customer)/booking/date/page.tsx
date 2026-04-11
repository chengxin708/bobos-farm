"use client"

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
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
  const locale = useLocale()
  const router = useRouter()
  const { selectedDate, setSelectedDate, hydrated } = useBooking()

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

  // Month transition animation state
  const [monthFading, setMonthFading] = useState(false)

  const startDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
  const endDate = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${daysInMonth(viewYear, viewMonth)}`

  // Fetch settings for advance booking limits
  const { data: settings } = useSWR<Record<string, string>>('/api/settings/public', fetcher, {
    revalidateOnFocus: false,
  })
  const minAdvanceDays = settings?.min_advance_booking_days ? Number(settings.min_advance_booking_days) : 1
  const maxAdvanceDays = settings?.max_advance_booking_days ? Number(settings.max_advance_booking_days) : 90

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

  const totalYurts = Array.isArray(yurts) ? yurts.filter((y: { status: string }) => y.status === 'ACTIVE').length : 3

  // Build date->status map
  const dateStatusMap = useMemo<Record<string, DateStatus>>(() => {
    if (!Array.isArray(availability)) return {}
    const map: Record<string, DateStatus> = {}

    // Group availability by date
    const byDate: Record<string, { open: number; closed: number }> = {}
    for (const rec of availability) {
      const dateKey = rec.date.slice(0, 10)
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
        map[dateKey] = 'available'
      } else if (info.closed >= totalYurts) {
        map[dateKey] = 'closed'
      } else if (info.open === 1 && info.closed === totalYurts - 1) {
        map[dateKey] = 'limited'
      } else if (info.closed > 0 && info.open > 1) {
        map[dateKey] = 'available'
      } else if (info.open === 0 && info.closed < totalYurts) {
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

  // Build calendar cells, starting from Monday (shift Sunday to end)
  const cells: (number | null)[] = useMemo(() => {
    const arr: (number | null)[] = []
    // Convert startDay from Sun=0 to Mon=0 layout: Mon=0, Tue=1, ..., Sun=6
    const mondayStart = startDay === 0 ? 6 : startDay - 1
    for (let i = 0; i < mondayStart; i++) arr.push(null)
    for (let d = 1; d <= numDays; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [startDay, numDays])

  const navigateMonth = useCallback((delta: number) => {
    setMonthFading(true)
    setTimeout(() => {
      setViewMonth((m) => {
        let newMonth = m + delta
        if (newMonth < 1) { newMonth = 12; setViewYear(y => y - 1) }
        if (newMonth > 12) { newMonth = 1; setViewYear(y => y + 1) }
        return newMonth
      })
      setMonthFading(false)
    }, 150)
  }, [])

  const canGoBack = useMemo(() => {
    return viewYear > today.getFullYear() ||
      (viewYear === today.getFullYear() && viewMonth > today.getMonth() + 1)
  }, [viewYear, viewMonth, today])

  // Mo Tu We Th Fr Sa Su headers
  const dayHeaders = [
    t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat'), t('days.sun'),
  ]

  function getDateKey(day: number): string {
    return `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Compute earliest and latest bookable dates from settings
  const earliestBookableStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + minAdvanceDays)
    return toLocalDateStr(d)
  }, [today, minAdvanceDays])

  const latestBookableStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + maxAdvanceDays)
    return toLocalDateStr(d)
  }, [today, maxAdvanceDays])

  function isPast(day: number): boolean {
    const dateKey = getDateKey(day)
    return dateKey < todayStr
  }

  function isToday(day: number): boolean {
    return getDateKey(day) === todayStr
  }

  function isOutsideBookingWindow(day: number): boolean {
    const dateKey = getDateKey(day)
    return dateKey < earliestBookableStr || dateKey > latestBookableStr
  }

  function getStatus(day: number): DateStatus | 'past' {
    if (isPast(day)) return 'past'
    if (isOutsideBookingWindow(day)) return 'closed'
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

  function isDisabled(day: number): boolean {
    const status = getStatus(day)
    return status === 'past' || status === 'closed' || status === 'full'
  }

  const monthLabel = `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`

  // Don't render until hydrated to prevent flash
  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6B7F5E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top Bar */}
      <div className="shrink-0 bg-[#F8F7F4] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon('back')}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <span className="text-sm text-[#8C8478]">Step 1 of 4</span>
      </div>

      {/* Page Title */}
      <div className="shrink-0 text-center mt-4 mb-6 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">Select a Date</h1>
        {locale === 'zh' && (
          <p className="text-sm text-[#8C8478] mt-1 font-sans">Choose your preferred date</p>
        )}
      </div>

      {/* Calendar Card — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
        <div className="max-w-lg mx-auto bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => canGoBack && navigateMonth(-1)}
              className={`flex items-center justify-center w-9 h-9 rounded-full border-none transition-colors ${
                canGoBack
                  ? 'bg-transparent hover:bg-[#E8ECE4] cursor-pointer text-[#1A1208]'
                  : 'bg-transparent cursor-not-allowed text-[#8C8478]/30'
              }`}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-serif text-lg text-[#1A1208]">{monthLabel}</h2>
            <button
              onClick={() => navigateMonth(1)}
              className="flex items-center justify-center w-9 h-9 rounded-full border-none bg-transparent hover:bg-[#E8ECE4] cursor-pointer text-[#1A1208] transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day Headers — Mo Tu We Th Fr Sa Su */}
          <div className="grid grid-cols-7 mb-1">
            {dayHeaders.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-[#8C8478]">
                {d.slice(0, 2)}
              </div>
            ))}
          </div>

          {/* Date Grid */}
          <div
            className={`transition-opacity duration-150 ${monthFading ? 'opacity-0' : 'opacity-100'}`}
          >
            {loadingAvail ? (
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: 35 }).map((_, idx) => (
                  <div key={idx} className="flex items-center justify-center py-0.5">
                    <div className="w-11 h-11 rounded-full bg-[#E8ECE4]/40 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-center py-0.5">
                    {day !== null ? (
                      <button
                        onClick={() => handleDayClick(day)}
                        disabled={isDisabled(day)}
                        className={`
                          relative flex flex-col items-center justify-center w-11 h-11 rounded-full
                          border-none transition-all text-sm font-medium
                          ${isSelected(day)
                            ? 'bg-[#6B7F5E] text-white scale-105'
                            : isDisabled(day)
                              ? 'text-[#8C8478]/40 cursor-not-allowed bg-transparent'
                              : 'text-[#1A1208] cursor-pointer bg-transparent hover:bg-[#E8ECE4]'
                          }
                          ${isToday(day) && !isSelected(day) ? 'ring-1 ring-[#6B7F5E]/30' : ''}
                        `}
                        aria-label={`${MONTH_NAMES[viewMonth - 1]} ${day}`}
                      >
                        {day}
                        {/* Limited availability dot */}
                        {getStatus(day) === 'limited' && !isSelected(day) && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#C47D52]" />
                        )}
                      </button>
                    ) : (
                      <div className="w-11 h-11" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 pt-4 mt-2 border-t border-[#F2EDE6]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#6B7F5E]" />
              <span className="text-xs text-[#8C8478]">{t('legend.available')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#C47D52]" />
              <span className="text-xs text-[#8C8478]">{t('legend.limited')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#8C8478]/40" />
              <span className="text-xs text-[#8C8478]">{t('legend.full')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="shrink-0 p-4 pb-6 bg-[#F8F7F4]">
        <button
          onClick={() => selectedDate && router.push('/booking/yurt')}
          disabled={!selectedDate}
          aria-label={!selectedDate ? 'Select a date to continue' : 'Continue to yurt selection'}
          className={`w-full py-3.5 rounded-full text-base font-medium border-none transition-all flex items-center justify-center gap-2 ${
            selectedDate
              ? 'bg-[#6B7F5E] text-white cursor-pointer shadow-[0_2px_8px_rgba(107,127,94,0.25)]'
              : 'bg-[#6B7F5E] text-white opacity-40 cursor-not-allowed'
          }`}
        >
          {tCommon('next')}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
