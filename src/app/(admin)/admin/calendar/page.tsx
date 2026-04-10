"use client"

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week'

interface Yurt {
  id: string
  name: string
  capacity: number
  status: string
  sortOrder: number
}

interface ReservationUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

interface ReservationYurt {
  id: string
  name: string
  capacity: number
}

interface Reservation {
  id: string
  userId: string
  yurtId: string
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  depositAmount: number
  depositStatus: string
  user: ReservationUser
  yurt: ReservationYurt
}

interface AvailabilityEntry {
  id: string
  yurtId: string
  date: string
  isOpen: boolean
  note: string | null
  yurt: { id: string; name: string }
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

/** Status color mapping - border + bg + text */
const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  PENDING_PAYMENT:   { border: 'border-l-[#F4A623]', bg: 'bg-[#F4A623]/10', text: 'text-[#F4A623]' },
  PAYMENT_SUBMITTED: { border: 'border-l-[#E67E22]', bg: 'bg-[#E67E22]/10', text: 'text-[#E67E22]' },
  CONFIRMED:         { border: 'border-l-[#2980B9]', bg: 'bg-[#2980B9]/10', text: 'text-[#2980B9]' },
  COMPLETED:         { border: 'border-l-gray-400',   bg: 'bg-gray-100',     text: 'text-gray-500' },
  CANCELLED:         { border: 'border-l-[#DC3545]', bg: 'bg-[#DC3545]/10', text: 'text-[#DC3545]' },
  EXPIRED:           { border: 'border-l-gray-300',   bg: 'bg-gray-50',      text: 'text-gray-400' },
}

const AVAILABLE_COLORS = { border: 'border-l-[#5B8C3E]', bg: 'bg-[#5B8C3E]/10', text: 'text-[#5B8C3E]' }
const CLOSED_COLORS = { bg: 'bg-gray-100', text: 'text-gray-400' }

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start: formatDate(start), end: formatDate(end) }
}

