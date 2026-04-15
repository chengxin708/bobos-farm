'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import CreateReservationModal from '@/components/admin/CreateReservationModal'
import ReservationDetail from '@/components/admin/reservations/ReservationDetail'
import { type Reservation as FullReservation } from '@/components/admin/reservations/useReservationsData'
import { CalendarPlus, ChevronLeft, ChevronRight, Users, ArrowLeft, ClipboardList, AlertTriangle, ArrowLeftRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface Yurt {
  id: string
  name: string
  alias?: string | null
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
  alias?: string | null
  capacity: number
}

interface Reservation {
  id: string
  userId: string
  yurtId: string | null
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  depositAmount: number
  depositStatus: string
  holdByAdmin?: boolean
  user: ReservationUser
  yurt: ReservationYurt | null
  order?: { status: string; estimatedTotal: number | null; finalTotal: number | null } | null
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

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Get the Sunday-start week range for a given date (US convention) */
function getWeekStart(baseDate: Date): Date {
  const d = new Date(baseDate)
  const day = d.getDay() // 0=Sunday, 1=Monday, ...
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }
  return days
}

/** Calculate the week number of the month (1-based, Sunday start) */
function getWeekOfMonth(date: Date): number {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstSunday = getWeekStart(firstOfMonth)
  // If firstSunday is before the 1st, the first partial week counts as week 1
  const diff = date.getTime() - firstSunday.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
}

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

/** Get display name */
function getDisplayName(user: ReservationUser): string {
  return user.name || user.email?.split('@')[0] || '?'
}

/** Closed-cell diagonal stripe pattern */
const CLOSED_CROSSHATCH_BG = `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px), repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)`

// ── Component ──────────────────────────────────────────────────────

export default function CalendarMobile() {
  const t = useTranslations('admin.calendar')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  const [selectedDate, setSelectedDate] = useState(() => new Date(today))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createYurtId, setCreateYurtId] = useState<string | undefined>(undefined)
  const [selectedResId, setSelectedResId] = useState<string | null>(null)
  const [actionUpdating, setActionUpdating] = useState(false)
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null)

  // Fetch full detail for selected reservation
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

  // ── Week days ────────────────────────────────────────────────

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(weekStart.getDate() + 6)
    return end
  }, [weekStart])

  const dateRange = useMemo(() => ({
    start: formatDate(weekStart),
    end: formatDate(weekEnd),
  }), [weekStart, weekEnd])

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

  // ── Reservation actions (must be after SWR declarations) ────
  const handleResAction = useCallback(async (id: string, action: string, data?: Record<string, unknown>) => {
    setActionUpdating(true)
    try {
      const body = action === 'cancel' ? { action: 'cancel' } : { ...data }
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { mutateReservations(); mutateSelectedRes() }
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

  async function handleSwap(targetId: string) {
    if (!swapSourceId) return
    try {
      const resp = await fetch('/api/reservations/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationIdA: swapSourceId, reservationIdB: targetId }),
      })
      if (resp.ok) {
        mutateReservations()
        setSwapSourceId(null)
      }
    } catch {
      // ignore
    }
  }

  // ── Indexed lookups ──────────────────────────────────────────

  /** Map: "YYYY-MM-DD" -> yurtId -> Reservation (assigned, active only) */
  const resByDateYurt = useMemo(() => {
    const map = new Map<string, Map<string, Reservation>>()
    if (!reservations) return map
    for (const r of reservations) {
      if (!r.yurtId) continue
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED') continue
      const dateKey = r.date.split('T')[0]
      if (!map.has(dateKey)) map.set(dateKey, new Map())
      map.get(dateKey)!.set(r.yurtId, r)
    }
    return map
  }, [reservations])

  /** Map: "YYYY-MM-DD" -> Reservation[] (unassigned, active only) */
  const unassignedByDate = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    if (!reservations) return map
    for (const r of reservations) {
      if (r.yurtId !== null) continue
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED') continue
      const dateKey = r.date.split('T')[0]
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(r)
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

  /** Set of date strings that have any active bookings */
  const datesWithBookings = useMemo(() => {
    const set = new Set<string>()
    if (!reservations) return set
    for (const r of reservations) {
      if (r.status !== 'CANCELLED' && r.status !== 'EXPIRED') {
        set.add(r.date.split('T')[0])
      }
    }
    return set
  }, [reservations])

  /** Set of date strings that have unassigned (pending) reservations */
  const datesWithPending = useMemo(() => {
    const set = new Set<string>()
    for (const [dateKey] of unassignedByDate) {
      set.add(dateKey)
    }
    return set
  }, [unassignedByDate])

  /** Total unassigned count for the whole week */
  const weekPendingTotal = useMemo(() => {
    let count = 0
    for (const [, list] of unassignedByDate) {
      count += list.length
    }
    return count
  }, [unassignedByDate])

  const activeYurts = useMemo(() =>
    (yurts || []).filter(y => y.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder),
    [yurts]
  )

  const totalCapacity = useMemo(() =>
    activeYurts.reduce((sum, y) => sum + y.capacity, 0),
    [activeYurts]
  )

  // ── Navigation ───────────────────────────────────────────────

  const prevWeek = useCallback(() => {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }, [])

  const nextWeek = useCallback(() => {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }, [])

  // ── Selected date details ────────────────────────────────────

  const selectedDateStr = formatDate(selectedDate)

  const selectedDayReservations = useMemo(() => {
    const dayMap = resByDateYurt.get(selectedDateStr)
    if (!dayMap) return new Map<string, Reservation>()
    return dayMap
  }, [resByDateYurt, selectedDateStr])

  const selectedDayUnassigned = useMemo(() => {
    return unassignedByDate.get(selectedDateStr) || []
  }, [unassignedByDate, selectedDateStr])

  /** Capacity info for selected date */
  const selectedDayCapacity = useMemo(() => {
    if (!reservations) return { used: 0, total: totalCapacity, assignedCount: 0, unassignedCount: 0, hasAnomaly: false }
    let used = 0, assignedCount = 0, unassignedCount = 0
    for (const r of reservations) {
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED') continue
      const dateKey = r.date.split('T')[0]
      if (dateKey !== selectedDateStr) continue
      used += r.guestCount
      if (r.yurtId) {
        assignedCount++
      } else {
        unassignedCount++
      }
    }
    const hasAnomaly = used > totalCapacity
    return { used, total: totalCapacity, assignedCount, unassignedCount, hasAnomaly }
  }, [reservations, selectedDateStr, totalCapacity])

  // ── Week label ───────────────────────────────────────────────

  // Use the middle of the week to determine the month context
  const weekMidDate = useMemo(() => {
    const mid = new Date(weekStart)
    mid.setDate(mid.getDate() + 3)
    return mid
  }, [weekStart])

  const weekLabel = useMemo(() => {
    const month = t(`monthNames.${weekMidDate.getMonth()}`)
    const weekNum = getWeekOfMonth(weekMidDate)
    return t('weekLabel', { month, week: String(weekNum) })
  }, [weekMidDate, t])

  // ── Selected date heading ────────────────────────────────────

  const selectedDateHeading = useMemo(() => {
    const month = selectedDate.getMonth() + 1
    const day = selectedDate.getDate()
    const dayName = t(`dayNames.${selectedDate.getDay()}`)
    return t('dateHeading', { month, day, dayName })
  }, [selectedDate, t])

  // ── Loading state ────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <AdminTopBar title={t('title')} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-[#8A7E6B]">{t('loading')}</p>
        </div>
      </>
    )
  }

  // ── Capacity bar helpers ─────────────────────────────────────

  const { used, total, assignedCount, unassignedCount, hasAnomaly } = selectedDayCapacity
  const capacityPct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  // Status indicator for capacity header
  let statusIndicator: React.ReactNode = null
  if (assignedCount + unassignedCount > 0) {
    if (hasAnomaly) {
      statusIndicator = (
        <span className="flex items-center gap-1">
          <AlertTriangle size={12} className="text-[#C4533A]" />
          <span className="text-[11px] text-[#C4533A] font-semibold">{t('anomaly')}</span>
        </span>
      )
    } else if (unassignedCount > 0) {
      statusIndicator = (
        <span className="flex items-center gap-1">
          {Array.from({ length: Math.min(unassignedCount, 3) }).map((_, j) => (
            <span key={j} className="w-1.5 h-1.5 rounded-full bg-[#E8B730]" />
          ))}
          <span className="text-[11px] text-[#E8B730] font-semibold">{t('pendingShort')}</span>
        </span>
      )
    } else {
      statusIndicator = (
        <span className="flex items-center gap-1">
          <span className="text-[12px] text-[#4A7C59] font-bold">&#10003;</span>
          <span className="text-[11px] text-[#4A7C59] font-semibold">{t('allAssigned')}</span>
        </span>
      )
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <>
      <AdminTopBar title={t('title')} />

      <div className="flex-1 flex flex-col overflow-auto">
        {/* ── Week Selector Header ────────────────────────── */}
        <div className="bg-white border-b border-[#E8ECE4] px-4 pt-3 pb-2">
          {/* Week navigation row */}
          <div className="flex items-center justify-between mb-3">
            <div /> {/* spacer */}
            <div className="flex items-center gap-4">
            <button
              onClick={prevWeek}
              className="p-1 rounded-full hover:bg-[#E8ECE4]/50 transition-colors"
            >
              <ChevronLeft size={20} className="text-[#2C2416]" />
            </button>
            <span className="text-[15px] font-semibold text-[#2C2416]">
              {weekLabel}
            </span>
            <button
              onClick={nextWeek}
              className="p-1 rounded-full hover:bg-[#E8ECE4]/50 transition-colors"
            >
              <ChevronRight size={20} className="text-[#2C2416]" />
            </button>
            </div>
            <button
              onClick={() => { setCreateYurtId(undefined); setShowCreateModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7F5E] text-white rounded-full text-[13px] font-medium cursor-pointer"
            >
              <CalendarPlus size={14} />
              {t('createShort')}
            </button>
          </div>

          {/* Day buttons row */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((d) => {
              const dateStr = formatDate(d)
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDateStr
              const hasBookings = datesWithBookings.has(dateStr)
              const hasPending = datesWithPending.has(dateStr)

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(new Date(d))}
                  className={`
                    flex flex-col items-center py-1.5 rounded-xl transition-all duration-150
                    ${isSelected && !isToday ? 'ring-2 ring-[#6B7F5E] bg-[#6B7F5E]/5' : ''}
                    ${isToday ? 'bg-[#6B7F5E] text-white' : ''}
                    ${!isToday && !isSelected ? 'hover:bg-[#F5F2ED]' : ''}
                  `}
                >
                  <span className={`text-[11px] font-medium ${isToday ? 'text-white/80' : 'text-[#8A7E6B]'}`}>
                    {t(`dayShort.${d.getDay()}`)}
                  </span>
                  <span className={`text-[15px] font-semibold mt-0.5 ${isToday ? 'text-white' : 'text-[#2C2416]'}`}>
                    {d.getDate()}
                  </span>
                  {/* Booking dot — yellow if has pending, green if all assigned */}
                  <div className="h-1.5 mt-0.5">
                    {hasBookings && (
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isToday
                          ? 'bg-white'
                          : hasPending
                            ? 'bg-[#E8B730]'
                            : 'bg-[#6B7F5E]'
                      }`} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Week Pending Summary Banner ─────────────────── */}
        {!loadingRes && weekPendingTotal > 0 && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-[#FFF8E1] border border-[#E8B730]/30 rounded-xl px-4 py-2.5">
            <ClipboardList size={15} className="text-[#E8B730] shrink-0" />
            <span className="text-[13px] font-semibold text-[#92400E]">
              {t('weekPendingTotal', { count: weekPendingTotal })}
            </span>
            <span className="text-[11px] text-[#8A7E6B] ml-auto">
              {Array.from(unassignedByDate.entries()).map(([dateKey, list]) => {
                const d = new Date(dateKey + 'T00:00:00')
                return `${d.getMonth() + 1}/${d.getDate()}(${list.length})`
              }).join(' · ')}
            </span>
          </div>
        )}

        {/* ── Selected Date Detail ────────────────────────── */}
        <div className="flex-1 px-4 py-4">

          {/* ── Capacity Bar Header ─────────────────────── */}
          <div className="bg-white rounded-xl border border-[#E8ECE4] p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-bold text-[#2C2416]" style={{ fontFamily: 'var(--font-playfair)' }}>
                {selectedDateHeading}
              </h2>
              {statusIndicator}
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-[#8A7E6B]">
                {t('capacity')}: {used}/{total}
              </span>
              <span className="text-[13px] font-semibold text-[#2C2416]">
                {capacityPct}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-[#E8ECE4] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${capacityPct}%`,
                  backgroundColor: hasAnomaly ? '#C4533A' : '#5B8C3E',
                }}
              />
            </div>
          </div>

          {/* ── Anomaly Banner ──────────────────────────── */}
          {hasAnomaly && (
            <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3 mb-4">
              <AlertTriangle size={16} className="text-[#C4533A] shrink-0" />
              <span className="text-[13px] text-[#92400E] font-medium">{t('anomalyOverbooked')}</span>
            </div>
          )}

          {/* Loading */}
          {loadingRes && (
            <div className="text-center text-sm text-[#8A7E6B] py-8">{t('loading')}</div>
          )}

          {/* ── Pending Assignment Section (before yurt cards for visibility) ── */}
          {!loadingRes && selectedDayUnassigned.length > 0 && (
            <div className="mb-4">
              {/* Section header */}
              <div className="flex items-center gap-2 bg-[#FFF8E1] rounded-t-xl border border-[#E8ECE4] border-b-0 px-4 py-3">
                <ClipboardList size={16} className="text-[#E8B730]" />
                <span className="text-[14px] font-semibold text-[#92400E]">
                  {t('pendingCount', { count: selectedDayUnassigned.length })}
                </span>
              </div>
              {/* Unassigned reservation cards */}
              <div className="bg-[#FFF8E1]/30 rounded-b-xl border border-[#E8ECE4] border-t-0 px-3 py-3 space-y-2">
                {selectedDayUnassigned.map(res => {
                  const isHeld = res.holdByAdmin && res.status === 'PENDING_PAYMENT'
                  return (
                    <button
                      key={res.id}
                      onClick={() => setSelectedResId(res.id)}
                      className="w-full text-left bg-white rounded-lg border border-[#E8ECE4] p-3 cursor-pointer hover:border-[#E8B730]/60 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[15px] font-semibold text-[#2C2416]">
                          {getDisplayName(res.user)}
                        </span>
                        <StatusBadge
                          type="reservation"
                          status={res.status}
                          label={isHeld ? t('status.held') : statusLabel(res.status, t)}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[#8A7E6B]">
                        <Users size={13} />
                        <span className="text-[13px]">{t('guests', { count: res.guestCount })}</span>
                      </div>
                      {res.order && (
                        <div className="text-[12px] mt-0.5" style={{ color: res.order.status === 'PAID' ? '#5B8C3E' : '#E67E22' }}>
                          {res.order.status === 'DRAFT' ? '\u{1F4DD}' : res.order.status === 'PAID' ? '\u2705' : '\u{1F37D}\uFE0F'}
                          {' '}
                          {res.order.finalTotal != null
                            ? `$${res.order.finalTotal}`
                            : res.order.estimatedTotal != null
                              ? `~$${res.order.estimatedTotal}`
                              : t('orderDraft')}
                        </div>
                      )}
                      {res.specialRequests && (
                        <p className="text-[12px] text-[#8A7E6B] mt-1.5 line-clamp-2">
                          {res.specialRequests}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Swap Mode Banner ─────────────────────────── */}
          {swapSourceId && (
            <div className="flex items-center justify-between px-4 py-2 mb-3 bg-[#FFF8E1] border border-[#E8B730]/30 rounded-xl">
              <span className="text-[13px] text-[#92400E]">{t('swapSelect')}</span>
              <button
                onClick={() => setSwapSourceId(null)}
                className="text-[12px] text-[#92400E] hover:text-[#78350F] underline cursor-pointer"
              >
                {t('swapCancel')}
              </button>
            </div>
          )}

          {/* ── Yurt Cards ─────────────────────────────── */}
          {!loadingRes && activeYurts.map(yurt => {
            const res = selectedDayReservations.get(yurt.id)
            const isClosed = closedByDateYurt.get(selectedDateStr)?.has(yurt.id)
            const isHeld = res?.holdByAdmin && res?.status === 'PENDING_PAYMENT'

            // Booked yurt card
            if (res) {
              const isSwapSource = swapSourceId === res.id
              const isSwapTarget = swapSourceId && swapSourceId !== res.id && res.status !== 'CANCELLED'
              return (
                <button
                  key={yurt.id}
                  onClick={() => {
                    if (isSwapTarget) {
                      handleSwap(res.id)
                    } else {
                      setSelectedResId(res.id)
                    }
                  }}
                  className={`w-full text-left bg-white rounded-xl border mb-3 overflow-hidden cursor-pointer transition-colors ${isSwapSource ? 'border-[#8B6914] ring-2 ring-[#8B6914]' : isSwapTarget ? 'border-[#5B8C3E] ring-2 ring-dashed ring-[#5B8C3E]' : 'border-[#E8ECE4] hover:border-[#6B7F5E]/40'}`}
                >
                  {/* Yurt header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-[#FAFAF7] border-b border-[#E8ECE4]">
                    <span className="text-[13px] font-semibold text-[#6B7F5E]">
                      {yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''} ({yurt.capacity})
                    </span>
                    {res.status !== 'CANCELLED' && !swapSourceId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSwapSourceId(res.id) }}
                        className="p-1 rounded hover:bg-black/5 text-[#8A7E6B] hover:text-[#8B6914]"
                        title={t('swapRoom')}
                      >
                        <ArrowLeftRight size={14} />
                      </button>
                    )}
                  </div>
                  {/* Reservation content */}
                  <div className={`px-4 py-3 ${res.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[15px] font-semibold text-[#2C2416]">
                        {getDisplayName(res.user)}
                      </span>
                      <StatusBadge
                        type="reservation"
                        status={res.status}
                        label={isHeld ? t('status.held') : statusLabel(res.status, t)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[#8A7E6B]">
                      <Users size={13} />
                      <span className="text-[13px]">{t('guests', { count: res.guestCount })}</span>
                    </div>
                    {res.order && (
                      <div className="text-[12px] mt-0.5" style={{ color: res.order.status === 'PAID' ? '#5B8C3E' : '#E67E22' }}>
                        {res.order.status === 'DRAFT' ? '\u{1F4DD}' : res.order.status === 'PAID' ? '\u2705' : '\u{1F37D}\uFE0F'}
                        {' '}
                        {res.order.finalTotal != null
                          ? `$${res.order.finalTotal}`
                          : res.order.estimatedTotal != null
                            ? `~$${res.order.estimatedTotal}`
                            : t('orderDraft')}
                      </div>
                    )}
                    {res.specialRequests && (
                      <p className="text-[12px] text-[#8A7E6B] mt-2 line-clamp-2">
                        {res.specialRequests}
                      </p>
                    )}
                  </div>
                </button>
              )
            }

            // Closed yurt card
            if (isClosed) {
              return (
                <div
                  key={yurt.id}
                  className="bg-white rounded-xl border border-[#E8ECE4] mb-3 overflow-hidden opacity-60"
                >
                  <div className="flex items-center justify-between px-4 py-2 bg-[#FAFAF7] border-b border-[#E8ECE4]">
                    <span className="text-[13px] font-semibold text-[#8A7E6B]">
                      {yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''} ({yurt.capacity})
                    </span>
                  </div>
                  <div
                    className="px-4 py-3 text-center"
                    style={{ backgroundImage: CLOSED_CROSSHATCH_BG }}
                  >
                    <span className="text-[13px] text-[#8A7E6B]">{t('status.closed')}</span>
                  </div>
                </div>
              )
            }

            // Available yurt card — tap to create reservation with date + yurt prefill
            return (
              <button
                key={yurt.id}
                onClick={() => {
                  setCreateYurtId(yurt.id)
                  setShowCreateModal(true)
                }}
                className="w-full text-left bg-white rounded-xl border border-[#E8ECE4] mb-3 overflow-hidden hover:border-[#6B7F5E]/40 hover:bg-[#6B7F5E]/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-[#FAFAF7] border-b border-[#E8ECE4]">
                  <span className="text-[13px] font-semibold text-[#6B7F5E]">
                    {yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''} ({yurt.capacity})
                  </span>
                </div>
                <div className="px-4 py-3">
                  <span className="text-[13px] text-[#5B8C3E]">{t('available')} — {t('clickToBook')}</span>
                </div>
              </button>
            )
          })}

          {/* Empty state */}
          {!loadingRes && activeYurts.length === 0 && (
            <div className="text-center text-sm text-[#8A7E6B] py-8">
              {t('noData')}
            </div>
          )}
        </div>
      </div>

      <CreateReservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        defaultDate={selectedDateStr}
        defaultYurtId={createYurtId}
        onCreated={() => {
          setShowCreateModal(false)
          mutateReservations()
        }}
      />

      {/* Full-screen reservation detail overlay */}
      {selectedResFull && selectedResId && (
        <div className="fixed inset-0 z-50 bg-[#F8F7F4] flex flex-col">
          <header className="h-11 flex items-center px-4 shrink-0 border-b border-[#E8ECE4] bg-white">
            <button
              onClick={() => setSelectedResId(null)}
              className="flex items-center gap-1 text-sm text-[#6B7F5E] font-medium bg-transparent border-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
              {t('back')}
            </button>
          </header>
          <div className="flex-1 overflow-y-auto">
            <ReservationDetail
              reservation={selectedResFull}
              activityLogs={selectedResLogs}
              onClose={() => setSelectedResId(null)}
              onAction={{ confirmDeposit, cancelReservation, completeReservation }}
              isUpdating={actionUpdating}
              onOrderChanged={() => mutateReservations()}
            />
          </div>
        </div>
      )}
    </>
  )
}
