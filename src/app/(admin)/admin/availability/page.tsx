"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { ChevronLeft, ChevronRight, Save, Calendar, X, Users } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface Yurt {
  id: string
  name: string
  capacity: number
  status: string
}

interface AvailabilityEntry {
  id: string
  yurtId: string
  date: string
  isOpen: boolean
  note: string | null
  yurt: { id: string; name: string }
}

interface ReservationUser {
  id: string
  name: string | null
  email: string
}

interface Reservation {
  id: string
  yurtId: string
  date: string
  guestCount: number
  status: string
  user: ReservationUser
  yurt: { id: string; name: string }
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function getMonthDays(year: number, month: number): { date: Date; day: number }[] {
  const days: { date: Date; day: number }[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), day: d })
  }
  return days
}

function toDateKey(date: Date | string): string {
  // Extract YYYY-MM-DD from ISO string directly to avoid timezone shift
  if (typeof date === 'string') {
    return date.slice(0, 10)
  }
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Component ──────────────────────────────────────────────────────

export default function Availability() {
  const t = useTranslations('admin.availability')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  // Calendar state
  const now = new Date()
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 3000)
  }, [])

  // Bulk range state
  const [openStart, setOpenStart] = useState('')
  const [openEnd, setOpenEnd] = useState('')
  const [closeStart, setCloseStart] = useState('')
  const [closeEnd, setCloseEnd] = useState('')

  // Redirect non-admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [sessionStatus, session, router])

  // Compute date range for API
  const startDate = formatDateISO(currentYear, currentMonth, 1)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const endDate = formatDateISO(currentYear, currentMonth, daysInMonth)

  // Fetch data
  const { data: yurts } = useSWR<Yurt[]>('/api/yurts', fetcher)
  const { data: availability, mutate: mutateAvailability } = useSWR<AvailabilityEntry[]>(
    `/api/availability?startDate=${startDate}&endDate=${endDate}`,
    fetcher
  )
  const { data: reservations } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${startDate}&endDate=${endDate}`,
    fetcher
  )

  // Index availability by date+yurt
  const availabilityIndex = useMemo(() => {
    const idx: Record<string, Record<string, AvailabilityEntry>> = {}
    availability?.forEach(a => {
      const dateKey = toDateKey(a.date)
      if (!idx[dateKey]) idx[dateKey] = {}
      idx[dateKey][a.yurtId] = a
    })
    return idx
  }, [availability])

  // Index reservations by date
  const reservationsByDate = useMemo(() => {
    const idx: Record<string, Reservation[]> = {}
    reservations?.forEach(r => {
      if (['CANCELLED', 'EXPIRED'].includes(r.status)) return
      const dateKey = toDateKey(r.date)
      if (!idx[dateKey]) idx[dateKey] = []
      idx[dateKey].push(r)
    })
    return idx
  }, [reservations])

  // Calendar cells
  const monthDays = getMonthDays(currentYear, currentMonth)
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  monthDays.forEach(d => cells.push(d.day))
  while (cells.length % 7 !== 0) cells.push(null)

  // Today detection
  const todayKey = formatDateISO(now.getFullYear(), now.getMonth(), now.getDate())

  // Get status for a date cell
  const getCellStatus = (day: number): { allOpen: boolean; allClosed: boolean; hasMixed: boolean; hasReservations: boolean; resCount: number } => {
    const dateKey = formatDateISO(currentYear, currentMonth, day)
    const dateAvail = availabilityIndex[dateKey] || {}
    const yurtList = yurts || []
    const dateRes = reservationsByDate[dateKey] || []

    let openCount = 0
    let closedCount = 0

    yurtList.forEach(yurt => {
      const a = dateAvail[yurt.id]
      if (a && !a.isOpen) closedCount++
      else openCount++ // default is open if no entry
    })

    return {
      allOpen: closedCount === 0 && openCount > 0,
      allClosed: openCount === 0 && closedCount > 0,
      hasMixed: openCount > 0 && closedCount > 0,
      hasReservations: dateRes.length > 0,
      resCount: dateRes.length,
    }
  }

  // Navigation
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
    setSelectedDate(null)
    setSelectedDates(new Set())
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
    setSelectedDate(null)
    setSelectedDates(new Set())
  }

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Handle date click (with shift for multi-select)
  const handleDateClick = useCallback((day: number, shiftKey: boolean) => {
    const dateKey = formatDateISO(currentYear, currentMonth, day)
    if (shiftKey) {
      setSelectedDates(prev => {
        const next = new Set(prev)
        if (next.has(dateKey)) next.delete(dateKey)
        else next.add(dateKey)
        return next
      })
    } else {
      setSelectedDate(day)
      setSelectedDates(new Set())
      // Load note for selected date
      const dateAvail = availabilityIndex[dateKey] || {}
      const firstEntry = Object.values(dateAvail)[0]
      setAdminNote(firstEntry?.note || '')
    }
  }, [currentYear, currentMonth, availabilityIndex])

  // Per-yurt toggle on selected date
  const handleToggleYurt = useCallback(async (yurtId: string, isOpen: boolean) => {
    if (selectedDate === null) return
    setSaving(true)
    try {
      await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yurtId,
          date: formatDateISO(currentYear, currentMonth, selectedDate),
          isOpen,
        }),
      })
      mutateAvailability()
      showSuccess(isOpen ? t('success.yurtOpened') : t('success.yurtClosed'))
    } catch {
      alert('Failed to update availability')
    } finally {
      setSaving(false)
    }
  }, [selectedDate, currentYear, currentMonth, mutateAvailability, showSuccess, t])

  // Save admin note
  const handleSaveNote = useCallback(async () => {
    if (selectedDate === null || !yurts?.length) return
    setSaving(true)
    try {
      // Save note for all yurts on this date (parallel requests)
      const dateKey = formatDateISO(currentYear, currentMonth, selectedDate)
      await Promise.all(yurts.map(yurt => {
        const existing = availabilityIndex[dateKey]?.[yurt.id]
        return fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yurtId: yurt.id,
            date: dateKey,
            isOpen: existing ? existing.isOpen : true,
            note: adminNote,
          }),
        })
      }))
      mutateAvailability()
      showSuccess('Note saved.')
    } catch {
      alert('Failed to save note')
    } finally {
      setSaving(false)
    }
  }, [selectedDate, currentYear, currentMonth, yurts, adminNote, availabilityIndex, mutateAvailability, showSuccess])

  // Bulk open/close
  const handleBulkAction = useCallback(async (isOpen: boolean, start: string, end: string) => {
    if (!start || !end) { alert('Please fill both start and end dates'); return }
    if (!isOpen && !confirm(`Close all yurts from ${start} to ${end}? Existing reservations will not be affected.`)) return
    setSaving(true)
    try {
      const res = await fetch('/api/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, isOpen }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to update')
        return
      }
      mutateAvailability()
      showSuccess(`All yurts ${isOpen ? 'opened' : 'closed'} from ${start} to ${end}.`)
    } catch {
      alert('Failed to bulk update')
    } finally {
      setSaving(false)
    }
  }, [mutateAvailability, showSuccess])

  // Batch from multi-select
  const handleBatchSelected = useCallback(async (isOpen: boolean) => {
    if (selectedDates.size === 0) return
    if (!isOpen && !confirm(`Close all yurts for ${selectedDates.size} selected dates?`)) return
    setSaving(true)
    try {
      const dates = Array.from(selectedDates).sort()
      await fetch('/api/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          isOpen,
        }),
      })
      mutateAvailability()
      setSelectedDates(new Set())
      showSuccess(`${selectedDates.size} dates ${isOpen ? 'opened' : 'closed'} successfully.`)
    } catch {
      alert('Failed to batch update')
    } finally {
      setSaving(false)
    }
  }, [selectedDates, mutateAvailability, showSuccess])

  // Selected date info
  const selectedDateKey = selectedDate !== null ? formatDateISO(currentYear, currentMonth, selectedDate) : null
  const selectedDateAvail = selectedDateKey ? (availabilityIndex[selectedDateKey] || {}) : {}
  const selectedDateRes = selectedDateKey ? (reservationsByDate[selectedDateKey] || []) : []
  const selectedDateLabel = selectedDate !== null
    ? new Date(currentYear, currentMonth, selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''

  // Yurt availability for selected date
  const yurtAvailList = (yurts || []).map(yurt => {
    const entry = selectedDateAvail[yurt.id]
    const isOpen = entry ? entry.isOpen : true // default open
    return { ...yurt, isOpen }
  })

  const openYurtCount = yurtAvailList.filter(y => y.isOpen).length

  // ── Loading state ────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <TopBar title={t('title')} />
        <div className="flex-1 p-6 flex items-center justify-center" style={{ background: '#F5F2ED' }}>
          <p className="text-[#8A7E6B]">Loading...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex flex-col overflow-auto" style={{ background: '#F5F2ED' }}>
        {/* Success Message */}
        {successMsg && (
          <div className="mx-6 mt-5 bg-[#EAF2E3] border border-[#4A7C59]/20 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/50 hover:text-[#2D5016] transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Date Range Controls Card */}
        <div className="mx-6 mt-5 bg-white rounded-xl border border-[#E8E2D9] p-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            {/* Open Range */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#2C2416]">{t('openRange')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={openStart}
                    onChange={(e) => setOpenStart(e.target.value)}
                    className="border border-[#E8E2D9] rounded-lg px-3 py-2 text-sm w-[150px] bg-white text-[#2C2416] focus:outline-none focus:ring-2 focus:ring-[#8B6914]/40 focus:border-[#8B6914] transition-shadow"
                  />
                  <span className="text-[#8A7E6B] text-sm">-</span>
                  <input
                    type="date"
                    value={openEnd}
                    onChange={(e) => setOpenEnd(e.target.value)}
                    className="border border-[#E8E2D9] rounded-lg px-3 py-2 text-sm w-[150px] bg-white text-[#2C2416] focus:outline-none focus:ring-2 focus:ring-[#8B6914]/40 focus:border-[#8B6914] transition-shadow"
                  />
                </div>
              </div>
              <button
                onClick={() => handleBulkAction(true, openStart, openEnd)}
                disabled={saving}
                className="bg-[#4A7C59] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#3D6B4A] transition-colors cursor-pointer"
              >
                {t('openAll')}
              </button>
            </div>

            {/* Close Range */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#2C2416]">{t('closeRange')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={closeStart}
                    onChange={(e) => setCloseStart(e.target.value)}
                    className="border border-[#E8E2D9] rounded-lg px-3 py-2 text-sm w-[150px] bg-white text-[#2C2416] focus:outline-none focus:ring-2 focus:ring-[#8B6914]/40 focus:border-[#8B6914] transition-shadow"
                  />
                  <span className="text-[#8A7E6B] text-sm">-</span>
                  <input
                    type="date"
                    value={closeEnd}
                    onChange={(e) => setCloseEnd(e.target.value)}
                    className="border border-[#E8E2D9] rounded-lg px-3 py-2 text-sm w-[150px] bg-white text-[#2C2416] focus:outline-none focus:ring-2 focus:ring-[#8B6914]/40 focus:border-[#8B6914] transition-shadow"
                  />
                </div>
              </div>
              <button
                onClick={() => handleBulkAction(false, closeStart, closeEnd)}
                disabled={saving}
                className="bg-[#C4533A] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#A8452F] transition-colors cursor-pointer"
              >
                {t('closeAll')}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: Calendar + Sidebar */}
        <div className="flex-1 flex gap-5 px-6 py-5 min-h-0">
          {/* Left - Calendar */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Month Navigation + Legend */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={18} className="text-[#2C2416]" />
                </button>
                <span className="text-lg font-semibold text-[#2C2416] font-playfair min-w-[180px] text-center">
                  {monthLabel}
                </span>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors cursor-pointer"
                >
                  <ChevronRight size={18} className="text-[#2C2416]" />
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5 text-xs text-[#8A7E6B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#E8E2D9]" /> {t('legend.open')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#8A7E6B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEE2E2]" /> {t('legend.closed')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#8A7E6B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEF3C7]" /> {t('legend.limited')}
                </span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-xl border border-[#E8E2D9] overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7" style={{ background: '#FAFAF7' }}>
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="text-center py-2.5 text-[11px] font-semibold tracking-wider text-[#8A7E6B] uppercase">
                    {d}
                  </div>
                ))}
              </div>
              {/* Date cells */}
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  if (day === null) {
                    return (
                      <div
                        key={idx}
                        className="min-h-[80px] border-t border-r border-[#E8E2D9]/60"
                        style={{ background: '#FAFAF7' }}
                      />
                    )
                  }

                  const status = getCellStatus(day)
                  const dateKey = formatDateISO(currentYear, currentMonth, day)
                  const isSelected = day === selectedDate
                  const isMultiSelected = selectedDates.has(dateKey)
                  const isToday = dateKey === todayKey

                  // Soft pastel backgrounds
                  let cellBg = 'bg-white'
                  if (status.allClosed) cellBg = 'bg-[#FEE2E2]'
                  else if (status.hasMixed) cellBg = 'bg-[#FEF3C7]'

                  return (
                    <div
                      key={idx}
                      onClick={(e) => handleDateClick(day, e.shiftKey)}
                      className={`
                        relative min-h-[80px] p-2 border-t border-r border-[#E8E2D9]/60 cursor-pointer
                        transition-all duration-150 hover:shadow-md hover:z-10
                        ${cellBg}
                        ${isSelected ? 'ring-2 ring-[#8B6914] ring-inset shadow-sm' : ''}
                        ${isMultiSelected ? 'ring-2 ring-[#8B6914] ring-inset ring-dashed' : ''}
                      `}
                      style={isMultiSelected && !isSelected ? { borderStyle: 'dashed' } : undefined}
                    >
                      {/* Today accent */}
                      {isToday && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8B6914] rounded-r-full" />
                      )}

                      {/* Date number */}
                      <span className={`text-[13px] font-medium ${isSelected ? 'text-[#8B6914]' : isToday ? 'text-[#8B6914] font-semibold' : 'text-[#2C2416]'}`}>
                        {day}
                      </span>

                      {/* Status labels */}
                      <div className="mt-1 flex flex-col gap-0.5">
                        {status.hasReservations && (
                          <span className="text-[10px] text-[#4A7C59] font-medium">
                            {status.resCount} res
                          </span>
                        )}
                        {status.hasMixed && (
                          <span className="text-[10px] text-[#92710C]">{t('legend.limited')}</span>
                        )}
                        {status.allClosed && (
                          <span className="text-[10px] text-[#C4533A]">{t('legend.closed')}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Multi-select batch actions */}
            {selectedDates.size > 0 && (
              <div className="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 border border-[#E8E2D9]">
                <span className="text-sm text-[#2C2416] font-medium">{selectedDates.size} dates selected</span>
                <button
                  onClick={() => handleBatchSelected(true)}
                  disabled={saving}
                  className="bg-[#4A7C59] text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#3D6B4A] transition-colors cursor-pointer"
                >
                  {t('openAll')}
                </button>
                <button
                  onClick={() => handleBatchSelected(false)}
                  disabled={saving}
                  className="bg-[#C4533A] text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#A8452F] transition-colors cursor-pointer"
                >
                  {t('closeAll')}
                </button>
                <button
                  onClick={() => setSelectedDates(new Set())}
                  className="text-sm text-[#8A7E6B] hover:text-[#2C2416] ml-auto transition-colors cursor-pointer"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-[300px] flex flex-col gap-4 shrink-0">
            {selectedDate !== null ? (
              <>
                {/* Date Header + Yurt Toggles */}
                <div className="bg-white rounded-xl border border-[#E8E2D9] p-5 flex flex-col gap-4">
                  {/* Date heading */}
                  <div>
                    <h3 className="text-base font-semibold text-[#2C2416] font-playfair">
                      {selectedDateLabel}
                    </h3>
                    <p className="text-xs text-[#8A7E6B] mt-1">
                      {t('legend.open')} &middot; {openYurtCount} {t('dayDetail.remaining')}
                    </p>
                  </div>

                  {/* Per-yurt availability */}
                  <div>
                    <h4 className="text-xs font-semibold text-[#2C2416] mb-3">{t('dayDetail.perYurtAvailability')}</h4>
                    <div className="flex flex-col gap-2.5">
                      {yurtAvailList.map((yurt) => (
                        <div key={yurt.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${yurt.isOpen ? 'bg-[#4A7C59]' : 'bg-[#C4533A]'}`} />
                            <span className="text-sm text-[#2C2416]">{yurt.name}</span>
                          </div>
                          <button
                            onClick={() => handleToggleYurt(yurt.id, !yurt.isOpen)}
                            disabled={saving}
                            className={`text-xs font-semibold px-3 py-1 rounded-md cursor-pointer disabled:opacity-50 transition-colors ${
                              yurt.isOpen
                                ? 'bg-[#4A7C59] text-white hover:bg-[#3D6B4A]'
                                : 'bg-[#C4533A] text-white hover:bg-[#A8452F]'
                            }`}
                          >
                            {yurt.isOpen ? t('legend.open') : t('legend.closed')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reservations Card */}
                <div className="bg-white rounded-xl border border-[#E8E2D9] p-5 flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-[#2C2416]">
                    {t('dayDetail.reservations')} ({selectedDateRes.length})
                  </h4>
                  {selectedDateRes.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-3">
                      <Calendar size={20} className="text-[#E8E2D9]" />
                      <span className="text-xs text-[#8A7E6B]">No reservations</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedDateRes.map((r) => (
                        <div key={r.id} className="bg-[#FAFAF7] rounded-lg px-3 py-2.5">
                          <div className="text-sm font-medium text-[#2C2416]">{r.user?.name || 'Unknown'}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#8A7E6B]">
                            <span>{r.yurt?.name}</span>
                            <span>&middot;</span>
                            <Users size={11} className="inline" />
                            <span>{r.guestCount}</span>
                            <span>&middot;</span>
                            <span className="capitalize">{r.status.toLowerCase()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Notes Card */}
                <div className="bg-white rounded-xl border border-[#E8E2D9] p-5 flex flex-col gap-3">
                  <h4 className="text-xs font-semibold text-[#2C2416]">{t('dayDetail.adminNote')}</h4>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="border border-[#E8E2D9] rounded-lg p-3 text-sm h-24 resize-none text-[#2C2416] placeholder:text-[#C4BDB2] focus:outline-none focus:ring-2 focus:ring-[#8B6914]/40 focus:border-[#8B6914] transition-shadow"
                    placeholder="Private note (e.g. overflow / extra shift needed)"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={saving}
                    className="bg-[#4A7C59] text-white text-xs font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 self-end disabled:opacity-50 hover:bg-[#3D6B4A] transition-colors cursor-pointer"
                  >
                    <Save size={13} /> {t('dayDetail.saveNote')}
                  </button>
                </div>
              </>
            ) : (
              /* Empty State */
              <div className="bg-white rounded-xl border border-[#E8E2D9] p-8 flex flex-col items-center gap-4 mt-8">
                <div className="w-14 h-14 rounded-full bg-[#F5F2ED] flex items-center justify-center">
                  <Calendar size={24} className="text-[#C4BDB2]" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#8A7E6B]">Click a date to see details</p>
                  <p className="text-xs text-[#C4BDB2] mt-1.5">Hold Shift + click to multi-select</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
