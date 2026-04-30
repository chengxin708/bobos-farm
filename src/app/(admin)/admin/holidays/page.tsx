'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import useSWR from 'swr'
import { Calendar, Sparkles } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'
import { getFederalHolidays, type FederalHoliday } from '@/lib/us-federal-holidays'
import type { OperatingDayMode } from '@/lib/operating-day-pure'

// ── Types ──────────────────────────────────────────────────────────

interface OperatingDayRow {
  id: string
  date: string // ISO datetime string from API (UTC midnight)
  mode: OperatingDayMode
  note: string | null
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

/** "YYYY-MM-DD" UTC string from a Date (uses UTC components). */
function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

// ── Toggle component ───────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none ${
        checked ? 'bg-[#6B7F5E]' : 'bg-[#D6D1CA]'
      }`}
    >
      <span
        className={`absolute top-0.5 ${
          checked ? 'left-[22px]' : 'left-0.5'
        } w-5 h-5 rounded-full bg-white shadow-sm transition-all`}
      />
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────

export default function HolidaysAdminPage() {
  const t = useTranslations('admin.holidays')
  const tDays = useTranslations('admin.holidays.days')
  const locale = useLocale()
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US'

  const today = new Date()
  const currentYear = today.getFullYear()
  const [year, setYear] = useState<number>(currentYear)

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  // The holiday list for the chosen year — cross-year observed shifts
  // (e.g. Jan 1 2028 falls back to Dec 31 2027) push some entries into
  // adjacent years, so we widen the SWR window below.
  const holidays = useMemo<FederalHoliday[]>(() => getFederalHolidays(year), [year])

  // Wide window so cross-year observed shifts are covered.
  const swrKey = `/api/operating-days?startDate=${year - 1}-12-01&endDate=${year + 1}-01-31`
  const { data: rows, mutate } = useSWR<OperatingDayRow[]>(swrKey, fetcher)

  // Index rows by ISO calendar date.
  const rowByDate = useMemo(() => {
    const map = new Map<string, OperatingDayRow>()
    if (!rows) return map
    for (const r of rows) map.set(r.date.slice(0, 10), r)
    return map
  }, [rows])

  // Format a UTC midnight date into the user's locale, but fixed to UTC
  // so the calendar date doesn't drift across viewer timezones.
  const formatHolidayDate = useCallback(
    (d: Date) =>
      d.toLocaleDateString(dateLocale, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
    [dateLocale],
  )

  // ── Per-row state derivation ─────────────────────────────────────

  interface RowState {
    holiday: FederalHoliday
    dateStr: string
    isWeekend: boolean
    row?: OperatingDayRow
    isOpen: boolean
    statusKind: 'openExplicit' | 'openWeekendDefault' | 'closedDefault' | 'closedExplicit' | 'privateEvent'
    /** Show 2-state toggle? Otherwise read-only note. */
    showToggle: boolean
  }

  function deriveRow(holiday: FederalHoliday): RowState {
    const dateStr = toIsoDate(holiday.date)
    const dow = holiday.dayOfWeek
    const isWeekend = dow === 0 || dow === 6
    const row = rowByDate.get(dateStr)
    let isOpen: boolean
    let statusKind: RowState['statusKind']
    if (row) {
      if (row.mode === 'OPEN') {
        isOpen = true
        statusKind = 'openExplicit'
      } else if (row.mode === 'PRIVATE_EVENT') {
        isOpen = false
        statusKind = 'privateEvent'
      } else {
        isOpen = false
        statusKind = 'closedExplicit'
      }
    } else if (isWeekend) {
      isOpen = true
      statusKind = 'openWeekendDefault'
    } else {
      isOpen = false
      statusKind = 'closedDefault'
    }
    const showToggle = !isWeekend && (!row || row.mode === 'OPEN')
    return { holiday, dateStr, isWeekend, row, isOpen, statusKind, showToggle }
  }

  const rowStates = useMemo(
    () => holidays.map(deriveRow),
    // deriveRow closes over rowByDate; recompute when either changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holidays, rowByDate],
  )

  // Mon/Fri holidays not yet open and currently toggleable.
  const bulkCandidates = useMemo(
    () =>
      rowStates.filter(
        (s) => (s.holiday.dayOfWeek === 1 || s.holiday.dayOfWeek === 5) && s.showToggle && !s.isOpen,
      ),
    [rowStates],
  )

  // ── Mutations (optimistic, mirrors CalendarDesktop pattern) ──────

  const handleToggle = useCallback(
    async (state: RowState, on: boolean) => {
      const previous = rows ?? []
      let optimistic: OperatingDayRow[]
      if (on) {
        // Create OPEN row
        optimistic = [
          ...previous.filter((r) => r.date.slice(0, 10) !== state.dateStr),
          {
            id: '__optimistic__',
            date: `${state.dateStr}T00:00:00.000Z`,
            mode: 'OPEN',
            note: `holiday: ${state.holiday.nameEn}`,
          },
        ]
      } else {
        // Delete row
        optimistic = previous.filter((r) => r.id !== state.row?.id)
      }
      await mutate(optimistic, { revalidate: false })
      try {
        if (on) {
          const resp = await fetch('/api/operating-days', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: state.dateStr,
              mode: 'OPEN',
              note: `holiday: ${state.holiday.nameEn}`,
            }),
          })
          if (!resp.ok) throw new Error('POST failed')
        } else if (state.row?.id) {
          const resp = await fetch(`/api/operating-days/${state.row.id}`, { method: 'DELETE' })
          if (!resp.ok) throw new Error('DELETE failed')
        }
        await mutate()
      } catch (err) {
        await mutate(previous, { revalidate: false })
        alert(t('errorMsg'))
        console.error('Holiday toggle failed:', err)
      }
    },
    [rows, mutate, t],
  )

  const handleBulkApply = useCallback(async () => {
    if (bulkCandidates.length === 0) return
    const previous = rows ?? []
    // Build optimistic list: everything previous keeps, plus a new OPEN row
    // per candidate (filter out any same-date stale entries first).
    const candidateDates = new Set(bulkCandidates.map((c) => c.dateStr))
    const optimistic: OperatingDayRow[] = [
      ...previous.filter((r) => !candidateDates.has(r.date.slice(0, 10))),
      ...bulkCandidates.map((c, idx) => ({
        id: `__optimistic_bulk_${idx}__`,
        date: `${c.dateStr}T00:00:00.000Z`,
        mode: 'OPEN' as OperatingDayMode,
        note: `holiday: ${c.holiday.nameEn}`,
      })),
    ]
    await mutate(optimistic, { revalidate: false })
    try {
      for (const c of bulkCandidates) {
        const resp = await fetch('/api/operating-days', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: c.dateStr,
            mode: 'OPEN',
            note: `holiday: ${c.holiday.nameEn}`,
          }),
        })
        if (!resp.ok) throw new Error(`POST failed for ${c.dateStr}`)
      }
      await mutate()
    } catch (err) {
      await mutate(previous, { revalidate: false })
      alert(t('errorMsg'))
      console.error('Holiday bulk apply failed:', err)
    }
  }, [bulkCandidates, rows, mutate, t])

  // ── Render helpers ───────────────────────────────────────────────

  function dayPillClass(dow: number): string {
    if (dow === 1 || dow === 5) return 'bg-[#6B7F5E]/15 text-[#5A6E4F]'
    if (dow === 0 || dow === 6) return 'bg-[#E8ECE4] text-[#6B6157]'
    return 'bg-[#F2EDE6] text-[#6B6157]'
  }

  function statusDotClass(kind: RowState['statusKind']): string {
    switch (kind) {
      case 'openExplicit':
      case 'openWeekendDefault':
        return 'bg-[#6B7F5E]'
      case 'privateEvent':
        return 'bg-[#E67E22]'
      case 'closedExplicit':
        return 'bg-[#DC3545]'
      case 'closedDefault':
      default:
        return 'bg-[#8C8478]'
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <AdminTopBar title={t('title')} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 flex flex-col gap-5 max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Calendar size={22} className="text-[#6B7F5E]" />
              <h1 className="text-xl md:text-2xl font-semibold text-[#1A1208] m-0 font-serif">
                {t('title')}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="holiday-year" className="text-sm text-[#8C8478]">
                {t('yearLabel')}
              </label>
              <select
                id="holiday-year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-sm bg-white border border-[#E8ECE4] rounded-lg px-3 py-1.5 text-[#1A1208] cursor-pointer focus:outline-none focus:border-[#6B7F5E]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-sm text-[#8C8478] m-0 leading-relaxed">{t('subtitle')}</p>

          {/* Suggestion banner */}
          {bulkCandidates.length > 0 && (
            <div className="bg-[#FDF5E6] border border-[#E8DDB8] rounded-xl p-4 flex items-start md:items-center gap-3 flex-col md:flex-row">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#F4E5B8] flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-[#A87B2A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1A1208]">
                    {t('suggestionTitle', { count: bulkCandidates.length })}
                  </div>
                  <div className="text-xs text-[#8C8478] mt-0.5">{t('suggestionSubtitle')}</div>
                </div>
              </div>
              <button
                onClick={handleBulkApply}
                className="bg-[#6B7F5E] text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer border-none hover:bg-[#5A6E4F] transition-colors shrink-0 self-stretch md:self-auto"
              >
                {t('suggestionApply')}
              </button>
            </div>
          )}

          {/* Holiday table */}
          <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[140px_80px_1fr_180px_140px] gap-3 px-4 py-3 border-b border-[#E8ECE4] bg-[#F8F7F4] text-xs font-medium text-[#8C8478] uppercase tracking-wide">
              <div>{t('col.date')}</div>
              <div>{t('col.day')}</div>
              <div>{t('col.holiday')}</div>
              <div>{t('col.status')}</div>
              <div className="text-right">{t('col.action')}</div>
            </div>

            {/* Rows */}
            {rowStates.map((state) => {
              const { holiday, isOpen, statusKind } = state
              const dayLabel = tDays(DAY_KEYS[holiday.dayOfWeek])
              const name = locale === 'zh' ? holiday.nameZh : holiday.nameEn
              return (
                <div
                  key={holiday.id}
                  className="grid grid-cols-1 md:grid-cols-[140px_80px_1fr_180px_140px] gap-2 md:gap-3 px-4 py-3 border-b border-[#F2EDE6] last:border-b-0 items-start md:items-center"
                >
                  {/* Date */}
                  <div className="text-sm text-[#1A1208] font-medium md:font-normal">
                    <span className="md:hidden text-xs text-[#8C8478] mr-2">{t('col.date')}:</span>
                    {formatHolidayDate(holiday.date)}
                  </div>

                  {/* Day pill */}
                  <div>
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${dayPillClass(
                        holiday.dayOfWeek,
                      )}`}
                    >
                      {dayLabel}
                    </span>
                  </div>

                  {/* Name + observed note */}
                  <div className="text-sm text-[#1A1208] min-w-0">
                    <div className="font-medium md:font-normal">{name}</div>
                    {holiday.isObserved && holiday.actualDate && (
                      <div className="text-xs text-[#8C8478] mt-0.5">
                        {t('observedNote', { actual: formatHolidayDate(holiday.actualDate) })}
                      </div>
                    )}
                  </div>

                  {/* Status pill */}
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${statusDotClass(statusKind)}`} />
                    <span className="text-sm text-[#1A1208]">{t(`status.${statusKind}`)}</span>
                  </div>

                  {/* Action */}
                  <div className="md:text-right md:justify-self-end">
                    {state.showToggle ? (
                      <ToggleSwitch
                        checked={isOpen}
                        onChange={(on) => handleToggle(state, on)}
                        label={t('toggleLabel')}
                      />
                    ) : state.isWeekend ? (
                      <span className="text-xs italic text-[#8C8478]">{t('weekendNote')}</span>
                    ) : (
                      <Link
                        href="/admin/calendar"
                        className="text-xs italic text-[#6B7F5E] underline hover:text-[#5A6E4F]"
                      >
                        {t('manageInCalendar')}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footnote */}
          <p className="text-xs text-[#8C8478] leading-relaxed m-0">{t('footnote')}</p>
        </div>
      </div>
    </>
  )
}
