'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import CreateReservationModal from '@/components/admin/CreateReservationModal'
import ReservationDetail from '@/components/admin/reservations/ReservationDetail'
import { type Reservation as FullReservation } from '@/components/admin/reservations/useReservationsData'
import { ChevronLeft, ChevronRight, Users, Plus, ClipboardList, AlertTriangle, ArrowLeftRight, Lightbulb, FileText, CheckCircle, UtensilsCrossed } from 'lucide-react'
import { computeOptimizationSuggestion } from '@/lib/yurt-assignment-pure'

// ── Types ──────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week'

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

interface CalendarSummaryEntry {
  totalGuests: number
  totalCapacity: number
  reservationCount: number
  assignedCount: number
  unassignedCount: number
  hasAnomaly: boolean
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
const CLOSED_CROSSHATCH_BG = `repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px), repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)`

/** Format money with 2 decimal places */
const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Component ──────────────────────────────────────────────────────

export default function CalendarDesktop() {
  const t = useTranslations('admin.calendar')
  const tc = useTranslations('admin.common')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [view, setView] = useState<ViewMode>('week')
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [weekBase, setWeekBase] = useState(today)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createModalDate, setCreateModalDate] = useState<string | undefined>(undefined)
  const [createModalYurtId, setCreateModalYurtId] = useState<string | undefined>(undefined)
  const [selectedResId, setSelectedResId] = useState<string | null>(null)
  const [actionUpdating, setActionUpdating] = useState(false)
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapSuccess, setSwapSuccess] = useState(false)

  // Fetch full detail + activity logs for selected reservation
  const { data: selectedResFull, mutate: mutateSelectedRes } = useSWR<FullReservation>(
    selectedResId ? `/api/reservations/${selectedResId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const { data: selectedResLogs, mutate: mutateSelectedResLogs } = useSWR(
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

  // Esc key to exit swap mode
  useEffect(() => {
    if (!swapSourceId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSwapSourceId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [swapSourceId])

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

  // Calendar summary for month view (capacity, assignment status)
  const { data: calendarSummary } = useSWR<Record<string, CalendarSummaryEntry>>(
    view === 'month'
      ? `/api/calendar-summary?startDate=${dateRange.start}&endDate=${dateRange.end}`
      : null,
    fetcher
  )

  // ── Indexed lookups ──────────────────────────────────────────

  /** Map: "YYYY-MM-DD" -> yurtId -> Reservation[] (assigned) */
  const resByDateYurt = useMemo(() => {
    const map = new Map<string, Map<string, Reservation[]>>()
    if (!reservations) return map
    for (const r of reservations) {
      if (!r.yurtId) continue
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED') continue
      const dateKey = r.date.split('T')[0]
      if (!map.has(dateKey)) map.set(dateKey, new Map())
      const yurtMap = map.get(dateKey)!
      if (!yurtMap.has(r.yurtId)) yurtMap.set(r.yurtId, [])
      yurtMap.get(r.yurtId)!.push(r)
    }
    return map
  }, [reservations])

  /** Map: "YYYY-MM-DD" -> Reservation[] (unassigned / pending) */
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

  /** Per-date capacity summary (for week view footer) */
  const weekCapacity = useMemo(() => {
    if (!reservations || !yurts) return new Map<string, { used: number; total: number; assignedCount: number; unassignedCount: number; hasAnomaly: boolean }>()
    const activeTotal = (yurts || []).filter(y => y.status === 'ACTIVE').reduce((sum, y) => sum + y.capacity, 0)
    const map = new Map<string, { used: number; total: number; assignedCount: number; unassignedCount: number; hasAnomaly: boolean }>()

    for (const r of reservations) {
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED') continue
      const dateKey = r.date.split('T')[0]
      if (!map.has(dateKey)) {
        map.set(dateKey, { used: 0, total: activeTotal, assignedCount: 0, unassignedCount: 0, hasAnomaly: false })
      }
      const entry = map.get(dateKey)!
      entry.used += r.guestCount
      if (r.yurtId) {
        entry.assignedCount++
      } else {
        entry.unassignedCount++
      }
    }
    return map
  }, [reservations, yurts])

  /** Per-date optimization suggestions */
  const optimizationByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeOptimizationSuggestion>>()
    if (!reservations || !yurts) return map
    const activeYurtInputs = yurts.filter(y => y.status === 'ACTIVE').map(y => ({
      id: y.id, name: y.name, capacity: y.capacity,
    }))

    // Group assigned reservations by date
    const byDate = new Map<string, { reservationId: string; yurtId: string; guestCount: number }[]>()
    for (const r of reservations) {
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED' || !r.yurtId) continue
      const dateKey = r.date.split('T')[0]
      if (!byDate.has(dateKey)) byDate.set(dateKey, [])
      byDate.get(dateKey)!.push({ reservationId: r.id, yurtId: r.yurtId, guestCount: r.guestCount })
    }

    for (const [dateKey, assignments] of byDate) {
      if (assignments.length < 2) continue
      const suggestion = computeOptimizationSuggestion(activeYurtInputs, assignments)
      if (suggestion) map.set(dateKey, suggestion)
    }
    return map
  }, [reservations, yurts])

  const [suggestionLoading, setSuggestionLoading] = useState(false)

  async function handleApplySuggestion(dateStr: string) {
    const suggestion = optimizationByDate.get(dateStr)
    if (!suggestion || suggestionLoading) return
    if (!confirm(t('optimizationConfirm'))) return
    setSuggestionLoading(true)
    try {
      for (const move of suggestion.moves) {
        const res = await fetch(`/api/reservations/${move.reservationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assign_yurt', yurtId: move.toYurtId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: t('unknownError') }))
          alert(err.error || t('optimizationError'))
          return
        }
      }
      mutateReservations()
    } catch {
      alert(t('optimizationNetworkError'))
    } finally {
      setSuggestionLoading(false)
    }
  }

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
        mutateSelectedResLogs()
      }
    } catch { /* ignore */ }
    finally { setActionUpdating(false) }
  }, [mutateReservations, mutateSelectedRes, mutateSelectedResLogs])

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

  const totalCapacity = useMemo(() =>
    activeYurts.reduce((sum, y) => sum + y.capacity, 0),
    [activeYurts]
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

  /** Switch to week view for a specific date (used from month view click) */
  const goToWeekOf = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    setWeekBase(d)
    setView('week')
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

  /** Derive the date of the swap source reservation */
  const swapSourceDate = useMemo(() => {
    if (!swapSourceId || !reservations) return null
    const src = reservations.find(r => r.id === swapSourceId)
    return src ? src.date.split('T')[0] : null
  }, [swapSourceId, reservations])

  async function handleSwap(targetId: string) {
    if (!swapSourceId || swapLoading) return

    // Capacity warning before swap
    const sourceRes = reservations?.find(r => r.id === swapSourceId)
    const targetRes = reservations?.find(r => r.id === targetId)
    if (sourceRes && targetRes && sourceRes.yurt && targetRes.yurt) {
      const warnings: string[] = []
      if (sourceRes.guestCount > targetRes.yurt.capacity) {
        warnings.push(t('swapWarningLine', { guest: sourceRes.user?.name || sourceRes.user?.email, count: sourceRes.guestCount, room: `${targetRes.yurt.name}${targetRes.yurt.alias ? ` (${targetRes.yurt.alias})` : ''}`, capacity: targetRes.yurt.capacity }))
      }
      if (targetRes.guestCount > sourceRes.yurt.capacity) {
        warnings.push(t('swapWarningLine', { guest: targetRes.user?.name || targetRes.user?.email, count: targetRes.guestCount, room: `${sourceRes.yurt.name}${sourceRes.yurt.alias ? ` (${sourceRes.yurt.alias})` : ''}`, capacity: sourceRes.yurt.capacity }))
      }
      if (warnings.length > 0 && !confirm(`⚠️ ${t('swapCapacityWarning')}:\n${warnings.join('\n')}\n\n${t('swapCapacityConfirm')}`)) {
        return
      }
    }

    setSwapLoading(true)
    try {
      const resp = await fetch('/api/reservations/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationIdA: swapSourceId, reservationIdB: targetId }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: t('unknownError') }))
        alert(err.error || t('swapError'))
        return
      }
      mutateReservations()
      setSwapSourceId(null)
      setSwapSuccess(true)
      setTimeout(() => setSwapSuccess(false), 2000)
    } catch {
      alert(t('swapNetworkError'))
    } finally {
      setSwapLoading(false)
    }
  }

  /** Count of assigned (non-cancelled) reservations per date */
  const assignedCountByDate = useMemo(() => {
    const map = new Map<string, number>()
    if (!reservations) return map
    for (const r of reservations) {
      if (!r.yurtId) continue
      if (r.status === 'CANCELLED' || r.status === 'EXPIRED') continue
      const dateKey = r.date.split('T')[0]
      map.set(dateKey, (map.get(dateKey) || 0) + 1)
    }
    return map
  }, [reservations])

  /** Render a compact reservation card for week view cells */
  function renderReservationCard(res: Reservation) {
    const isHeld = res.holdByAdmin && res.status === 'PENDING_PAYMENT'
    const colors = isHeld
      ? { border: 'border-l-[#F4A623]', bg: 'bg-[#F4A623]/10', text: 'text-[#F4A623]', dot: 'bg-[#F4A623]', initBg: 'bg-[#F4A623]' }
      : (STATUS_COLORS[res.status] || STATUS_COLORS.CONFIRMED)
    const initials = getInitials(res.user?.name ?? null, res.user?.email ?? '')
    const isSwapSource = swapSourceId === res.id
    const resDate = res.date.split('T')[0]
    const isSwapTarget = swapSourceId && swapSourceId !== res.id && res.yurtId && res.status !== 'CANCELLED' && resDate === swapSourceDate

    return (
      <button
        key={res.id}
        disabled={swapLoading && !!isSwapTarget}
        onClick={(e) => {
          e.stopPropagation()
          if (isSwapSource) {
            setSwapSourceId(null)
          } else if (isSwapTarget && !swapLoading) {
            handleSwap(res.id)
          } else if (!swapSourceId) {
            setSelectedResId(res.id)
          }
        }}
        className={`
          w-full text-left p-2 rounded-lg border-l-[3px] border-0 cursor-pointer
          ${colors.border} ${colors.bg}
          transition-shadow duration-150 hover:shadow-md
          ${res.status === 'CANCELLED' ? 'line-through opacity-60' : ''}
          ${isSwapSource ? 'ring-2 ring-[#8B6914]' : ''}
          ${isSwapTarget ? 'ring-2 ring-dashed ring-[#5B8C3E] hover:ring-[#5B8C3E]' : ''}
        `}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${colors.initBg}`}>
            {initials}
          </div>
          <div className={`text-[11px] font-semibold ${colors.text} truncate flex-1`}>
            {getDisplayName(res.user)}
          </div>
          {res.yurtId && res.status !== 'CANCELLED' && !swapSourceId && (assignedCountByDate.get(resDate) ?? 0) >= 2 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSwapSourceId(res.id) }}
              className="p-1 rounded hover:bg-black/5 text-[#8A7E6B] hover:text-[#8B6914]"
              title={t('swapRoom')}
            >
              <ArrowLeftRight size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 text-[#8A7E6B]">
            <Users size={9} />
            <span className="text-[10px]">{res.guestCount}</span>
          </div>
          <div className={`text-[9px] font-medium px-1.5 py-px rounded-full ${colors.bg} ${colors.text}`}>
            {isHeld ? t('status.held') : statusLabel(res.status, t)}
          </div>
        </div>
        {res.order && (
          <div className="flex items-center gap-0.5 text-[10px] mt-0.5" style={{ color: res.order.status === 'PAID' ? '#5B8C3E' : '#E67E22' }}>
            {res.order.status === 'DRAFT' ? <FileText size={10} className="inline shrink-0" /> : res.order.status === 'PAID' ? <CheckCircle size={10} className="inline shrink-0" /> : <UtensilsCrossed size={10} className="inline shrink-0" />}
            {' '}
            {res.order.finalTotal != null
              ? `$${fmtMoney(res.order.finalTotal)}`
              : res.order.estimatedTotal != null
                ? `~$${fmtMoney(res.order.estimatedTotal)}`
                : t('orderDraft')}
          </div>
        )}
      </button>
    )
  }

  /** Render the week view tape chart */
  function renderWeekView() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
        {swapSourceId && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#FFF8E1] border-b border-[#E8B730]/30">
            <span className="text-[12px] text-[#92400E]">{t('swapSelect')}</span>
            <button
              onClick={() => setSwapSourceId(null)}
              className="text-[11px] text-[#92400E] hover:text-[#78350F] underline cursor-pointer"
            >
              {t('swapCancel')}
            </button>
          </div>
        )}
        {swapSuccess && (
          <div className="flex items-center justify-center px-4 py-2 bg-[#5B8C3E]/10 border-b border-[#5B8C3E]/30 text-[12px] text-[#5B8C3E]">
            ✓ {t('swapSuccess')}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            {/* ── Header row ── */}
            <thead>
              <tr className="border-b border-[#E8ECE4]">
                <th className="w-40 px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-[#8A7E6B] border-r border-[#E8ECE4] bg-[#FAFAF7]" />
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
              {/* ── Yurt rows ── */}
              {activeYurts.map(yurt => (
                <tr key={yurt.id} className="border-b border-[#E8ECE4]">
                  {/* Yurt label */}
                  <td className="px-4 py-3 border-r border-[#E8ECE4] bg-[#FAFAF7]">
                    <div className="text-sm font-semibold text-[#2C2416]">{yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users size={10} className="text-[#8A7E6B]" />
                      <span className="text-[10px] text-[#8A7E6B]">{yurt.capacity}</span>
                    </div>
                  </td>
                  {/* Day cells for this yurt */}
                  {weekDays.map((d, i) => {
                    const dateStr = formatDate(d)
                    const isToday = dateStr === todayStr
                    const yurtReservations = resByDateYurt.get(dateStr)?.get(yurt.id) || []
                    const isClosed = closedByDateYurt.get(dateStr)?.has(yurt.id)

                    // Closed cell
                    if (isClosed && yurtReservations.length === 0) {
                      return (
                        <td key={i} className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 align-top ${isToday ? 'bg-[#FFFDF5]' : ''}`}>
                          <div
                            className="p-3 rounded-lg bg-gray-50 text-center"
                            style={{ backgroundImage: CLOSED_CROSSHATCH_BG }}
                          >
                            <div className="text-[11px] font-medium text-[#8A7E6B]">{t('status.closed')}</div>
                          </div>
                        </td>
                      )
                    }

                    // Cell with reservation(s)
                    if (yurtReservations.length > 0) {
                      return (
                        <td key={i} className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 align-top ${isToday ? 'bg-[#FFFDF5]' : ''}`}>
                          <div className="flex flex-col gap-1.5">
                            {yurtReservations.map(res => renderReservationCard(res))}
                          </div>
                        </td>
                      )
                    }

                    // Available cell — click to create reservation with date + yurt prefill
                    return (
                      <td key={i} className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 align-top ${isToday ? 'bg-[#FFFDF5]' : ''}`}>
                        <button
                          onClick={() => {
                            setCreateModalDate(dateStr)
                            setCreateModalYurtId(yurt.id)
                            setShowCreateModal(true)
                          }}
                          className="w-full p-3 rounded-lg bg-[#5B8C3E]/5 hover:bg-[#5B8C3E]/10 transition-colors cursor-pointer text-left group/avail"
                          title={t('createReservation')}
                        >
                          <div className="text-[11px] text-[#5B8C3E] font-medium opacity-0 group-hover/avail:opacity-100 transition-opacity">{t('status.available')}</div>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* ── Pending (unassigned) row ── */}
              <tr className="border-b border-[#E8ECE4]">
                <td className="px-4 py-3 border-r border-[#E8ECE4] bg-[#FFF8E1]">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList size={14} className="text-[#E8B730]" />
                    <span className="text-sm font-semibold text-[#2C2416]">{t('pendingAssignment')}</span>
                  </div>
                  <div className="text-[10px] text-[#8A7E6B] mt-0.5">{tc('unassigned')}</div>
                </td>
                {weekDays.map((d, i) => {
                  const dateStr = formatDate(d)
                  const isToday = dateStr === todayStr
                  const pending = unassignedByDate.get(dateStr) || []

                  return (
                    <td
                      key={i}
                      className={`px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 align-top ${isToday ? 'bg-[#FFFBEB]' : 'bg-[#FFF8E1]/30'}`}
                    >
                      {pending.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {pending.map(res => renderReservationCard(res))}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setCreateModalDate(dateStr)
                            setCreateModalYurtId(undefined)
                            setShowCreateModal(true)
                          }}
                          className="w-full p-2 rounded-lg hover:bg-[#E8B730]/10 transition-colors cursor-pointer text-center"
                          title={t('createReservation')}
                        >
                          <span className="text-[11px] text-[#E8B730]/40 opacity-0 hover:opacity-100 transition-opacity">+</span>
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>

              {/* ── Optimization suggestion row ── */}
              {weekDays.some(d => optimizationByDate.has(formatDate(d))) && (
                <tr className="border-b border-[#E8ECE4]">
                  <td className="px-4 py-2 border-r border-[#E8ECE4] bg-[#FFF8E1]/50">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb size={12} className="text-[#E8B730]" />
                      <span className="text-[10px] font-semibold text-[#92400E]">{t('optimizationAvailable')}</span>
                    </div>
                  </td>
                  {weekDays.map((d, i) => {
                    const dateStr = formatDate(d)
                    const suggestion = optimizationByDate.get(dateStr)
                    return (
                      <td key={i} className="px-2 py-2 border-r border-[#E8ECE4] last:border-r-0 align-top">
                        {suggestion && (
                          <div className="bg-[#FFF8E1] border border-[#E8B730]/30 rounded-lg px-2 py-1.5">
                            <div className="text-[9px] text-[#92400E]">
                              {t('currentWaste')}: {suggestion.currentWaste} &rarr; {suggestion.suggestedWaste}
                            </div>
                            <button
                              onClick={() => handleApplySuggestion(dateStr)}
                              className="mt-1 text-[9px] font-medium text-[#8B6914] hover:text-[#6B5210] underline cursor-pointer"
                            >
                              {t('applySuggestion')}
                            </button>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )}

              {/* ── Capacity footer row ── */}
              <tr>
                <td className="px-4 py-3 border-r border-[#E8ECE4] bg-[#FAFAF7]">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#8A7E6B]">{t('capacity')}</div>
                </td>
                {weekDays.map((d, i) => {
                  const dateStr = formatDate(d)
                  const isToday = dateStr === todayStr
                  const cap = weekCapacity.get(dateStr)
                  const used = cap?.used ?? 0
                  const total = cap?.total ?? totalCapacity
                  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
                  const assignedCount = cap?.assignedCount ?? 0
                  const unassignedCount = cap?.unassignedCount ?? 0

                  // Determine assignment status indicator
                  let statusIcon: React.ReactNode = null
                  if (assignedCount + unassignedCount > 0) {
                    if (cap?.hasAnomaly) {
                      statusIcon = (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle size={10} className="text-[#C4533A]" />
                          <span className="text-[9px] text-[#C4533A] font-medium">{t('anomaly')}</span>
                        </div>
                      )
                    } else if (unassignedCount > 0) {
                      statusIcon = (
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: Math.min(unassignedCount, 3) }).map((_, j) => (
                            <span key={j} className="w-1.5 h-1.5 rounded-full bg-[#E8B730]" />
                          ))}
                          <span className="text-[9px] text-[#E8B730] font-medium">{t('pendingShort')}</span>
                        </div>
                      )
                    } else {
                      statusIcon = (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-[#4A7C59] font-bold">&#10003;</span>
                          <span className="text-[9px] text-[#4A7C59] font-medium">{tc('done')}</span>
                        </div>
                      )
                    }
                  }

                  return (
                    <td
                      key={i}
                      className={`px-2 py-2.5 border-r border-[#E8ECE4] last:border-r-0 text-center ${isToday ? 'bg-[#FFFDF5]' : 'bg-[#FAFAF7]'}`}
                    >
                      <div className="text-[11px] font-semibold text-[#2C2416]">
                        {used}/{total}
                      </div>
                      {/* Capacity bar */}
                      <div className="mx-auto mt-1 w-full h-1.5 rounded-full bg-[#E8ECE4] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct > 90 ? '#C4533A' : pct > 70 ? '#E8B730' : '#5B8C3E',
                          }}
                        />
                      </div>
                      {/* Status indicator */}
                      {statusIcon}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /** Render a month cell (heat map style) */
  function renderMonthCell(day: number | null, idx: number) {
    if (day === null) {
      return (
        <div key={idx} className="min-h-[90px] border-b border-r border-[#E8ECE4]/60 bg-[#FAFAF7]/50" />
      )
    }

    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = dateStr === todayStr
    const summary = calendarSummary?.[dateStr]
    const resCount = summary?.reservationCount ?? 0
    const totalGuests = summary?.totalGuests ?? 0
    const totalCap = summary?.totalCapacity ?? totalCapacity
    const assignedCount = summary?.assignedCount ?? 0
    const unassignedCount = summary?.unassignedCount ?? 0
    const hasAnomaly = summary?.hasAnomaly ?? false
    const pct = totalCap > 0 ? Math.min(100, Math.round((totalGuests / totalCap) * 100)) : 0

    // Determine status indicator
    let statusIndicator: React.ReactNode = null
    if (resCount > 0) {
      if (hasAnomaly) {
        statusIndicator = <AlertTriangle size={10} className="text-[#C4533A]" />
      } else if (unassignedCount > 0) {
        statusIndicator = <span className="w-2 h-2 rounded-full bg-[#E8B730] inline-block" />
      } else {
        statusIndicator = <span className="text-[10px] text-[#4A7C59] font-bold">&#10003;</span>
      }
    }

    return (
      <div
        key={idx}
        className={`
          min-h-[90px] p-2 border-b border-r border-[#E8ECE4]/60
          transition-shadow duration-150 hover:shadow-[0_1px_6px_rgba(0,0,0,0.06)] cursor-pointer group
          ${isToday ? 'bg-[#FFF8E1] border-l-2 border-l-[#6B7F5E]' : ''}
        `}
        onClick={() => goToWeekOf(dateStr)}
        title={t('clickViewDetails')}
      >
        {/* Date number + status indicator */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className={`
            text-[13px] font-semibold
            ${isToday ? 'text-[#6B7F5E]' : 'text-[#2C2416]'}
          `}>
            {day}
          </span>
          <div className="flex items-center gap-1">
            {statusIndicator}
          </div>
        </div>

        {/* Reservation count */}
        {resCount > 0 && (
          <div className="mb-1.5">
            <span className="text-[11px] font-semibold text-[#2C2416]">{resCount}</span>
            <span className="text-[10px] text-[#8A7E6B] ml-1">{resCount === 1 ? 'res' : 'res'}</span>
            {unassignedCount > 0 && (
              <span className="text-[9px] text-[#E8B730] ml-1.5 font-medium">
                ({unassignedCount} pend)
              </span>
            )}
          </div>
        )}

        {/* Capacity bar */}
        {resCount > 0 && (
          <div className="mt-auto">
            <div className="w-full h-1 rounded-full bg-[#E8ECE4] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct > 90 ? '#C4533A' : pct > 70 ? '#E8B730' : '#5B8C3E',
                }}
              />
            </div>
            <div className="text-[9px] text-[#8A7E6B] mt-0.5">{totalGuests}/{totalCap}</div>
          </div>
        )}

        {/* Empty day — show + on hover */}
        {resCount === 0 && (
          <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus size={14} className="text-[#8A7E6B]/30" />
          </div>
        )}
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

  const navLabel = (() => {
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
  })()

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-auto min-h-0">

        {/* ── Top Controls Bar ─────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* View Toggle Pills */}
          <div className="flex">
            <button
              onClick={() => setView('week')}
              className={`
                px-5 py-1.5 text-sm font-semibold rounded-full transition-all duration-200
                ${view === 'week'
                  ? 'bg-[#6B7F5E] text-white shadow-sm'
                  : 'bg-transparent text-[#2C2416] border border-[#E8ECE4] hover:bg-[#F5F2ED]'
                }
              `}
            >
              {t('views.week')}
            </button>
            <button
              onClick={() => setView('month')}
              className={`
                px-5 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 ml-2
                ${view === 'month'
                  ? 'bg-[#6B7F5E] text-white shadow-sm'
                  : 'bg-transparent text-[#2C2416] border border-[#E8ECE4] hover:bg-[#F5F2ED]'
                }
              `}
            >
              {t('views.month')}
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

        {view === 'week' ? (
          renderWeekView()
        ) : (
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
            activityLogs={selectedResLogs || []}
            onClose={() => setSelectedResId(null)}
            onAction={{ confirmDeposit, cancelReservation, completeReservation }}
            isUpdating={actionUpdating}
            onOrderChanged={() => { mutateReservations(); mutateSelectedRes(); mutateSelectedResLogs(); }}
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