function getWeekRange(baseDate: Date): { start: Date; end: Date } {
  const day = baseDate.getDay()
  const diff = baseDate.getDate() - day // Sunday start
  const start = new Date(baseDate)
  start.setDate(diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function statusLabel(status: string, t: ReturnType<typeof useTranslations>): string {
  const key = ({
    PENDING_PAYMENT: 'pendingPayment',
    PAYMENT_SUBMITTED: 'paymentSubmitted',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
  } as Record<string, string>)[status]
  return key ? t(`status.${key}`) : status
}

// ── Component ──────────────────────────────────────────────────────

export default function Calendar() {
  const t = useTranslations('admin.calendar')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [view, setView] = useState<ViewMode>('month')
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [weekBase, setWeekBase] = useState(today)

  // Redirect non-admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [sessionStatus, session, router])

  // ── Date ranges ──────────────────────────────────────────────

  const monthRange = useMemo(() => getMonthRange(currentYear, currentMonth), [currentYear, currentMonth])
  const weekRange = useMemo(() => getWeekRange(weekBase), [weekBase])

  const dateRange = view === 'month'
    ? { start: monthRange.start, end: monthRange.end }
    : { start: formatDate(weekRange.start), end: formatDate(weekRange.end) }

  // ── Data fetching ────────────────────────────────────────────

  const { data: yurts } = useSWR<Yurt[]>('/api/yurts', fetcher)

  const { data: reservations, isLoading: loadingRes } = useSWR<Reservation[]>(
    `/api/reservations?startDate=${dateRange.start}&endDate=${dateRange.end}`,
    fetcher
  )

  const { data: availability } = useSWR<AvailabilityEntry[]>(
    `/api/availability?startDate=${dateRange.start}&endDate=${dateRange.end}`,
    fetcher
  )

  // ── Indexed lookups ──────────────────────────────────────────

  /** Map: "YYYY-MM-DD" -> yurtId -> Reservation */
  const resByDateYurt = useMemo(() => {
    const map = new Map<string, Map<string, Reservation>>()
    if (!reservations) return map
    for (const r of reservations) {
      const dateKey = r.date.split('T')[0]
      if (!map.has(dateKey)) map.set(dateKey, new Map())
      map.get(dateKey)!.set(r.yurtId, r)
    }
    return map
  }, [reservations])

  /** Map: "YYYY-MM-DD" -> yurtId -> AvailabilityEntry */
  const closedByDateYurt = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!availability) return map
    for (const a of availability) {
      if (!a.isOpen) {
        const dateKey = a.date.split('T')[0]
        if (!map.has(dateKey)) map.set(dateKey, new Set())
        map.get(dateKey)!.add(a.yurtId)
      }
    }
    return map
  }, [availability])

  const activeYurts = useMemo(() =>
    (yurts || []).filter(y => y.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder),
    [yurts]
  )

  // ── Navigation ───────────────────────────────────────────────

  const goToToday = useCallback(() => {
    const now = new Date()
    setCurrentYear(now.getFullYear())
    setCurrentMonth(now.getMonth())
    setWeekBase(now)
  }, [])

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => {
      if (prev === 0) { setCurrentYear(y => y - 1); return 11 }
      return prev - 1
    })
  }, [])

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => {
      if (prev === 11) { setCurrentYear(y => y + 1); return 0 }
      return prev + 1
    })
  }, [])

  const prevWeek = useCallback(() => {
    setWeekBase(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }, [])

  const nextWeek = useCallback(() => {
    setWeekBase(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }, [])

  // ── Month grid cells ─────────────────────────────────────────

  const monthCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [currentYear, currentMonth])

  // ── Week view days ───────────────────────────────────────────

  const weekDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekRange.start)
      d.setDate(weekRange.start.getDate() + i)
      days.push(d)
    }
    return days
  }, [weekRange])

  // ── Legend items ──────────────────────────────────────────────

  const legendItems = [
    { color: 'bg-[#5B8C3E]', label: t('legend.available') },
    { color: 'bg-[#F4A623]', label: t('legend.pending') },
    { color: 'bg-[#E67E22]', label: t('legend.pendingConfirm') },
    { color: 'bg-[#2980B9]', label: t('legend.confirmed') },
    { color: 'bg-gray-400', label: t('legend.completed') },
    { color: 'bg-[#DC3545]', label: t('legend.cancelled') },
    { color: 'bg-gray-300', label: t('legend.closed') },
  ]

  // ── Render helpers ───────────────────────────────────────────

  const todayStr = formatDate(today)

  function renderMonthCell(day: number | null, idx: number) {
    if (day === null) {
      return (
        <div key={idx} className="min-h-[110px] p-1.5 border-b border-r border-beige/50 bg-gray-50/30" />
      )
    }

    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayReservations = resByDateYurt.get(dateStr)
    const dayClosed = closedByDateYurt.get(dateStr)
    const isToday = dateStr === todayStr

    return (
      <div key={idx} className={`min-h-[110px] p-1.5 border-b border-r border-beige/50 ${isToday ? 'bg-amber/5' : ''}`}>
        <div className="flex items-center gap-1 mb-1">
          <span className={`text-xs font-semibold ${isToday ? 'bg-amber text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-brown'}`}>
            {day}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {activeYurts.map(yurt => {
            const res = dayReservations?.get(yurt.id)
            const isClosed = dayClosed?.has(yurt.id)

            if (isClosed && !res) {
              return (
                <div key={yurt.id} className={`text-[10px] px-1 py-0.5 rounded ${CLOSED_COLORS.bg} ${CLOSED_COLORS.text} truncate`}
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)' }}
                >
                  {yurt.name.split(' ')[0]}
                </div>
              )
            }

            if (res) {
              const colors = STATUS_COLORS[res.status] || STATUS_COLORS.CONFIRMED
              return (
                <div key={yurt.id}
                  className={`text-[10px] px-1 py-0.5 rounded border-l-2 ${colors.border} ${colors.bg} ${colors.text} truncate ${res.status === 'CANCELLED' ? 'line-through' : ''}`}
                >
                  {res.user?.name || res.user?.email?.split('@')[0] || yurt.name.split(' ')[0]}
                </div>
              )
            }

            // Available
            return (
              <div key={yurt.id} className={`text-[10px] px-1 py-0.5 rounded border-l-2 ${AVAILABLE_COLORS.border} ${AVAILABLE_COLORS.bg} ${AVAILABLE_COLORS.text} truncate`}>
                {yurt.name.split(' ')[0]}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderWeekView() {
    return (
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        {/* Yurt row headers + grid */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-beige">
                <th className="w-32 px-3 py-3 text-left text-xs font-semibold text-gray-text border-r border-beige" />
                {weekDays.map((d, i) => {
                  const dateStr = formatDate(d)
                  const isToday = dateStr === todayStr
                  return (
                    <th key={i} className="px-2 py-3 text-center border-r border-beige last:border-r-0">
                      <div className="text-xs font-semibold text-gray-text">{DAY_HEADERS[d.getDay()]}</div>
                      <div className={`text-lg font-bold ${isToday ? 'bg-amber text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-brown'}`}>
                        {d.getDate()}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {activeYurts.map(yurt => (
                <tr key={yurt.id} className="border-b border-beige last:border-b-0">
                  <td className="px-3 py-3 border-r border-beige">
                    <div className="text-sm font-semibold text-brown">{yurt.name}</div>
                    <div className="text-[10px] text-gray-text">{yurt.capacity} guests max</div>
                  </td>
                  {weekDays.map((d, i) => {
                    const dateStr = formatDate(d)
                    const res = resByDateYurt.get(dateStr)?.get(yurt.id)
                    const isClosed = closedByDateYurt.get(dateStr)?.has(yurt.id)

                    if (isClosed && !res) {
                      return (
                        <td key={i} className="px-2 py-2 border-r border-beige last:border-r-0">
                          <div className={`p-2 rounded-lg ${CLOSED_COLORS.bg} text-center`}
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)' }}
                          >
                            <div className={`text-xs font-medium ${CLOSED_COLORS.text}`}>{t('status.closed')}</div>
                          </div>
                        </td>
                      )
                    }

                    if (res) {
                      const colors = STATUS_COLORS[res.status] || STATUS_COLORS.CONFIRMED
                      const initials = (res.user?.name || res.user?.email || '?')
                        .split(' ')
                        .map(w => w[0]?.toUpperCase())
                        .slice(0, 2)
                        .join('')

                      return (
                        <td key={i} className="px-2 py-2 border-r border-beige last:border-r-0">
                          <div className={`p-2 rounded-lg border-l-2 ${colors.border} ${colors.bg} ${res.status === 'CANCELLED' ? 'line-through opacity-60' : ''}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                res.status === 'CONFIRMED' ? 'bg-[#2980B9]' :
                                res.status === 'PAYMENT_SUBMITTED' ? 'bg-[#E67E22]' :
                                res.status === 'COMPLETED' ? 'bg-gray-400' :
                                res.status === 'CANCELLED' ? 'bg-[#DC3545]' :
                                'bg-[#F4A623]'
                              }`}>
                                {initials}
                              </div>
                              <div className={`text-xs font-semibold ${colors.text} truncate`}>
                                {res.user?.name || res.user?.email?.split('@')[0]}
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-text">
                              {t('guests', { count: res.guestCount })}
                            </div>
                            <div className={`text-[10px] font-medium mt-0.5 ${colors.text}`}>
                              {statusLabel(res.status, t)}
                            </div>
                          </div>
                        </td>
                      )
                    }

                    // Available
                    return (
                      <td key={i} className="px-2 py-2 border-r border-beige last:border-r-0">
                        <div className="p-2 rounded-lg bg-[#5B8C3E]/5">
                          <div className="text-[10px] text-[#5B8C3E] font-medium">{t('status.available')}</div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Loading state ────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <TopBar title={t('title')} />
        <div className="flex-1 p-6 flex items-center justify-center bg-cream-bg">
          <p className="text-gray-text">{t('loading')}</p>
        </div>
      </>
    )
  }

  // ── Main render ──────────────────────────────────────────────

  const navLabel = view === 'month'
    ? `${MONTH_NAMES[currentMonth]} ${currentYear}`
    : `${MONTH_NAMES[weekRange.start.getMonth()]} ${weekRange.start.getDate()} - ${weekRange.start.getMonth() !== weekRange.end.getMonth() ? MONTH_NAMES[weekRange.end.getMonth()] + ' ' : ''}${weekRange.end.getDate()}, ${weekRange.end.getFullYear()}`

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-4 bg-cream-bg overflow-auto">
        {/* View Toggle + Navigation */}
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
            <button onClick={view === 'month' ? prevMonth : prevWeek} className="p-1 hover:bg-beige/30 rounded">
              <ChevronLeft size={18} className="text-brown" />
            </button>
            <span className="text-base font-bold text-brown min-w-[200px] text-center">{navLabel}</span>
            <button onClick={view === 'month' ? nextMonth : nextWeek} className="p-1 hover:bg-beige/30 rounded">
              <ChevronRight size={18} className="text-brown" />
            </button>
          </div>
          <button onClick={goToToday} className="text-sm font-semibold text-amber hover:underline">
            {t('today')}
          </button>
        </div>

        {view === 'month' ? (
          <>
            {/* Month Grid */}
            <div className="bg-white rounded-xl border border-beige overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-beige">
                {DAY_HEADERS.map((d) => (
                  <div key={d} className="text-center py-2 text-xs font-semibold text-gray-text">
                    {d}
                  </div>
                ))}
              </div>
              {/* Day Cells */}
              <div className="grid grid-cols-7">
                {monthCells.map((day, idx) => renderMonthCell(day, idx))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 flex-wrap">
              {legendItems.map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-xs text-gray-text">{l.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {renderWeekView()}
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 flex-wrap">
              {legendItems.map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-xs text-gray-text">{l.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Loading indicator overlay */}
        {loadingRes && (
          <div className="text-center text-sm text-gray-text">{t('loading')}</div>
        )}
      </div>
    </>
  )
}
