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
import { CalendarPlus, ChevronLeft, ChevronRight, Users, ArrowLeft } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

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

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Get the Monday-start week range for a given date */
function getWeekStart(baseDate: Date): Date {
  const d = new Date(baseDate)
  const day = d.getDay()
  // Shift to Monday start: Sunday (0) maps to -6, Mon (1) maps to 0, etc.
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
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

/** Calculate the ISO week number of the month (1-based) */
function getWeekOfMonth(date: Date): number {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstMonday = getWeekStart(firstOfMonth)
  // If firstMonday is before the 1st, the first partial week counts as week 1
  const diff = date.getTime() - firstMonday.getTime()
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

  /** Set of date strings that have any bookings */
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

  const activeYurts = useMemo(() =>
    (yurts || []).filter(y => y.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder),
    [yurts]
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
                  {/* Booking dot */}
                  <div className="h-1.5 mt-0.5">
                    {hasBookings && (
                      <div className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-[#6B7F5E]'}`} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Selected Date Detail ────────────────────────── */}
        <div className="flex-1 px-4 py-4">
          {/* Date heading */}
          <h2 className="text-[17px] font-bold text-[#2C2416] mb-3" style={{ fontFamily: 'var(--font-playfair)' }}>
            {selectedDateHeading}
          </h2>

          {/* Loading */}
          {loadingRes && (
            <div className="text-center text-sm text-[#8A7E6B] py-8">{t('loading')}</div>
          )}

          {/* Yurt cards */}
          {!loadingRes && activeYurts.map(yurt => {
            const res = selectedDayReservations.get(yurt.id)
            const isClosed = closedByDateYurt.get(selectedDateStr)?.has(yurt.id)

            if (res) {
              // Booked card — tap to view reservation detail
              return (
                <button
                  key={yurt.id}
                  onClick={() => setSelectedResId(res.id)}
                  className="w-full text-left bg-white rounded-xl p-4 border border-[#E8ECE4] mb-3 cursor-pointer hover:border-[#6B7F5E]/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold text-[#6B7F5E]">{yurt.name}</span>
                    <StatusBadge
                      type="reservation"
                      status={res.status}
                      label={statusLabel(res.status, t)}
                    />
                  </div>
                  <div className={`${res.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                    <div className="text-[15px] font-semibold text-[#2C2416]">
                      {getDisplayName(res.user)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[#8A7E6B]">
                      <Users size={13} />
                      <span className="text-[13px]">{t('guests', { count: res.guestCount })}</span>
                    </div>
                    {res.specialRequests && (
                      <p className="text-[12px] text-[#8A7E6B] mt-2 line-clamp-2">
                        {res.specialRequests}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-[#6B7F5E] mt-2 block">
                    {t('clickViewDetails')}
                  </span>
                </button>
              )
            }

            if (isClosed) {
              // Closed card
              return (
                <div
                  key={yurt.id}
                  className="bg-white rounded-xl p-4 border border-[#E8ECE4] mb-3 opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#8A7E6B]">{yurt.name}</span>
                    <span className="text-[12px] text-[#8A7E6B]">{t('status.closed')}</span>
                  </div>
                </div>
              )
            }

            // Available card — tap to create reservation with date + yurt prefill
            return (
              <button
                key={yurt.id}
                onClick={() => {
                  setCreateYurtId(yurt.id)
                  setShowCreateModal(true)
                }}
                className="w-full bg-white rounded-xl p-4 border border-[#E8ECE4] mb-3 text-left hover:border-[#6B7F5E]/40 hover:bg-[#6B7F5E]/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#6B7F5E]">{yurt.name}</span>
                  <span className="text-[13px] text-[#6B7F5E]">{t('available')} — {t('clickToBook')}</span>
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
