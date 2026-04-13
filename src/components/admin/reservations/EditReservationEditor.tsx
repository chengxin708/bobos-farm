'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { ArrowLeft, Minus, Plus, Loader2 } from 'lucide-react'

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
  yurtId: string
  date: string
  status: string
}

interface EditReservationEditorProps {
  reservation: {
    id: string
    date: string
    yurtId: string
    guestCount: number
    specialRequests: string | null
    yurt: { id: string; name: string; capacity: number }
  }
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Fetch failed')
    return r.json()
  })

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
  const [yurtId, setYurtId] = useState(reservation.yurtId)
  const [guestCount, setGuestCount] = useState(reservation.guestCount)
  const [specialRequests, setSpecialRequests] = useState(
    reservation.specialRequests || ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when reservation changes or editor opens
  useEffect(() => {
    if (isOpen) {
      setDate(reservation.date.split('T')[0])
      setYurtId(reservation.yurtId)
      setGuestCount(reservation.guestCount)
      setSpecialRequests(reservation.specialRequests || '')
      setError(null)
      setSaving(false)
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

  // Fetch availability/slots for the selected date
  const { data: slotsData } = useSWR<{ date: string; totalSlots: number; occupiedSlots: number; availableSlots: number }[]>(
    isOpen && date ? `/api/availability/slots?startDate=${date}&endDate=${date}` : null,
    fetcher
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
          (r) =>
            r.id !== reservation.id &&
            r.status !== 'CANCELLED' &&
            r.status !== 'EXPIRED'
        )
        .map((r) => r.yurtId)
    )
  }, [dateReservations, reservation.id])

  // Available slots count
  const availableSlots = slotsData?.[0]?.availableSlots ?? null

  // Selected yurt capacity
  const selectedYurt = activeYurts.find((y) => y.id === yurtId)
  const maxGuests = selectedYurt?.capacity ?? reservation.yurt.capacity

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

          {/* Date */}
          <div>
            <label className="text-sm font-semibold text-[#2C2416] mb-2 block">
              {t('date')}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#E8ECE4] bg-white text-sm text-[#2C2416] focus:outline-none focus:border-[#6B7F5E]"
            />
            {availableSlots !== null && (
              <p className={`mt-1.5 text-xs ${availableSlots > 0 ? 'text-[#6B7F5E]' : 'text-red-500'}`}>
                {availableSlots > 0
                  ? t('slotsAvailable', { count: availableSlots })
                  : t('noSlots')}
              </p>
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
