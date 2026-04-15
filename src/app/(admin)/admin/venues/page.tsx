"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import AdminTopBar from '@/components/admin/AdminTopBar'
import {
  Users, AlertTriangle, X, ChevronRight,
  ChevronLeft, Save, Calendar,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface Yurt {
  id: string
  name: string
  alias?: string | null
  description: string | null
  capacity: number
  status: 'ACTIVE' | 'MAINTENANCE'
  imageUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface YurtFormData {
  name: string
  description: string
  capacity: number
  status: 'ACTIVE' | 'MAINTENANCE'
  imageUrl: string
}

interface AvailabilityEntry {
  id: string
  yurtId: string
  date: string
  isOpen: boolean
  note: string | null
  yurt: { id: string; name: string; alias?: string | null }
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
  yurt: { id: string; name: string; alias?: string | null }
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const defaultYurtForm: YurtFormData = {
  name: '',
  description: '',
  capacity: 6,
  status: 'ACTIVE',
  imageUrl: '',
}

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
  if (typeof date === 'string') return date.slice(0, 10)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ── Component ──────────────────────────────────────────────────────

export default function VenuesPage() {
  const tY = useTranslations('admin.yurts')
  const tA = useTranslations('admin.availability')
  const tV = useTranslations('admin.venues')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab state — read initial from URL
  const [activeTab, setActiveTab] = useState<'yurts' | 'availability'>(
    searchParams.get('tab') === 'availability' ? 'availability' : 'yurts'
  )

  // Redirect non-admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [sessionStatus, session, router])

  // ════════════════════════════════════════════════════════════════
  // YURTS TAB STATE
  // ════════════════════════════════════════════════════════════════

  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current) }
  }, [])

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 3000)
  }, [])

  const { data: yurts, isLoading: yurtsLoading, mutate: mutateYurts } = useSWR<Yurt[]>('/api/yurts', fetcher)

  // ════════════════════════════════════════════════════════════════
  // AVAILABILITY TAB STATE
  // ════════════════════════════════════════════════════════════════

  const now = new Date()
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [adminNote, setAdminNote] = useState('')
  const [availSaving, setAvailSaving] = useState(false)

  // Bulk range
  const [openStart, setOpenStart] = useState('')
  const [openEnd, setOpenEnd] = useState('')
  const [closeStart, setCloseStart] = useState('')
  const [closeEnd, setCloseEnd] = useState('')

  const startDate = formatDateISO(currentYear, currentMonth, 1)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const endDate = formatDateISO(currentYear, currentMonth, daysInMonth)

  const { data: availability, mutate: mutateAvailability } = useSWR<AvailabilityEntry[]>(
    `/api/availability?startDate=${startDate}&endDate=${endDate}`,
    fetcher
  )
  const { data: reservations } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${startDate}&endDate=${endDate}`,
    fetcher
  )

  const availabilityIndex = useMemo(() => {
    const idx: Record<string, Record<string, AvailabilityEntry>> = {}
    availability?.forEach(a => {
      const dateKey = toDateKey(a.date)
      if (!idx[dateKey]) idx[dateKey] = {}
      idx[dateKey][a.yurtId] = a
    })
    return idx
  }, [availability])

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

  const monthDays = getMonthDays(currentYear, currentMonth)
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  monthDays.forEach(d => cells.push(d.day))
  while (cells.length % 7 !== 0) cells.push(null)

  const todayKey = formatDateISO(now.getFullYear(), now.getMonth(), now.getDate())

  const getCellStatus = (day: number) => {
    const dateKey = formatDateISO(currentYear, currentMonth, day)
    const dateAvail = availabilityIndex[dateKey] || {}
    const yurtList = yurts || []
    const dateRes = reservationsByDate[dateKey] || []
    let openCount = 0, closedCount = 0
    yurtList.forEach(yurt => {
      const a = dateAvail[yurt.id]
      if (a && !a.isOpen) closedCount++
      else openCount++
    })
    return {
      allOpen: closedCount === 0 && openCount > 0,
      allClosed: openCount === 0 && closedCount > 0,
      hasMixed: openCount > 0 && closedCount > 0,
      hasReservations: dateRes.length > 0,
      resCount: dateRes.length,
    }
  }

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
    setSelectedDate(null); setSelectedDates(new Set())
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
    setSelectedDate(null); setSelectedDates(new Set())
  }

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

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
      const dateAvail = availabilityIndex[dateKey] || {}
      const firstEntry = Object.values(dateAvail)[0]
      setAdminNote(firstEntry?.note || '')
    }
  }, [currentYear, currentMonth, availabilityIndex])

  const handleToggleYurt = useCallback(async (yurtId: string, isOpen: boolean) => {
    if (selectedDate === null) return
    setAvailSaving(true)
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
      showSuccess(isOpen ? tA('success.yurtOpened') : tA('success.yurtClosed'))
    } catch {
      alert(tV('availability.toggleFailed'))
    } finally {
      setAvailSaving(false)
    }
  }, [selectedDate, currentYear, currentMonth, mutateAvailability, showSuccess, tA, tV])

  const handleSaveNote = useCallback(async () => {
    if (selectedDate === null || !yurts?.length) return
    setAvailSaving(true)
    try {
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
      showSuccess(tV('availability.noteSaved'))
    } catch {
      alert(tV('availability.noteFailed'))
    } finally {
      setAvailSaving(false)
    }
  }, [selectedDate, currentYear, currentMonth, yurts, adminNote, availabilityIndex, mutateAvailability, showSuccess, tV])

  const handleBulkAction = useCallback(async (isOpen: boolean, start: string, end: string) => {
    if (!start || !end) { alert(tV('availability.fillDates')); return }
    if (!isOpen && !confirm(tV('availability.confirmClose', { start, end }))) return
    setAvailSaving(true)
    try {
      const res = await fetch('/api/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, isOpen }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || tV('availability.bulkFailed'))
        return
      }
      mutateAvailability()
      showSuccess(tV('availability.bulkSuccess', { action: isOpen ? tV('availability.opened') : tV('availability.closed'), start, end }))
    } catch {
      alert(tV('availability.bulkFailed'))
    } finally {
      setAvailSaving(false)
    }
  }, [mutateAvailability, showSuccess, tV])

  const handleBatchSelected = useCallback(async (isOpen: boolean) => {
    if (selectedDates.size === 0) return
    if (!isOpen && !confirm(tV('availability.confirmBatchClose', { count: selectedDates.size }))) return
    setAvailSaving(true)
    try {
      const dates = Array.from(selectedDates).sort()
      await fetch('/api/availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: dates[0], endDate: dates[dates.length - 1], isOpen }),
      })
      mutateAvailability()
      setSelectedDates(new Set())
      showSuccess(tV('availability.batchSuccess', { count: selectedDates.size, action: isOpen ? tV('availability.opened') : tV('availability.closed') }))
    } catch {
      alert(tV('availability.batchFailed'))
    } finally {
      setAvailSaving(false)
    }
  }, [selectedDates, mutateAvailability, showSuccess, tV])

  const selectedDateKey = selectedDate !== null ? formatDateISO(currentYear, currentMonth, selectedDate) : null
  const selectedDateAvail = selectedDateKey ? (availabilityIndex[selectedDateKey] || {}) : {}
  const selectedDateRes = selectedDateKey ? (reservationsByDate[selectedDateKey] || []) : []
  const selectedDateLabel = selectedDate !== null
    ? new Date(currentYear, currentMonth, selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''

  const yurtAvailList = (yurts || []).map(yurt => {
    const entry = selectedDateAvail[yurt.id]
    const isOpen = entry ? entry.isOpen : true
    return { ...yurt, isOpen }
  })
  const openYurtCount = yurtAvailList.filter(y => y.isOpen).length

  // ── Loading state ────────────────────────────────────────────
  if (sessionStatus === 'loading') {
    return (
      <>
        <AdminTopBar title={tY('title')} />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-[#8C8478]">{tV('availability.loading')}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminTopBar title={tY('title')} />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Success Message */}
        {successMsg && (
          <div className="mx-4 md:mx-6 mt-4 bg-[#EAF2E3] border border-[#6B7F5E]/20 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/50 hover:text-[#2D5016] transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Segmented Control Tabs */}
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('yurts')}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === 'yurts'
                  ? 'bg-[#6B7F5E] text-white'
                  : 'bg-transparent text-[#8C8478] border border-[#E8ECE4]'
              }`}
            >
              {tY('title')}
            </button>
            <button
              onClick={() => setActiveTab('availability')}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === 'availability'
                  ? 'bg-[#6B7F5E] text-white'
                  : 'bg-transparent text-[#8C8478] border border-[#E8ECE4]'
              }`}
            >
              {tA('title')}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* TAB 1: YURTS MANAGEMENT                                 */}
        {/* ════════════════════════════════════════════════════════ */}
        {activeTab === 'yurts' && (
          <div className="flex-1 px-4 md:px-6 py-4 flex flex-col gap-4 overflow-auto">
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-[#3D2B1F] font-playfair">{tY('title')}</h2>
              <p className="text-sm text-[#8C8478]">{tY('subtitle')}</p>
            </div>

            {/* Loading */}
            {yurtsLoading && (
              <div className="bg-white rounded-xl border border-[#E8ECE4] p-12 text-center">
                <p className="text-[#8C8478] text-sm">{tV('loadingYurts')}</p>
              </div>
            )}

            {/* Empty state */}
            {!yurtsLoading && (!yurts || yurts.length === 0) && (
              <div className="bg-white rounded-xl border border-[#E8ECE4] p-12 text-center">
                <p className="text-[#8C8478] text-sm">{tV('noYurts')}</p>
              </div>
            )}

            {/* Yurt Cards */}
            {yurts?.map((yurt) => (
              <div key={yurt.id} className="bg-white rounded-xl border border-[#E8ECE4] p-4 md:p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[#3D2B1F] font-playfair">{yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''}</h3>
                    {yurt.description && (
                      <p className="text-sm text-[#8C8478] mt-1 max-w-[600px]">{yurt.description}</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                    yurt.status === 'ACTIVE' ? 'bg-[#EAF2E3] text-[#5B8C3E]' : 'bg-[#FEF3CD] text-[#8B6914]'
                  }`}>
                    {yurt.status === 'ACTIVE' ? tY('status.active') : tY('status.maintenance')}
                  </span>
                </div>

                {yurt.status === 'MAINTENANCE' && (
                  <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FFE082] rounded-lg px-4 py-2.5">
                    <AlertTriangle size={14} className="text-[#F4A623] shrink-0" />
                    <span className="text-xs text-[#3D2B1F]">{tV('maintenanceWarning')}</span>
                  </div>
                )}

                <div className="flex items-center gap-6 text-sm text-[#3D2B1F]">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-[#8C8478]" /> {tY('capacity')} {yurt.capacity} {tY('guests')}
                  </span>
                  {yurt.imageUrl && (
                    <span className="text-[#6B7F5E] text-xs">{tV('hasImage')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* TAB 2: AVAILABILITY SETTINGS                            */}
        {/* ════════════════════════════════════════════════════════ */}
        {activeTab === 'availability' && (
          <div className="flex-1 flex flex-col overflow-auto">
            {/* Date Range Controls Card */}
            <div className="mx-4 md:mx-6 mt-4 bg-white rounded-xl border border-[#E8ECE4] p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-4 md:gap-x-6 md:gap-y-4">
                {/* Open Range */}
                <div className="flex flex-col md:flex-row md:items-end gap-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-[#3D2B1F]">{tA('openRange')}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={openStart}
                        onChange={(e) => setOpenStart(e.target.value)}
                        className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full md:w-[150px] bg-white text-[#3D2B1F] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/40 focus:border-[#6B7F5E] transition-shadow"
                      />
                      <span className="text-[#8C8478] text-sm">-</span>
                      <input
                        type="date"
                        value={openEnd}
                        onChange={(e) => setOpenEnd(e.target.value)}
                        className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full md:w-[150px] bg-white text-[#3D2B1F] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/40 focus:border-[#6B7F5E] transition-shadow"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleBulkAction(true, openStart, openEnd)}
                    disabled={availSaving}
                    className="bg-[#6B7F5E] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#5A6E4F] transition-colors cursor-pointer"
                  >
                    {tA('openAll')}
                  </button>
                </div>

                {/* Close Range */}
                <div className="flex flex-col md:flex-row md:items-end gap-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-[#3D2B1F]">{tA('closeRange')}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={closeStart}
                        onChange={(e) => setCloseStart(e.target.value)}
                        className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full md:w-[150px] bg-white text-[#3D2B1F] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/40 focus:border-[#6B7F5E] transition-shadow"
                      />
                      <span className="text-[#8C8478] text-sm">-</span>
                      <input
                        type="date"
                        value={closeEnd}
                        onChange={(e) => setCloseEnd(e.target.value)}
                        className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full md:w-[150px] bg-white text-[#3D2B1F] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/40 focus:border-[#6B7F5E] transition-shadow"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleBulkAction(false, closeStart, closeEnd)}
                    disabled={availSaving}
                    className="bg-[#C4533A] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#A8452F] transition-colors cursor-pointer"
                  >
                    {tA('closeAll')}
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content: Calendar + Sidebar */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-5 px-4 md:px-6 py-4 md:py-5 min-h-0">
              {/* Left - Calendar */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Month Navigation + Legend */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prevMonth}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={18} className="text-[#3D2B1F]" />
                    </button>
                    <span className="text-lg font-semibold text-[#3D2B1F] font-playfair min-w-[180px] text-center">
                      {monthLabel}
                    </span>
                    <button
                      onClick={nextMonth}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={18} className="text-[#3D2B1F]" />
                    </button>
                  </div>

                  {/* Legend - hidden on mobile */}
                  <div className="hidden md:flex items-center gap-5">
                    <span className="flex items-center gap-1.5 text-xs text-[#8C8478]">
                      <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#E8ECE4]" /> {tA('legend.open')}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#8C8478]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FEE2E2]" /> {tA('legend.closed')}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#8C8478]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FEF3C7]" /> {tA('legend.limited')}
                    </span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 bg-[#FAFAF7]">
                    {DAY_HEADERS.map((d) => (
                      <div key={d} className="text-center py-2 md:py-2.5 text-[10px] md:text-[11px] font-semibold tracking-wider text-[#8C8478] uppercase">
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
                            className="min-h-[52px] md:min-h-[80px] border-t border-r border-[#E8ECE4]/60 bg-[#FAFAF7]"
                          />
                        )
                      }

                      const status = getCellStatus(day)
                      const dateKey = formatDateISO(currentYear, currentMonth, day)
                      const isSelected = day === selectedDate
                      const isMultiSelected = selectedDates.has(dateKey)
                      const isToday = dateKey === todayKey

                      let cellBg = 'bg-white'
                      if (status.allClosed) cellBg = 'bg-[#FEE2E2]'
                      else if (status.hasMixed) cellBg = 'bg-[#FEF3C7]'

                      return (
                        <div
                          key={idx}
                          onClick={(e) => handleDateClick(day, e.shiftKey)}
                          className={`
                            relative min-h-[52px] md:min-h-[80px] p-1.5 md:p-2 border-t border-r border-[#E8ECE4]/60 cursor-pointer
                            transition-all duration-150 hover:shadow-md hover:z-10
                            ${cellBg}
                            ${isSelected ? 'ring-2 ring-[#6B7F5E] ring-inset shadow-sm' : ''}
                            ${isMultiSelected ? 'ring-2 ring-[#6B7F5E] ring-inset ring-dashed' : ''}
                          `}
                          style={isMultiSelected && !isSelected ? { borderStyle: 'dashed' } : undefined}
                        >
                          {isToday && (
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#6B7F5E] rounded-r-full" />
                          )}
                          <span className={`text-[12px] md:text-[13px] font-medium ${isSelected ? 'text-[#6B7F5E]' : isToday ? 'text-[#6B7F5E] font-semibold' : 'text-[#3D2B1F]'}`}>
                            {day}
                          </span>
                          <div className="mt-0.5 md:mt-1 flex flex-col gap-0.5">
                            {status.hasReservations && (
                              <span className="text-[9px] md:text-[10px] text-[#6B7F5E] font-medium">
                                {tV('availability.resCount', { count: status.resCount })}
                              </span>
                            )}
                            {status.hasMixed && (
                              <span className="text-[9px] md:text-[10px] text-[#92710C]">{tA('legend.limited')}</span>
                            )}
                            {status.allClosed && (
                              <span className="text-[9px] md:text-[10px] text-[#C4533A]">{tA('legend.closed')}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Multi-select batch actions */}
                {selectedDates.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl px-4 md:px-5 py-3 md:py-3.5 border border-[#E8ECE4]">
                    <span className="text-sm text-[#3D2B1F] font-medium">{tV('availability.datesSelected', { count: selectedDates.size })}</span>
                    <button
                      onClick={() => handleBatchSelected(true)}
                      disabled={availSaving}
                      className="bg-[#6B7F5E] text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#5A6E4F] transition-colors cursor-pointer"
                    >
                      {tA('openAll')}
                    </button>
                    <button
                      onClick={() => handleBatchSelected(false)}
                      disabled={availSaving}
                      className="bg-[#C4533A] text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#A8452F] transition-colors cursor-pointer"
                    >
                      {tA('closeAll')}
                    </button>
                    <button
                      onClick={() => setSelectedDates(new Set())}
                      className="text-sm text-[#8C8478] hover:text-[#3D2B1F] ml-auto transition-colors cursor-pointer"
                    >
                      {tV('availability.clearSelection')}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Sidebar */}
              <div className="w-full md:w-[300px] flex flex-col gap-4 md:shrink-0">
                {selectedDate !== null ? (
                  <>
                    {/* Date Header + Yurt Toggles */}
                    <div className="bg-white rounded-xl border border-[#E8ECE4] p-4 md:p-5 flex flex-col gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-[#3D2B1F] font-playfair">
                          {selectedDateLabel}
                        </h3>
                        <p className="text-xs text-[#8C8478] mt-1">
                          {tA('legend.open')} &middot; {openYurtCount} {tA('dayDetail.remaining')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[#3D2B1F] mb-3">{tA('dayDetail.perYurtAvailability')}</h4>
                        <div className="flex flex-col gap-2.5">
                          {yurtAvailList.map((yurt) => (
                            <div key={yurt.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-2 h-2 rounded-full ${yurt.isOpen ? 'bg-[#6B7F5E]' : 'bg-[#C4533A]'}`} />
                                <span className="text-sm text-[#3D2B1F]">{yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''}</span>
                              </div>
                              <button
                                onClick={() => handleToggleYurt(yurt.id, !yurt.isOpen)}
                                disabled={availSaving}
                                className={`text-xs font-semibold px-3 py-1 rounded-md cursor-pointer disabled:opacity-50 transition-colors ${
                                  yurt.isOpen
                                    ? 'bg-[#6B7F5E] text-white hover:bg-[#5A6E4F]'
                                    : 'bg-[#C4533A] text-white hover:bg-[#A8452F]'
                                }`}
                              >
                                {yurt.isOpen ? tA('legend.open') : tA('legend.closed')}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Reservations Card */}
                    <div className="bg-white rounded-xl border border-[#E8ECE4] p-4 md:p-5 flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-[#3D2B1F]">
                        {tA('dayDetail.reservations')} ({selectedDateRes.length})
                      </h4>
                      {selectedDateRes.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-3">
                          <Calendar size={20} className="text-[#E8ECE4]" />
                          <span className="text-xs text-[#8C8478]">{tV('availability.noReservations')}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {selectedDateRes.map((r) => (
                            <div key={r.id} className="bg-[#FAFAF7] rounded-lg px-3 py-2.5">
                              <div className="text-sm font-medium text-[#3D2B1F]">{r.user?.name || 'Unknown'}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#8C8478]">
                                <span>{r.yurt?.name}{r.yurt?.alias ? ` (${r.yurt.alias})` : ''}</span>
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
                    <div className="bg-white rounded-xl border border-[#E8ECE4] p-4 md:p-5 flex flex-col gap-3">
                      <h4 className="text-xs font-semibold text-[#3D2B1F]">{tA('dayDetail.adminNote')}</h4>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        className="border border-[#E8ECE4] rounded-lg p-3 text-sm h-24 resize-none text-[#3D2B1F] placeholder:text-[#C4BDB2] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/40 focus:border-[#6B7F5E] transition-shadow"
                        placeholder={tV('availability.notePlaceholder')}
                      />
                      <button
                        onClick={handleSaveNote}
                        disabled={availSaving}
                        className="bg-[#6B7F5E] text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 self-end disabled:opacity-50 hover:bg-[#5A6E4F] transition-colors cursor-pointer"
                      >
                        <Save size={13} /> {tA('dayDetail.saveNote')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl border border-[#E8ECE4] p-8 flex flex-col items-center gap-4 mt-0 md:mt-8">
                    <div className="w-14 h-14 rounded-full bg-[#F8F7F4] flex items-center justify-center">
                      <Calendar size={24} className="text-[#C4BDB2]" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-[#8C8478]">{tV('availability.clickDateHint')}</p>
                      <p className="text-xs text-[#C4BDB2] mt-1.5">{tV('availability.shiftClickHint')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Yurt Edit/Add Modal ── */}
    </>
  )
}
