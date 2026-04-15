"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { X, Loader2, ArrowLeft } from 'lucide-react'
import { formatPhoneUS } from '@/lib/phone-mask'

interface Yurt {
  id: string
  name: string
  alias?: string | null
  capacity: number
  status: string
}

interface CreateReservationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  defaultDate?: string
  defaultYurtId?: string
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

export default function CreateReservationModal({
  isOpen,
  onClose,
  onCreated,
  defaultDate,
  defaultYurtId,
}: CreateReservationModalProps) {
  const t = useTranslations('admin.createReservation')
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [date, setDate] = useState(defaultDate || '')
  const [yurtId, setYurtId] = useState(defaultYurtId || '')
  const [guestCount, setGuestCount] = useState(1)
  const [specialRequests, setSpecialRequests] = useState('')
  const [customDeposit, setCustomDeposit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const { data: yurts } = useSWR<Yurt[]>(isOpen ? '/api/yurts' : null, fetcher)
  const activeYurts = (yurts || []).filter(y => y.status === 'ACTIVE')

  // Fetch existing reservations for selected date to find occupied yurts
  interface DateReservation { id: string; yurtId: string | null; status: string }
  const { data: dateReservations } = useSWR<DateReservation[]>(
    isOpen && date ? `/api/reservations?date=${date}` : null,
    (url: string) => fetch(url).then(r => r.json()).then(d => d.reservations ?? d),
    { revalidateOnFocus: false }
  )
  const occupiedYurtIds = new Set(
    (dateReservations || [])
      .filter(r => r.yurtId && !['CANCELLED', 'EXPIRED'].includes(r.status))
      .map(r => r.yurtId)
  )
  const availableYurts = activeYurts.filter(y => !occupiedYurtIds.has(y.id))
  const fittingYurts = availableYurts.filter(y => y.capacity >= guestCount)

  // Capacity warnings
  const selectedYurt = activeYurts.find(y => y.id === yurtId)
  const capacityExceeded = selectedYurt && guestCount > selectedYurt.capacity
  const selectedYurtOccupied = selectedYurt && occupiedYurtIds.has(selectedYurt.id)
  const noRoomAvailable = date && guestCount > 0 && !yurtId && dateReservations && fittingYurts.length === 0

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setGuestName('')
      setGuestEmail('')
      setGuestPhone('')
      setDate(defaultDate || '')
      setYurtId(defaultYurtId || '')
      setGuestCount(1)
      setSpecialRequests('')
      setCustomDeposit('')
      setError('')
      setSubmitting(false)
      // Animate in
      requestAnimationFrame(() => setVisible(true))
      // Auto-focus
      setTimeout(() => nameInputRef.current?.focus(), 100)
    } else {
      setVisible(false)
    }
  }, [isOpen, defaultDate, defaultYurtId])

  // Only close via X button — no backdrop click or Escape to prevent accidental closure

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          guestEmail,
          guestPhone,
          date,
          yurtId: yurtId || undefined,
          guestCount,
          specialRequests: specialRequests || undefined,
          ...(isAdmin && customDeposit !== '' ? { customDeposit: Number(customDeposit) } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('createFailed'))
        setSubmitting(false)
        return
      }

      onCreated()
      onClose()
    } catch {
      setError(t('networkError'))
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-4 transition-all duration-200 ${visible ? 'md:bg-black/40' : 'md:bg-black/0'}`}
    >
      <div
        ref={modalRef}
        className={`bg-[#F8F7F4] md:bg-white w-full h-full md:h-auto md:max-w-lg md:rounded-2xl md:shadow-2xl flex flex-col transition-all duration-200 ${visible ? 'opacity-100 md:scale-100 md:translate-y-0' : 'opacity-0 md:scale-95 md:translate-y-4'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — mobile: full-width bar / desktop: inline */}
        <div className="flex items-center justify-between h-14 md:h-auto px-4 md:px-6 md:pt-6 md:pb-2 bg-white md:bg-transparent border-b md:border-b-0 border-[#E8ECE4] shrink-0">
          {/* Mobile back button */}
          <button
            onClick={onClose}
            className="flex md:hidden items-center gap-1.5 text-sm text-[#6B7F5E] font-semibold"
          >
            <ArrowLeft size={16} />
            {t('title')}
          </button>
          {/* Desktop title */}
          <h2
            className="hidden md:block text-xl font-bold"
            style={{ fontFamily: 'var(--font-playfair)', color: '#2C2416' }}
          >
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="hidden md:block p-1.5 rounded-lg hover:bg-[#F5F2ED] transition-colors"
          >
            <X size={18} style={{ color: '#8A7E6B' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
          <div className="flex flex-col gap-4 mt-4">
            {/* Guest Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('guestName')} <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t('guestNamePlaceholder')}
                className="h-11 px-3 rounded-lg border outline-none transition-all duration-150 focus:ring-2"
                style={{
                  borderColor: '#E8E2D9',
                  backgroundColor: '#FFFFFF',
                  color: '#2C2416',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Guest Email (optional) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('guestEmail')}
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="guest@example.com"
                className="h-11 px-3 rounded-lg border outline-none transition-all duration-150"
                style={{ borderColor: '#E8E2D9', color: '#2C2416' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Guest Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('guestPhone')} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={guestPhone}
                onChange={(e) => setGuestPhone(formatPhoneUS(e.target.value))}
                placeholder={t('phonePlaceholder')}
                className="h-11 px-3 rounded-lg border outline-none transition-all duration-150"
                style={{ borderColor: '#E8E2D9', color: '#2C2416' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('date')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 px-3 rounded-lg border outline-none transition-all duration-150"
                style={{ borderColor: '#E8E2D9', color: '#2C2416' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Yurt Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('selectYurt')}
              </label>
              <select
                value={yurtId}
                onChange={(e) => setYurtId(e.target.value)}
                className="h-11 px-3 rounded-lg border outline-none transition-all duration-150 bg-white"
                style={{ borderColor: '#E8E2D9', color: yurtId ? '#2C2416' : '#8A7E6B' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <option value="">{t('autoAssign')}</option>
                {activeYurts.map(y => {
                  const isOccupied = occupiedYurtIds.has(y.id)
                  const tooSmall = guestCount > y.capacity
                  return (
                    <option key={y.id} value={y.id} disabled={isOccupied}>
                      {t('yurtCapacity', { name: `${y.name}${y.alias ? ` (${y.alias})` : ''}`, capacity: y.capacity })}
                      {isOccupied ? ` — ${t('occupied')}` : ''}
                      {tooSmall && !isOccupied ? ` — ${t('tooSmall')}` : ''}
                    </option>
                  )
                })}
              </select>
              {capacityExceeded && (
                <p className="text-xs mt-1" style={{ color: '#DC3545' }}>
                  ⚠️ {t('capacityWarning', { guests: guestCount, capacity: selectedYurt!.capacity })}
                </p>
              )}
              {selectedYurtOccupied && (
                <p className="text-xs mt-1" style={{ color: '#DC3545' }}>
                  ⚠️ {t('yurtOccupied')}
                </p>
              )}
              {noRoomAvailable && (
                <p className="text-xs mt-1" style={{ color: '#DC3545' }}>
                  ⚠️ {t('noRoomAvailable')}
                </p>
              )}
            </div>

            {/* Guest Count */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('guestCount')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={guestCount}
                onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                className="h-11 px-3 rounded-lg border outline-none transition-all duration-150"
                style={{ borderColor: '#E8E2D9', color: '#2C2416' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Special Requests */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('specialRequests')}
              </label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t('specialRequestsPlaceholder')}
                className="px-3 py-2.5 rounded-lg border outline-none transition-all duration-150 resize-none"
                style={{ borderColor: '#E8E2D9', color: '#2C2416' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6B7F5E'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E8E2D9'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <span className="text-[11px] text-right" style={{ color: '#8A7E6B' }}>
                {specialRequests.length}/500
              </span>
            </div>

            {/* Deposit Amount (admin only) */}
            {isAdmin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                  {t('depositAmount')}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#2C2416' }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customDeposit}
                    onChange={(e) => setCustomDeposit(e.target.value)}
                    placeholder={t('depositDefault')}
                    className="flex-1 h-11 px-3 rounded-lg border outline-none transition-all duration-150"
                    style={{ borderColor: '#E8E2D9', color: '#2C2416' }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6B7F5E'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,127,94,0.15)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E8E2D9'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: '#8C8478' }}>{t('depositHint')}</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 pb-safe" style={{ borderTop: '1px solid #E8E2D9' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#F5F2ED]"
              style={{ color: '#2C2416' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 flex items-center gap-2"
              style={{ backgroundColor: submitting ? '#5A6E4F' : '#6B7F5E' }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? t('creating') : t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
