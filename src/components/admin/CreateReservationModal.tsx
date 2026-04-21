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
  const [guestWechatId, setGuestWechatId] = useState('')
  const [date, setDate] = useState(defaultDate || '')
  type YurtMode = 'auto' | 'specific' | 'hold'
  const [yurtMode, setYurtMode] = useState<YurtMode>(defaultYurtId ? 'specific' : 'auto')
  const [yurtIds, setYurtIds] = useState<string[]>(defaultYurtId ? [defaultYurtId] : [])
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
      .filter(r => r.yurtId && !['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED'].includes(r.status))
      .map(r => r.yurtId)
  )
  const availableYurts = activeYurts.filter(y => !occupiedYurtIds.has(y.id))
  const fittingYurts = availableYurts.filter(y => y.capacity >= guestCount)

  // Capacity warnings — pool capacity across all selected yurts
  const selectedYurts = activeYurts.filter(y => yurtIds.includes(y.id))
  const combinedCapacity = selectedYurts.reduce((s, y) => s + y.capacity, 0)
  const capacityExceeded =
    yurtMode === 'specific' && selectedYurts.length > 0 && guestCount > combinedCapacity
  const selectedYurtOccupied = selectedYurts.some(y => occupiedYurtIds.has(y.id))
  const noRoomAvailable =
    date && guestCount > 0 && yurtMode === 'auto' && dateReservations && fittingYurts.length === 0

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setGuestName('')
      setGuestEmail('')
      setGuestPhone('')
      setGuestWechatId('')
      setDate(defaultDate || '')
      setYurtMode(defaultYurtId ? 'specific' : 'auto')
      setYurtIds(defaultYurtId ? [defaultYurtId] : [])
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

    // At-least-one contact validation (matches API zod refine)
    const hasContact = guestEmail.trim() || guestPhone.trim() || guestWechatId.trim()
    if (!hasContact) {
      setError(t('atLeastOneContactRequired'))
      return
    }
    if (yurtMode === 'specific' && yurtIds.length === 0) {
      setError(t('selectAtLeastOneYurt'))
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          guestEmail,
          guestPhone,
          guestWechatId: guestWechatId || undefined,
          date,
          ...(yurtMode === 'specific' ? { yurtIds } : {}),
          holdAssignment: yurtMode === 'hold' ? true : undefined,
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
            {/* Past-date warning banner */}
            {date && date < new Date().toISOString().slice(0, 10) && (
              <div className="rounded-lg border border-[#E8B730]/40 bg-[#FFF8E1] px-3 py-2.5 flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[#8B6914]">{t('pastDateBanner')}</p>
                  <p className="text-[12px] text-[#8B6914]/85 mt-0.5">{t('pastDateBannerHint')}</p>
                </div>
              </div>
            )}

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
                placeholder={t('emailPlaceholder')}
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
                {t('guestPhone')}
              </label>
              <input
                type="tel"
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

            {/* Guest WeChat ID */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('guestWechat')}
              </label>
              <input
                type="text"
                value={guestWechatId}
                onChange={(e) => setGuestWechatId(e.target.value)}
                placeholder={t('wechatPlaceholder')}
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
              <p className="text-[11px] text-[#8C8478]">{t('contactHint')}</p>
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

            {/* Yurt assignment — mode radio + checkbox list */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                {t('selectYurt')}
              </label>
              <div className="flex flex-col gap-1.5">
                {[
                  { mode: 'auto' as const, label: t('autoAssign') },
                  { mode: 'specific' as const, label: t('specificYurts') },
                  { mode: 'hold' as const, label: t('holdNoAssign') },
                ].map(opt => (
                  <label key={opt.mode} className="flex items-center gap-2 text-sm text-[#2C2416] cursor-pointer">
                    <input
                      type="radio"
                      name="yurtMode"
                      checked={yurtMode === opt.mode}
                      onChange={() => {
                        setYurtMode(opt.mode)
                        if (opt.mode !== 'specific') setYurtIds([])
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {yurtMode === 'specific' && (
                <div className="flex flex-col gap-1 mt-1 pl-2 border-l-2 border-[#E8E2D9]">
                  {activeYurts.map(y => {
                    const isOccupied = occupiedYurtIds.has(y.id)
                    const checked = yurtIds.includes(y.id)
                    return (
                      <label
                        key={y.id}
                        className={`flex items-center gap-2 text-sm py-1 ${isOccupied ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{ color: '#2C2416' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isOccupied}
                          onChange={(e) => {
                            setYurtIds(prev =>
                              e.target.checked ? [...prev, y.id] : prev.filter(id => id !== y.id),
                            )
                          }}
                        />
                        <span className="flex-1">
                          {t('yurtCapacity', { name: `${y.name}${y.alias ? ` (${y.alias})` : ''}`, capacity: y.capacity })}
                          {isOccupied ? ` — ${t('occupied')}` : ''}
                        </span>
                      </label>
                    )
                  })}
                  {yurtIds.length > 0 && (
                    <p className="text-xs mt-2 text-[#6B7F5E] font-medium">
                      {t('multiDepositHint', {
                        count: yurtIds.length,
                        total: yurtIds.length * 300,
                      })}
                    </p>
                  )}
                </div>
              )}
              {capacityExceeded && (
                <p className="text-xs mt-1" style={{ color: '#DC3545' }}>
                  ⚠️ {t('capacityWarning', { guests: guestCount, capacity: combinedCapacity })}
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
