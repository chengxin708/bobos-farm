"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'

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

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
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
      const dateKey = toDateKey(new Date(a.date))
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
      const dateKey = toDateKey(new Date(r.date))
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
      showSuccess(`Yurt ${isOpen ? 'opened' : 'closed'} for this date.`)
    } catch {
      alert('Failed to update availability')
    } finally {
      setSaving(false)
    }
  }, [selectedDate, currentYear, currentMonth, mutateAvailability, showSuccess])

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
        <div className="flex-1 p-6 flex items-center justify-center bg-cream-bg">
          <p className="text-gray-text">Loading...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-4 bg-cream-bg overflow-auto">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-[#EAF2E3] border border-[#5B8C3E]/30 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/60 hover:text-[#2D5016]">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        )}

        <div className="flex-1 flex gap-5">
        {/* Left - Calendar */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Date Range Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-brown">{t('openRange')}</span>
            <input
              type="date"
              value={openStart}
              onChange={(e) => setOpenStart(e.target.value)}
              className="border border-beige rounded-md px-3 py-1.5 text-sm w-36 bg-white text-brown"
            />
            <span className="text-sm text-gray-text">-</span>
            <input
              type="date"
              value={openEnd}
              onChange={(e) => setOpenEnd(e.target.value)}
              className="border border-beige rounded-md px-3 py-1.5 text-sm w-36 bg-white text-brown"
            />
            <button
              onClick={() => handleBulkAction(true, openStart, openEnd)}
              disabled={saving}
              className="bg-[#5B8C3E] text-white text-sm font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              {t('openAll')}
            </button>

            <span className="text-sm font-semibold text-brown ml-4">{t('closeRange')}</span>
            <input
              type="date"
              value={closeStart}
              onChange={(e) => setCloseStart(e.target.value)}
              className="border border-beige rounded-md px-3 py-1.5 text-sm w-36 bg-white text-brown"
            />
            <span className="text-sm text-gray-text">-</span>
            <input
              type="date"
              value={closeEnd}
              onChange={(e) => setCloseEnd(e.target.value)}
              className="border border-beige rounded-md px-3 py-1.5 text-sm w-36 bg-white text-brown"
            />
            <button
              onClick={() => handleBulkAction(false, closeStart, closeEnd)}
              disabled={saving}
              className="bg-[#DC3545] text-white text-sm font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
            >
              {t('closeAll')}
            </button>
          </div>

          {/* Month Nav */}
          <div className="flex items-center gap-3">
            <ChevronLeft size={16} className="text-brown cursor-pointer" onClick={prevMonth} />
            <span className="text-sm font-bold text-brown">{monthLabel}</span>
            <ChevronRight size={16} className="text-brown cursor-pointer" onClick={nextMonth} />
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
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-beige overflow-hidden">
            <div className="grid grid-cols-7">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="text-center py-2 text-xs font-semibold text-gray-text border-b border-beige">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (day === null) {
                  return (
                    <div key={idx} className="min-h-[70px] p-2 border-b border-r border-beige/50 bg-gray-50/50" />
                  )
                }

                const status = getCellStatus(day)
                const dateKey = formatDateISO(currentYear, currentMonth, day)
                const isSelected = day === selectedDate
                const isMultiSelected = selectedDates.has(dateKey)

                let bgColor = 'bg-white'
                if (status.allClosed) bgColor = 'bg-[#FDE8E8]'
                else if (status.hasMixed) bgColor = 'bg-[#FEF3CD]'

                return (
                  <div
                    key={idx}
                    onClick={(e) => handleDateClick(day, e.shiftKey)}
                    className={`min-h-[70px] p-2 border-b border-r border-beige/50 cursor-pointer transition-colors ${bgColor} ${
                      isSelected ? 'ring-2 ring-amber ring-inset' : ''
                    } ${isMultiSelected ? 'ring-2 ring-[#3B82F6] ring-inset' : ''}`}
                  >
                    <span className={`text-xs font-semibold ${isSelected ? 'text-amber' : 'text-brown'}`}>
                      {day}
                    </span>
                    {status.hasReservations && (
                      <div className="text-[9px] mt-1 text-[#3B82F6] font-medium">
                        {status.resCount} res
                      </div>
                    )}
                    {status.hasMixed && (
                      <div className="text-[9px] mt-0.5 text-[#D4A017]">{t('legend.limited')}</div>
                    )}
                    {status.allClosed && (
                      <div className="text-[9px] mt-0.5 text-[#DC3545]">{t('legend.closed')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          {selectedDates.size > 0 && (
            <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border border-beige">
              <span className="text-sm text-brown font-medium">{selectedDates.size} dates selected</span>
              <button
                onClick={() => handleBatchSelected(true)}
                disabled={saving}
                className="bg-[#5B8C3E] text-white text-sm font-semibold px-4 py-1.5 rounded-md disabled:opacity-50"
              >
                {t('openAll')}
              </button>
              <button
                onClick={() => handleBatchSelected(false)}
                disabled={saving}
                className="bg-[#DC3545] text-white text-sm font-semibold px-4 py-1.5 rounded-md disabled:opacity-50"
              >
                {t('closeAll')}
              </button>
              <button
                onClick={() => setSelectedDates(new Set())}
                className="text-sm text-gray-text hover:text-brown ml-auto"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-[280px] flex flex-col gap-4 shrink-0">
          {selectedDate !== null ? (
            <>
              {/* Date info */}
              <div className="bg-white rounded-xl border border-beige p-4 flex flex-col gap-3">
                <div className="text-sm font-bold text-brown">{selectedDateLabel}</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-text">
                  <span className="w-3 h-3 rounded-sm bg-white border border-beige" />
                  {t('legend.open')} - {openYurtCount} {t('dayDetail.remaining')}
                </div>

                <div className="text-xs font-bold text-brown mt-2">{t('dayDetail.perYurtAvailability')}</div>
                {yurtAvailList.map((yurt) => (
                  <div key={yurt.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${yurt.isOpen ? 'bg-[#5B8C3E]' : 'bg-[#DC3545]'}`} />
                      <span className="text-xs text-brown">{yurt.name}</span>
                    </div>
                    <button
                      onClick={() => handleToggleYurt(yurt.id, !yurt.isOpen)}
                      disabled={saving}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer border-none disabled:opacity-50 ${
                        yurt.isOpen
                          ? 'bg-[#EAF2E3] text-[#5B8C3E]'
                          : 'bg-[#FFE0E0] text-[#DC3545]'
                      }`}
                    >
                      {yurt.isOpen ? 'Open' : 'Closed'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Reservations on date */}
              <div className="bg-white rounded-xl border border-beige p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brown">{t('dayDetail.reservations')} ({selectedDateRes.length})</span>
                </div>
                {selectedDateRes.length === 0 ? (
                  <div className="text-xs text-gray-text">No reservations</div>
                ) : (
                  selectedDateRes.map((r) => (
                    <div key={r.id} className="text-xs">
                      <div className="font-medium text-brown">{r.user?.name || 'Unknown'}</div>
                      <div className="text-gray-text">{r.yurt?.name} - {r.guestCount} guests - {r.status}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Admin note */}
              <div className="bg-white rounded-xl border border-beige p-4 flex flex-col gap-3">
                <span className="text-xs font-bold text-brown">{t('dayDetail.adminNote')}</span>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="border border-beige rounded-md p-2 text-xs h-20 resize-none text-brown"
                  placeholder="Private note (e.g. overflow / extra shift needed)"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={saving}
                  className="bg-[#5B8C3E] text-white text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 self-end disabled:opacity-50"
                >
                  <Save size={12} /> {t('dayDetail.saveNote')}
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-beige p-6 flex flex-col items-center gap-3">
              <p className="text-sm text-gray-text text-center">Click a date to see details</p>
              <p className="text-xs text-gray-text text-center">Hold Shift + click to multi-select dates</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </>
  )
}
