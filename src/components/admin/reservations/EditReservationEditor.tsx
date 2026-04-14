'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { ArrowLeft, Minus, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface Yurt {
  id: string
  name: string
  capacity: number
  status: string
  sortOrder: number
}

interface ReservationSlot {
  id: string
  yurtId: string | null
  date: string
  status: string
}

interface EditReservationEditorProps {
  reservation: {
    id: string
    date: string
    yurtId: string | null
    guestCount: number
    specialRequests: string | null
    yurt: { id: string; name: string; capacity: number } | null
  }
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

type SlotsMap = Record<string, { total: number; occupied: number; available: number }>

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Fetch failed')
    return r.json()
  })

/** Return YYYY-MM-DD for a Date object (local time) */
function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Get the first day of a month and how many days it has */
function getMonthInfo(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { firstDay, daysInMonth }
}

const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

// ── Component ──────────────────────────────────────────────────────

export default function EditReservationEditor({
  reservation,
  isOpen,
  onClose,
  onSaved,
}: EditReservationEditorProps) {
  const t = useTranslations('admin.reservations.editEditor')

  const originalDate = reservation.date.split('T')[0]

  const [date, setDate] = useState(originalDate)
  const [yurtId, setYurtId] = useState<string | null>(reservation.yurtId)
  const [guestCount, setGuestCount] = useState(reservation.guestCount)
  const [specialRequests, setSpecialRequests] = useState(
    reservation.specialRequests || ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calendar month navigation
  const initDate = new Date(originalDate + 'T00:00:00')
  const [calYear, setCalYear] = useState(initDate.getFullYear())
  const [calMonth, setCalMonth] = useState(initDate.getMonth())

  // Reset state when reservation changes or editor opens
  useEffect(() => {
    if (isOpen) {
      const d = reservation.date.split('T')[0]
      setDate(d)
      setYurtId(reservation.yurtId)
      setGuestCount(reservation.guestCount)
      setSpecialRequests(reservation.specialRequests || '')
      setError(null)
      setSaving(false)
      const parsed = new Date(d + 'T00:00:00')
      setCalYear(parsed.getFullYear())
      setCalMonth(parsed.getMonth())
    }
  }, [isOpen, reservation])

  // Fetch all active yurts
  const { data: yurts } = useSWR<Yurt[]>(isOpen ? '/api/yurts' : null, fetcher, {
    revalidateOnFocus: false,
  })

  // Fetch reservations for the selected date to know which yurts are occupied
  const { data: dateReservations } = useSWR<ReservationSlot[]>(
    isOpen && date ? `/api/reservations?startDate=${date}&endDate=${date}` : null,
    fetcher
  )

  // Fetch availability/slots for the entire visible month (for calendar view)
  const calStartDate = useMemo(() => `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`, [calYear, calMonth])
  const calEndDate = useMemo(() => {
    const lastDay = new Date(calYear, calMonth + 1, 0).getDate()
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [calYear, calMonth])

  const { data: monthSlots } = useSWR<SlotsMap>(
    isOpen ? `/api/availability/slots?startDate=${calStartDate}&endDate=${calEndDate}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const activeYurts = useMemo(
    () =>
      (yurts || [])
        .filter((y) => y.status === 'ACTIVE')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [yurts]
  )

  // Yurts occupied by OTHER reservations on the selected date
  const occupiedYurtIds = useMemo(() => {
    if (!dateReservations) return new Set<string>()
    return new Set(
      dateReservations
        .filter(
          (r): r is typeof r & { yurtId: string } =>
            r.id !== reservation.id &&
            r.status !== 'CANCELLED' &&
            r.status !== 'EXPIRED' &&
            r.yurtId != null
        )
        .map((r) => r.yurtId)
    )
  }, [dateReservations, reservation.id])

  // Selected date slots
  const selectedSlots = monthSlots?.[date] ?? null

  // Selected yurt capacity
  const selectedYurt = activeYurts.find((y) => y.id === yurtId)
  const maxGuests = selectedYurt?.capacity ?? reservation.yurt?.capacity ?? 10

  // Clamp guest count when yurt changes
  useEffect(() => {
    if (guestCount > maxGuests) {
      setGuestCount(maxGuests)
    }
  }, [maxGuests, guestCount])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const hasChanges = useMemo(() => {
    return (
      date !== originalDate ||
      yurtId !== reservation.yurtId ||
      guestCount !== reservation.guestCount ||
      specialRequests !== (reservation.specialRequests || '')
    )
  }, [date, yurtId, guestCount, specialRequests, originalDate, reservation])

  const handleSave = useCallback(async () => {
    if (!hasChanges || saving) return
    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = { action: 'edit' }
      if (date !== originalDate) payload.date = date
      if (yurtId !== reservation.yurtId) payload.yurtId = yurtId
      if (guestCount !== reservation.guestCount) payload.guestCount = guestCount
      if (specialRequests !== (reservation.specialRequests || ''))
        payload.specialRequests = specialRequests || null

      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [hasChanges, saving, date, originalDate, yurtId, guestCount, specialRequests, reservation, onSaved, onClose])

  // ── Calendar navigation ──────────────────────────────────────
  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11) }
    else setCalMonth(calMonth - 1)
  }
  const goToNextMonth = () => {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0) }
    else setCalMonth(calMonth + 1)
  }

  // Detect locale for weekday headers
  const isZh = t('date').includes('日') || t('date').includes('期')
  const weekdays = isZh ? WEEKDAYS_ZH : WEEKDAYS_EN
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' })

  // Build calendar grid
  const { firstDay, daysInMonth } = getMonthInfo(calYear, calMonth)
  const todayKey = toDateKey(new Date())

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F7F4] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="h-14 bg-white border-b border-[#E8ECE4] flex items-center px-4 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-[#6B7F5E] font-semibold hover:text-[#5A6E4F] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>{t('title')}</span>
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 max-w-xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Date — inline calendar */}
          <div>
            <label className="text-sm font-semibold text-[#2C2416] mb-2 block">
              {t('date')}
            </label>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={goToPrevMonth}
                className="p-1.5 rounded-lg hover:bg-[#E8ECE4]/50 text-[#6B7F5E] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-[#2C2416]">{monthLabel}</span>
              <button
                onClick={goToNextMonth}
                className="p-1.5 rounded-lg hover:bg-[#E8ECE4]/50 text-[#6B7F5E] transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {weekdays.map((wd) => (
                <div key={wd} className="text-center text-[10px] font-semibold text-[#8C8478] uppercase py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px">
              {/* Empty cells for offset */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} className="h-12" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateKey = toDateKey(new Date(calYear, calMonth, day))
                const isSelected = dateKey === date
                const isOriginal = dateKey === originalDate
                const isToday = dateKey === todayKey
                const isPast = dateKey < todayKey
                const slots = monthSlots?.[dateKey]
                const avail = slots?.available ?? null
                const isFull = avail !== null && avail <= 0

                return (
                  <button
                    key={day}
                    onClick={() => !isPast && setDate(dateKey)}
                    disabled={isPast}
                    className={`
                      h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-all relative
                      ${isPast
                        ? 'text-[#D0CCC4] cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#6B7F5E] text-white font-semibold shadow-sm'
                          : isFull
                            ? 'text-[#DC3545]/60 hover:bg-red-50'
                            : 'text-[#2C2416] hover:bg-[#E8ECE4]/50 cursor-pointer'
                      }
                    `}
                  >
                    {/* Today dot */}
                    {isToday && !isSelected && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#6B7F5E]" />
                    )}
                    {/* Original date marker */}
                    {isOriginal && !isSelected && (
                      <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#8B6914]" />
                    )}
                    <span className={isSelected ? 'font-bold' : ''}>{day}</span>
                    {/* Slot indicator */}
                    {!isPast && avail !== null && (
                      <span className={`text-[9px] leading-none font-medium ${
                        isSelected
                          ? 'text-white/80'
                          : avail <= 0
                            ? 'text-[#DC3545]'
                            : avail <= 2
                              ? 'text-[#F4A623]'
                              : 'text-[#6B7F5E]'
                      }`}>
                        {avail <= 0 ? t('noSlots') : avail}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected date summary */}
            {selectedSlots && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${
                selectedSlots.available > 0
                  ? 'bg-[#6B7F5E]/10 text-[#6B7F5E]'
                  : 'bg-red-50 text-[#DC3545]'
              }`}>
                {selectedSlots.available > 0
                  ? t('slotsAvailable', { count: selectedSlots.available })
                  : t('noSlots')}
                {selectedSlots.available > 0 && (
                  <span className="text-[#8C8478] ml-2">
                    ({selectedSlots.occupied}/{selectedSlots.total} {t('occupied')})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Yurt selection */}
          <div>
            <label className="text-sm font-semibold text-[#2C2416] mb-2 block">
              {t('selectYurt')}
            </label>
            <div className="flex flex-col gap-2">
              {activeYurts.map((yurt) => {
                const isCurrent = yurt.id === reservation.yurtId
                const isOccupied = occupiedYurtIds.has(yurt.id)
                const isSelected = yurt.id === yurtId
                const isDisabled = isOccupied && !isCurrent

                return (
                  <button
                    key={yurt.id}
                    onClick={() => !isDisabled && setYurtId(yurt.id)}
                    disabled={isDisabled}
                    className={`
                      flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all
                      ${isSelected
                        ? 'border-[#6B7F5E] bg-[#6B7F5E]/5 ring-1 ring-[#6B7F5E]'
                        : isDisabled
                          ? 'border-[#E8ECE4] bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-[#E8ECE4] bg-white hover:border-[#6B7F5E]/50 cursor-pointer'
                      }
                    `}
                  >
                    <div>
                      <span className="text-sm font-medium text-[#2C2416]">
                        {yurt.name}
                      </span>
                      <span className="text-xs text-[#8A7E6B] ml-2">
                        (max {yurt.capacity})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#6B7F5E]/10 text-[#6B7F5E]">
                          {t('current')}
                        </span>
                      )}
                      {isOccupied && !isCurrent && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                          {t('occupied')}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Guest count */}
          <div>
            <label className="text-sm font-semibold text-[#2C2416] mb-2 block">
              {t('guestCount')}
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                disabled={guestCount <= 1}
                className="w-9 h-9 rounded-lg border border-[#E8ECE4] flex items-center justify-center hover:bg-[#E8ECE4]/30 disabled:opacity-30 transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-lg font-semibold text-[#2C2416] min-w-[40px] text-center">
                {guestCount}
              </span>
              <button
                onClick={() => setGuestCount((c) => Math.min(maxGuests, c + 1))}
                disabled={guestCount >= maxGuests}
                className="w-9 h-9 rounded-lg border border-[#E8ECE4] flex items-center justify-center hover:bg-[#E8ECE4]/30 disabled:opacity-30 transition-colors"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs text-[#8A7E6B] ml-2">
                / {maxGuests}
              </span>
            </div>
          </div>

          {/* Special requests */}
          <div>
            <label className="text-sm font-semibold text-[#2C2416] mb-2 block">
              {t('specialRequests')}
            </label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 rounded-lg border border-[#E8ECE4] bg-white text-sm text-[#2C2416] resize-none focus:outline-none focus:border-[#6B7F5E]"
            />
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-[#E8ECE4] bg-white shrink-0 max-w-xl mx-auto w-full">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#6B7F5E] text-white hover:bg-[#5A6E4F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}
