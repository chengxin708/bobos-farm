'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import CreateReservationModal from '@/components/admin/CreateReservationModal'
import ReservationDetail from '@/components/admin/reservations/ReservationDetail'
import { type Reservation as FullReservation } from '@/components/admin/reservations/useReservationsData'
import { ChevronLeft, ChevronRight, Users, Plus } from 'lucide-react'

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
  holdByAdmin?: boolean
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

/** Status color mapping per design system */
const STATUS_COLORS: Record<string, {
  border: string; bg: string; text: string; dot: string; initBg: string
}> = {
  PENDING_PAYMENT:   { border: 'border-l-[#E67E22]', bg: 'bg-[#E67E22]/10', text: 'text-[#E67E22]', dot: 'bg-[#E67E22]', initBg: 'bg-[#E67E22]' },
  PAYMENT_SUBMITTED: { border: 'border-l-[#E67E22]', bg: 'bg-[#E67E22]/10', text: 'text-[#E67E22]', dot: 'bg-[#E67E22]', initBg: 'bg-[#E67E22]' },
  CONFIRMED:         { border: 'border-l-[#2980B9]', bg: 'bg-[#2980B9]/10', text: 'text-[#2980B9]', dot: 'bg-[#2980B9]', initBg: 'bg-[#2980B9]' },
  COMPLETED:         { border: 'border-l-[#8C8478]', bg: 'bg-[#8C8478]/10', text: 'text-[#8C8478]', dot: 'bg-[#8C8478]', initBg: 'bg-[#8C8478]' },
  CANCELLED:         { border: 'border-l-[#DC3545]', bg: 'bg-red-50',       text: 'text-red-400',    dot: 'bg-[#DC3545]', initBg: 'bg-[#DC3545]' },
  EXPIRED:           { border: 'border-l-gray-300',   bg: 'bg-gray-50',      text: 'text-gray-400',   dot: 'bg-gray-300',  initBg: 'bg-gray-300'  },
}

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

// DAY_HEADERS and MONTH_NAMES are now derived from i18n keys in the component
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const

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

