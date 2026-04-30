"use client"

import { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'

export type DateStatus = 'available' | 'limited' | 'full' | 'closed'

type CellStatus = DateStatus | 'past' | 'outside'

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

function DayCell({
  day, status, selected, disabled, today, onClick, ariaLabel, t,
}: {
  day: number
  status: CellStatus
  selected: boolean
  disabled: boolean
  today: boolean
  onClick: () => void
  ariaLabel: string
  t: (key: string) => string
}) {
  // Resolve the visual branch. Order matters: selected wins; then hard-disabled
  // (full-when-blocked, past, outside-window); then status-specific styles.
  // 'closed' (operating-day non-OPEN) is clickable but muted — clicking
  // surfaces the inquiry redirect.
  const fullBlocked = status === 'full' && disabled
  const statusClass = selected
    ? 'bg-[#6B7F5E] text-white scale-105 shadow-sm'
    : fullBlocked
      ? 'text-[#6B6157]/50 cursor-not-allowed bg-[#F2EDE6]/60 line-through'
      : status === 'closed'
        ? 'text-[#A8A19A] cursor-pointer bg-[#F5F3EE] hover:bg-[#EDEAE3]'
        : status === 'full'
          ? 'text-[#C47D52] cursor-pointer bg-[#C47D52]/8 hover:bg-[#C47D52]/15'
          : status === 'limited'
            ? 'text-[#C47D52] cursor-pointer bg-[#C47D52]/8 hover:bg-[#C47D52]/15'
            : disabled
              ? 'text-[#6B6157]/40 cursor-not-allowed bg-transparent'
              : 'text-[#1A1208] cursor-pointer bg-transparent hover:bg-[#E8ECE4]'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={`
        relative flex flex-col items-center justify-center w-12 h-12 rounded-full
        border-none transition-all text-[17px] font-semibold
        ${statusClass}
        ${today && !selected ? 'ring-2 ring-[#6B7F5E]/40' : ''}
      `}
    >
      {day}
      {status === 'available' && !selected && !disabled && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#6B7F5E]" />
      )}
      {status === 'limited' && !selected && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#C47D52] leading-none">{t('legend.limitedShort')}</span>
      )}
      {status === 'full' && !selected && (
        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold leading-none ${fullBlocked ? 'text-[#6B6157]/60' : 'text-[#C47D52]'}`}>
          {t('legend.fullShort')}
        </span>
      )}
    </button>
  )
}

interface Props {
  value: string | null
  onChange: (date: string | null) => void
  /** Earliest selectable date (inclusive), YYYY-MM-DD */
  minDate: string
  /** Latest selectable date (inclusive), YYYY-MM-DD */
  maxDate: string
  /** Optional: per-date availability markers. Absent dates default to 'available'. */
  dateStatus?: Record<string, DateStatus>
  /** If true, dates marked 'full' are still pickable (useful for inquiry flow). Default false. */
  allowFullDates?: boolean
  /** Show the availability legend at the bottom. Default true. */
  showLegend?: boolean
  /** Show skeleton loading state for the date grid. */
  loading?: boolean
  /** Fires when a 'closed' (non-OPEN operating mode) cell is clicked. If
   *  provided, takes over the click handling for that cell — onChange is
   *  not called. Use to redirect the customer to the inquiry flow. */
  onClosedDayClick?: (dateStr: string) => void
}

export function DatePickerCalendar({
  value,
  onChange,
  minDate,
  maxDate,
  dateStatus,
  allowFullDates = false,
  showLegend = true,
  loading = false,
  onClosedDayClick,
}: Props) {
  const t = useTranslations('booking.date')
  const locale = useLocale()

  const [today] = useState(() => new Date())
  const todayStr = useMemo(() => toLocalDateStr(today), [today])

  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.slice(0, 4), 10)
    return today.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.slice(5, 7), 10)
    return today.getMonth() + 1
  })

  // If the selected value jumps to a different month (e.g., prefilled from URL), follow it
  useEffect(() => {
    if (!value) return
    const y = parseInt(value.slice(0, 4), 10)
    const m = parseInt(value.slice(5, 7), 10)
    if (y !== viewYear || m !== viewMonth) {
      setViewYear(y)
      setViewMonth(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const [monthFading, setMonthFading] = useState(false)

  const numDays = daysInMonth(viewYear, viewMonth)
  const startDay = firstDayOfMonth(viewYear, viewMonth)

  const cells: (number | null)[] = useMemo(() => {
    const arr: (number | null)[] = []
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

  const dayHeaders = [
    t('days.mon'), t('days.tue'), t('days.wed'),
    t('days.thu'), t('days.fri'), t('days.sat'), t('days.sun'),
  ]

  function getDateKey(day: number): string {
    return `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function isPast(day: number): boolean {
    return getDateKey(day) < todayStr
  }

  function isToday(day: number): boolean {
    return getDateKey(day) === todayStr
  }

  function isOutsideWindow(day: number): boolean {
    const k = getDateKey(day)
    return k < minDate || k > maxDate
  }

  function getStatus(day: number): CellStatus {
    if (isPast(day)) return 'past'
    if (isOutsideWindow(day)) return 'outside'
    return dateStatus?.[getDateKey(day)] ?? 'available'
  }

  function isSelected(day: number): boolean {
    return value === getDateKey(day)
  }

  function isDisabled(day: number): boolean {
    const s = getStatus(day)
    if (s === 'past' || s === 'outside') return true
    if (s === 'full' && !allowFullDates) return true
    // 'closed' is *not* disabled — it's clickable and routes to the inquiry
    // flow via onClosedDayClick (handled in handleDayClick).
    return false
  }

  function handleDayClick(day: number) {
    const s = getStatus(day)
    if (s === 'past' || s === 'outside') return
    const k = getDateKey(day)
    if (s === 'closed') {
      onClosedDayClick?.(k)
      return
    }
    if (s === 'full' && !allowFullDates) return
    onChange(isSelected(day) ? null : k)
  }

  const monthLabel = useMemo(() => {
    // Locale-aware month + year label. Falls back to English if Intl missing.
    try {
      const d = new Date(viewYear, viewMonth - 1, 1)
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
    } catch {
      const key = MONTH_KEYS[viewMonth - 1]
      return `${key.charAt(0).toUpperCase()}${key.slice(1)} ${viewYear}`
    }
  }, [viewMonth, viewYear, locale])

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => canGoBack && navigateMonth(-1)}
          className={`flex items-center justify-center w-9 h-9 rounded-full border-none transition-colors ${
            canGoBack
              ? 'bg-transparent hover:bg-[#E8ECE4] cursor-pointer text-[#1A1208]'
              : 'bg-transparent cursor-not-allowed text-[#6B6157]/70'
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

      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="py-2 text-center text-[15px] font-semibold uppercase tracking-wider text-[#6B6157]">
            {d.slice(0, 2)}
          </div>
        ))}
      </div>

      <div className={`transition-opacity duration-150 ${monthFading ? 'opacity-0' : 'opacity-100'}`}>
        {loading ? (
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
                  <DayCell
                    day={day}
                    status={getStatus(day)}
                    selected={isSelected(day)}
                    disabled={isDisabled(day)}
                    today={isToday(day)}
                    onClick={() => handleDayClick(day)}
                    ariaLabel={
                      getStatus(day) === 'closed'
                        ? `${getDateKey(day)} (closed — tap to inquire)`
                        : getDateKey(day)
                    }
                    t={t}
                  />
                ) : (
                  <div className="w-12 h-12" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showLegend && (
        <div className="flex items-center justify-center gap-6 pt-4 mt-2 border-t border-[#F2EDE6]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#6B7F5E]" />
            <span className="text-[14px] font-medium text-[#1A1208]">{t('legend.available')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#C47D52]" />
            <span className="text-[14px] font-medium text-[#C47D52]">{t('legend.limited')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#6B6157]/30" />
            <span className="text-[14px] font-medium text-[#6B6157]">{t('legend.full')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