/** Get initials from name or email */
function getInitials(name: string | null, email: string): string {
  const source = name || email.split('@')[0] || '?'
  return source
    .split(/[\s._-]+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

/** Get display name, truncated */
function getDisplayName(user: ReservationUser): string {
  return user.name || user.email?.split('@')[0] || '?'
}

// ── Closed-cell diagonal stripe pattern as CSS background ──────
const CLOSED_STRIPE_BG = 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 5px)'
const CLOSED_CROSSHATCH_BG = `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px), repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)`

// ── Component ──────────────────────────────────────────────────────

export default function CalendarDesktop() {
  const t = useTranslations('admin.calendar')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [view, setView] = useState<ViewMode>('month')
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [weekBase, setWeekBase] = useState(today)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<string | undefined>(undefined)
  const [createModalYurtId, setCreateModalYurtId] = useState<string | undefined>(undefined)
  const [selectedResId, setSelectedResId] = useState<string | null>(null)
  const [actionUpdating, setActionUpdating] = useState(false)

  // Fetch full detail + activity logs for selected reservation
  const { data: selectedResFull, mutate: mutateSelectedRes } = useSWR<FullReservation>(
    selectedResId ? `/api/reservations/${selectedResId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const { data: selectedResLogs } = useSWR(
    selectedResId ? `/api/activity-logs?targetId=${selectedResId}&targetType=RESERVATION` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

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

  const { data: reservations, isLoading: loadingRes, mutate: mutateReservations } = useSWR<Reservation[]>(
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

  /** Map: "YYYY-MM-DD" -> Set<yurtId> for closed */
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

  // ── Reservation actions (for detail drawer) ─────────────────
  const handleResAction = useCallback(async (id: string, action: string, data?: Record<string, unknown>): Promise<void> => {
    setActionUpdating(true)
    try {
      const body = action === 'cancel' ? { action: 'cancel' } : { ...data }
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        mutateReservations()
        mutateSelectedRes()
      }
    } catch { /* ignore */ }
    finally { setActionUpdating(false) }
  }, [mutateReservations, mutateSelectedRes])

  const confirmDeposit = useCallback((id: string) => {
    handleResAction(id, 'admin', { status: 'CONFIRMED', depositStatus: 'CONFIRMED', depositConfirmedAt: new Date().toISOString() })
  }, [handleResAction])
  const cancelReservation = useCallback((id: string) => {
    handleResAction(id, 'cancel')
  }, [handleResAction])
  const completeReservation = useCallback((id: string) => {
    handleResAction(id, 'admin', { status: 'COMPLETED' })
  }, [handleResAction])

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

  // ── Legend items (design system) ─────────────────────────────

  const legendItems = [
    { color: 'bg-[#E67E22]', label: t('legend.pending') },
    { color: 'bg-[#2980B9]', label: t('legend.confirmed') },
    { color: 'bg-[#8C8478]', label: t('legend.completed') },
    { color: 'bg-gray-400',  label: t('legend.closed') },
  ]

  // ── Render helpers ───────────────────────────────────────────

  const todayStr = formatDate(today)

  /** Collect reservations for a given date across all yurts (for month view) */
  function getDateReservations(dateStr: string): Reservation[] {
    const dayMap = resByDateYurt.get(dateStr)
    if (!dayMap) return []
    return Array.from(dayMap.values())
  }

  /** Check if any yurt is closed on this date */
  function hasClosedYurts(dateStr: string): boolean {
    return closedByDateYurt.has(dateStr) && closedByDateYurt.get(dateStr)!.size > 0
  }

  function renderMonthCell(day: number | null, idx: number) {
    if (day === null) {
      return (
        <div key={idx} className="min-h-[80px] border-b border-r border-[#E8ECE4]/60 bg-[#FAFAF7]/50" />
      )
    }

    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = dateStr === todayStr
    const dayRes = getDateReservations(dateStr)
    const closed = hasClosedYurts(dateStr)
    const maxVisible = 2
    const visibleRes = dayRes.slice(0, maxVisible)
    const remaining = dayRes.length - maxVisible

    return (
      <div
        key={idx}
        className={`
          min-h-[80px] p-2 border-b border-r border-[#E8ECE4]/60
          transition-shadow duration-150 hover:shadow-[0_1px_6px_rgba(0,0,0,0.06)] cursor-pointer group
          ${isToday ? 'bg-[#FFF8E1] border-l-2 border-l-[#6B7F5E]' : ''}
        `}
        onClick={() => { setCreateModalDate(dateStr); setCreateModalYurtId(undefined); setShowCreateModal(true) }}
        title={t('createReservation')}
      >
        {/* Date number */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className={`
            text-[13px] font-semibold
            ${isToday ? 'text-[#6B7F5E]' : 'text-[#2C2416]'}
          `}>
            {day}
          </span>
          <span className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#6B7F5E]">
            <Plus size={12} className="text-white" />
          </span>
        </div>

        {/* Yurt slot rows — show max 4, collapse rest */}
        {(() => {
          const MAX_VISIBLE = 4
          const bookedYurts = activeYurts.filter(y => {
            const r = dayRes.find(r => r.yurtId === y.id && r.status !== 'CANCELLED' && r.status !== 'EXPIRED')
            return !!r
          })
          const availableYurts = activeYurts.filter(y => {
            const isClosed = closedByDateYurt.get(dateStr)?.has(y.id)
            const r = dayRes.find(r => r.yurtId === y.id && r.status !== 'CANCELLED' && r.status !== 'EXPIRED')
            return !r && !isClosed
          })
          const totalAvailable = availableYurts.length

          // Show booked first (always), then fill remaining slots with available
          const visibleBooked = bookedYurts.slice(0, MAX_VISIBLE)
          const remainingSlots = MAX_VISIBLE - visibleBooked.length
          const visibleAvailable = availableYurts.slice(0, Math.max(0, remainingSlots))
          const hiddenCount = activeYurts.length - visibleBooked.length - visibleAvailable.length

          return (
            <div className="flex flex-col gap-px mt-1">
              {/* Booked yurts */}
              {visibleBooked.map(yurt => {
                const res = dayRes.find(r => r.yurtId === yurt.id && r.status !== 'CANCELLED' && r.status !== 'EXPIRED')!
                const initials = yurt.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
                const isHeld = res.holdByAdmin && res.status === 'PENDING_PAYMENT'
                const colors = isHeld
                  ? { bg: 'bg-[#F4A623]/15', text: 'text-[#F4A623]' }
                  : (STATUS_COLORS[res.status] || STATUS_COLORS.CONFIRMED)
                return (
                  <button
                    key={yurt.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedResId(res.id) }}
                    className={`flex items-center h-5 px-1 rounded text-[9px] cursor-pointer border-0 w-full text-left whitespace-nowrap overflow-hidden transition-all hover:brightness-90 ${colors.bg} ${colors.text}`}
                  >
                    <span className="w-5 shrink-0 font-bold text-center">{initials}</span>
                    <span className="truncate">{getDisplayName(res.user)}</span>
                    {isHeld && <span className="ml-auto shrink-0 text-[8px] font-bold uppercase">Held</span>}
                  </button>
                )
              })}

              {/* Available summary or individual slots */}
              {totalAvailable > 0 && visibleAvailable.length > 0 && (
                totalAvailable <= 2 ? (
                  // Show individual available slots if few
                  visibleAvailable.map(yurt => {
                    const initials = yurt.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <button
                        key={yurt.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCreateModalDate(dateStr)
                          setCreateModalYurtId(yurt.id)
                          setShowCreateModal(true)
                        }}
                        className="flex items-center h-5 px-1 rounded text-[9px] cursor-pointer border-0 w-full text-left whitespace-nowrap overflow-hidden bg-transparent text-[#6B7F5E]/30 hover:text-[#6B7F5E]/60 hover:bg-[#6B7F5E]/5 transition-all"
                      >
                        <span className="w-5 shrink-0 font-bold text-center text-[#6B7F5E]/40">{initials}</span>
                        <span className="text-[#6B7F5E]/30">—</span>
                      </button>
                    )
                  })
                ) : (
                  // Summarize available count if many
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCreateModalDate(dateStr)
                      setCreateModalYurtId(undefined)
                      setShowCreateModal(true)
                    }}
                    className="flex items-center h-5 px-1 rounded text-[9px] cursor-pointer border-0 w-full text-left whitespace-nowrap overflow-hidden bg-transparent text-[#6B7F5E]/50 hover:text-[#6B7F5E] hover:bg-[#6B7F5E]/5 transition-all"
                  >
                    <span className="text-[#6B7F5E]/50">+{totalAvailable} available</span>
                  </button>
                )
              )}

              {/* Hidden count */}
              {hiddenCount > 0 && (
                <span className="text-[8px] text-[#8A7E6B]/40 px-1">+{hiddenCount} more</span>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  function renderWeekView() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-[#E8ECE4]">
                <th className="w-36 px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-[#8A7E6B] border-r border-[#E8ECE4] bg-[#FAFAF7]" />
                {weekDays.map((d, i) => {
                  const dateStr = formatDate(d)
                  const isToday = dateStr === todayStr
                  return (
                    <th
                      key={i}
                      className={`
                        px-2 py-3 text-center border-r border-[#E8ECE4] last:border-r-0 bg-[#FAFAF7]
                        ${isToday ? 'border-t-2 border-t-[#6B7F5E]' : ''}
                      `}
                    >
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-[#8A7E6B]">
                        {t(`dayShort.${d.getDay()}`)}
                      </div>
                      <div className={`
                        text-lg font-semibold mt-0.5
                        ${isToday ? 'text-[#6B7F5E]' : 'text-[#2C2416]'}
                      `}>
                        {d.getDate()}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {activeYurts.map(yurt => (
                <tr key={yurt.id} className="border-b border-[#E8ECE4] last:border-b-0">
                  <td className="px-4 py-3 border-r border-[#E8ECE4] bg-[#FAFAF7]">
                    <div className="text-sm font-semibold text-[#2C2416]">{yurt.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users size={10} className="text-[#8A7E6B]" />
                      <span className="text-[10px] text-[#8A7E6B]">{yurt.capacity}</span>
                    </div>
                  </td>
                  {weekDays.map((d, i) => {
                    const dateStr = formatDate(d)
                    const isToday = dateStr === todayStr
                    const res = resByDateYurt.get(dateStr)?.get(yurt.id)
                    const isClosed = closedByDateYurt.get(dateStr)?.has(yurt.id)

                    if (isClosed && !res) {
                      return (
                        <td key={i} className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 ${isToday ? 'bg-[#FFFDF5]' : ''}`}>
                          <div
                            className="p-3 rounded-lg bg-gray-50 text-center"
                            style={{ backgroundImage: CLOSED_CROSSHATCH_BG }}
                          >
                            <div className="text-[11px] font-medium text-[#8A7E6B]">{t('status.closed')}</div>
                          </div>
                        </td>
                      )
                    }

                    if (res) {
                      const isHeld = res.holdByAdmin && res.status === 'PENDING_PAYMENT'
                      const colors = isHeld
                        ? { border: 'border-l-[#F4A623]', bg: 'bg-[#F4A623]/10', text: 'text-[#F4A623]', dot: 'bg-[#F4A623]', initBg: 'bg-[#F4A623]' }
                        : (STATUS_COLORS[res.status] || STATUS_COLORS.CONFIRMED)
                      const initials = getInitials(res.user?.name ?? null, res.user?.email ?? '')

                      return (
                        <td key={i} className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 ${isToday ? 'bg-[#FFFDF5]' : ''}`}>
                          <button
                            onClick={() => setSelectedResId(res.id)}
                            className={`
                              w-full text-left p-3 rounded-lg border-l-[3px] border-0 cursor-pointer
                              ${colors.border} ${colors.bg}
                              transition-shadow duration-150 hover:shadow-md
                              ${res.status === 'CANCELLED' ? 'line-through opacity-60' : ''}
                            `}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${colors.initBg}`}>
                                {initials}
                              </div>
                              <div className={`text-xs font-semibold ${colors.text} truncate`}>
                                {getDisplayName(res.user)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[#8A7E6B]">
                              <Users size={10} />
                              <span className="text-[11px]">{t('guests', { count: res.guestCount })}</span>
                            </div>
                            <div className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                              {isHeld ? t('status.held') : statusLabel(res.status, t)}
                            </div>
                          </button>
                        </td>
                      )
                    }

                    // Available cell — click to create reservation with date + yurt prefill
                    return (
                      <td key={i} className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 ${isToday ? 'bg-[#FFFDF5]' : ''}`}>
                        <button
                          onClick={() => {
                            setCreateModalDate(dateStr)
                            setCreateModalYurtId(yurt.id)
                            setShowCreateModal(true)
                          }}
                          className="w-full p-3 rounded-lg bg-[#5B8C3E]/5 hover:bg-[#5B8C3E]/10 transition-colors cursor-pointer text-left group/avail"
                          title={t('createReservation')}
                        >
                          <div className="text-[11px] text-[#5B8C3E] font-medium group-hover/avail:text-[#4A7A2D]">{t('status.available')}</div>
                        </button>
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
      <div className="max-w-[1400px] mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-[#8A7E6B]">{t('loading')}</p>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────

  const navLabel = useMemo(() => {
    if (view === 'month') {
      return t('navLabel.month', { month: t(`monthNames.${currentMonth}`), year: currentYear })
    }
    const startMonth = t(`monthNames.${weekRange.start.getMonth()}`)
    const startDay = weekRange.start.getDate()
    const endDay = weekRange.end.getDate()
    const year = weekRange.end.getFullYear()
    const endLabel = weekRange.start.getMonth() !== weekRange.end.getMonth()
      ? t('navLabel.endWithMonth', { endMonth: t(`monthNames.${weekRange.end.getMonth()}`), endDay })
      : String(endDay)
    return t('navLabel.weekRange', { startMonth, startDay, endLabel, year })
  }, [view, currentMonth, currentYear, weekRange, t])

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-auto min-h-0">

        {/* ── Top Controls Bar ─────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* View Toggle Pills */}
          <div className="flex">
            <button
              onClick={() => setView('month')}
              className={`
                px-5 py-1.5 text-sm font-semibold rounded-full transition-all duration-200
                ${view === 'month'
                  ? 'bg-[#6B7F5E] text-white shadow-sm'
                  : 'bg-transparent text-[#2C2416] border border-[#E8ECE4] hover:bg-[#F5F2ED]'
                }
              `}
            >
              {t('views.month')}
            </button>
            <button
              onClick={() => setView('week')}
              className={`
                px-5 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 ml-2
                ${view === 'week'
                  ? 'bg-[#6B7F5E] text-white shadow-sm'
                  : 'bg-transparent text-[#2C2416] border border-[#E8ECE4] hover:bg-[#F5F2ED]'
                }
              `}
            >
              {t('views.week')}
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={view === 'month' ? prevMonth : prevWeek}
              className="p-1.5 rounded-full hover:bg-[#E8ECE4]/50 transition-colors"
            >
              <ChevronLeft size={18} className="text-[#2C2416]" />
            </button>
            <span
              className="text-lg font-semibold text-[#2C2416] min-w-[220px] text-center"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {navLabel}
            </span>
            <button
              onClick={view === 'month' ? nextMonth : nextWeek}
              className="p-1.5 rounded-full hover:bg-[#E8ECE4]/50 transition-colors"
            >
              <ChevronRight size={18} className="text-[#2C2416]" />
            </button>
          </div>

          {/* Today link + Legend */}
          <div className="flex items-center gap-5">
            {/* Legend (inline) */}
            <div className="flex items-center gap-4">
              {legendItems.map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[11px] text-[#8A7E6B]">{l.label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={goToToday}
              className="text-sm font-semibold text-[#6B7F5E] hover:underline transition-colors"
            >
              {t('today')}
            </button>
            <button
              onClick={() => { setCreateModalDate(undefined); setCreateModalYurtId(undefined); setShowCreateModal(true) }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-[#6B7F5E] hover:bg-[#5A6E4F] transition-colors cursor-pointer"
            >
              <Plus size={14} />
              {t('createReservation')}
            </button>
          </div>
        </div>

        {/* ── Calendar Content ─────────────────────────────── */}

        {view === 'month' ? (
          <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden flex-1 flex flex-col">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-[#E8ECE4] bg-[#FAFAF7]">
              {DAY_INDICES.map(di => (
                <div key={di} className="text-center py-2.5 text-[11px] uppercase tracking-wider font-semibold text-[#8A7E6B]">
                  {t(`dayShort.${di}`)}
                </div>
              ))}
            </div>
            {/* Day Cells */}
            <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
              {monthCells.map((day, idx) => renderMonthCell(day, idx))}
            </div>
          </div>
        ) : (
          renderWeekView()
        )}

        {/* Loading indicator */}
        {loadingRes && (
          <div className="text-center text-sm text-[#8A7E6B] py-2">{t('loading')}</div>
        )}
      </div>

      {/* Reservation Detail Drawer */}
      {selectedResFull && selectedResId && (
        <div className="w-[400px] border-l border-[#E8ECE4] bg-white flex flex-col overflow-hidden shrink-0">
          <ReservationDetail
            reservation={selectedResFull}
            activityLogs={selectedResLogs}
            onClose={() => setSelectedResId(null)}
            onAction={{ confirmDeposit, cancelReservation, completeReservation }}
            isUpdating={actionUpdating}
            onOrderChanged={() => mutateReservations()}
          />
        </div>
      )}

      <CreateReservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => { mutateReservations() }}
        defaultDate={createModalDate}
        defaultYurtId={createModalYurtId}
      />
    </div>
  )
}
