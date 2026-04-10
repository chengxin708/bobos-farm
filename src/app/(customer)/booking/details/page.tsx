"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, User, Mail, Phone, Minus, Plus, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { useBooking } from '@/contexts/BookingContext'

const settingsFetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

export default function BookingDetailsPage() {
  const t = useTranslations('booking.details')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { data: session } = useSession()
  const booking = useBooking()

  // Redirect back if no yurt selected (only after hydration)
  useEffect(() => {
    if (booking.hydrated && (!booking.selectedDate || !booking.selectedYurtId)) {
      router.replace('/booking/date')
    }
  }, [booking.hydrated, booking.selectedDate, booking.selectedYurtId, router])

  // Form state (pre-filled from session and/or booking context)
  const [contactName, setContactName] = useState(
    booking.contactName || session?.user?.name || ''
  )
  const [contactEmail, setContactEmail] = useState(
    booking.contactEmail || session?.user?.email || ''
  )
  const [contactPhone, setContactPhone] = useState(booking.contactPhone || '')
  const [guestCount, setGuestCount] = useState(booking.guestCount || 1)
  const [specialRequests, setSpecialRequests] = useState(booking.specialRequests || '')

  // Track which fields the user has interacted with (for inline validation)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Dismiss state for the capacity notice
  const [capacityNoticeDismissed, setCapacityNoticeDismissed] = useState(false)

  // Update from session when it loads
  useEffect(() => {
    if (session?.user) {
      if (!contactName && session.user.name) setContactName(session.user.name)
      if (!contactEmail && session.user.email) setContactEmail(session.user.email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const { data: settings } = useSWR<Record<string, string>>('/api/settings/public', settingsFetcher, {
    revalidateOnFocus: false,
  })

  const maxGuests = booking.selectedYurt?.capacity || 15
  const MIN_RECOMMENDED_GUESTS = settings?.guest_warning_threshold ? Number(settings.guest_warning_threshold) : 6

  const formattedDate = booking.selectedDate
    ? new Date(booking.selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const subtitle = `${booking.selectedYurt?.name || ''} · ${formattedDate}`

  // Validation errors
  const errors = useMemo(() => {
    const e: Record<string, string | null> = {}
    e.contactName = contactName.trim().length === 0 ? 'Please enter your name' : null
    e.contactEmail = contactEmail.trim().length === 0
      ? 'Please enter your email'
      : !contactEmail.includes('@') || !contactEmail.includes('.')
        ? 'Please enter a valid email address'
        : null
    e.contactPhone = null // phone is optional
    e.guestCount = guestCount < 1
      ? 'At least 1 guest required'
      : guestCount > maxGuests
        ? `Maximum ${maxGuests} guests for this yurt`
        : null
    return e
  }, [contactName, contactEmail, guestCount, maxGuests])

  const isValid = useMemo(() => {
    return Object.values(errors).every((e) => e === null)
  }, [errors])

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function handleNext() {
    // Mark all fields as touched to show any remaining errors
    setTouched({ contactName: true, contactEmail: true, contactPhone: true, guestCount: true })
    if (!isValid) return
    booking.setDetails({
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      specialRequests: specialRequests.trim(),
      guestCount,
    })
    router.push('/booking/confirm')
  }

  // Show spinner while hydrating from sessionStorage
  if (!booking.hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-[3px] border-beige border-t-amber animate-spin" />
      </div>
    )
  }

  if (!booking.selectedDate || !booking.selectedYurtId) return null

  return (
    <>
      {/* Content */}
      <div className="flex-1 flex justify-center py-6 px-4 sm:px-10 lg:px-20 overflow-y-auto">
        <div className="w-[560px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-6">
          <div>
            <h2 className="font-playfair text-2xl font-bold text-brown">{t('title')}</h2>
            <p className="text-sm text-[#8E8E93] mt-1">{subtitle}</p>
          </div>

          <div className="h-px bg-beige" />

          {/* Form Fields */}
          <div className="flex flex-col gap-5">
            {/* Contact Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('contactName')}</label>
              <div className={`flex items-center gap-3 h-12 px-4 bg-[#FAFAF8] rounded-xl border ${
                touched.contactName && errors.contactName ? 'border-[#DC3545]' : 'border-beige'
              }`}>
                <User size={16} className="text-brown/40" />
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onBlur={() => handleBlur('contactName')}
                  placeholder="Your full name"
                  aria-label={t('contactName')}
                  aria-invalid={touched.contactName && !!errors.contactName}
                  className="flex-1 text-sm bg-transparent outline-none text-brown placeholder:text-brown/30"
                />
              </div>
              {touched.contactName && errors.contactName && (
                <div className="flex items-center gap-1.5 text-[#DC3545]">
                  <AlertCircle size={13} />
                  <span className="text-xs">{errors.contactName}</span>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('email')}</label>
              <div className={`flex items-center gap-3 h-12 px-4 bg-[#FAFAF8] rounded-xl border ${
                touched.contactEmail && errors.contactEmail ? 'border-[#DC3545]' : 'border-beige'
              }`}>
                <Mail size={16} className="text-brown/40" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  onBlur={() => handleBlur('contactEmail')}
                  placeholder="your@email.com"
                  aria-label={t('email')}
                  aria-invalid={touched.contactEmail && !!errors.contactEmail}
                  className="flex-1 text-sm bg-transparent outline-none text-brown placeholder:text-brown/30"
                />
              </div>
              {touched.contactEmail && errors.contactEmail && (
                <div className="flex items-center gap-1.5 text-[#DC3545]">
                  <AlertCircle size={13} />
                  <span className="text-xs">{errors.contactEmail}</span>
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-brown">{t('phoneNumber')}</label>
                <span className="text-[11px] text-brown/40 italic">{tCommon('optional')}</span>
              </div>
              <div className="flex items-center gap-3 h-12 px-4 bg-[#FAFAF8] rounded-xl border border-beige">
                <Phone size={16} className="text-brown/40" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  onBlur={() => handleBlur('contactPhone')}
                  placeholder="(555) 000-0000"
                  aria-label={t('phoneNumber')}
                  className="flex-1 text-sm bg-transparent outline-none text-brown placeholder:text-brown/30"
                />
              </div>
            </div>

            {/* Guest Counter */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-brown">{t('numberOfGuests')}</label>
              <div className="flex items-center justify-center gap-5">
                <button
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                  disabled={guestCount <= 1}
                  aria-label="Decrease guest count"
                  className={`w-9 h-9 rounded-lg border border-beige flex items-center justify-center bg-white ${
                    guestCount <= 1 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-beige/30'
                  }`}
                >
                  <Minus size={16} className="text-brown" />
                </button>
                <span className="text-2xl font-bold text-brown w-10 text-center">{guestCount}</span>
                <button
                  onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                  disabled={guestCount >= maxGuests}
                  aria-label="Increase guest count"
                  className={`w-9 h-9 rounded-lg border border-beige flex items-center justify-center bg-white ${
                    guestCount >= maxGuests ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-beige/30'
                  }`}
                >
                  <Plus size={16} className="text-brown" />
                </button>
              </div>
              <p className="text-xs text-[#8E8E93] text-center">
                Max {maxGuests} guests for {booking.selectedYurt?.name}
              </p>
            </div>

            {/* Capacity Notice - shown when below recommended minimum and not dismissed */}
            {guestCount < MIN_RECOMMENDED_GUESTS && !capacityNoticeDismissed && (
              <div className="bg-[#FEF3CD] rounded-lg p-4 flex flex-col gap-1">
                <p className="text-[13px] text-[#7A5D10] leading-relaxed">
                  {t('capacityNotice')}
                </p>
                <button
                  onClick={() => setCapacityNoticeDismissed(true)}
                  className="text-[13px] font-semibold text-amber no-underline self-end border-none bg-transparent cursor-pointer"
                >
                  {tCommon('gotItContinue')}
                </button>
              </div>
            )}

            {/* Special Requests */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-brown">{t('specialRequests')}</label>
                <span className="text-[11px] text-brown/40 italic">{tCommon('optional')}</span>
              </div>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder={t('specialRequestsPlaceholder')}
                aria-label={t('specialRequests')}
                className="h-24 px-4 py-3 bg-white rounded-xl border border-beige text-sm resize-none outline-none placeholder:text-brown/27"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 shrink-0 bg-white border-t border-beige flex items-center justify-between px-4 sm:px-10 lg:px-20">
        <button
          onClick={() => router.push('/booking/yurt')}
          className="flex items-center gap-2 px-4 py-2.5 text-[15px] font-medium text-brown border-none bg-transparent cursor-pointer"
        >
          <ArrowLeft size={18} /> {tCommon('back')}
        </button>
        <div className="flex items-center gap-3">
          {!isValid && Object.values(touched).some(Boolean) && (
            <span className="text-sm text-[#DC3545]">Please fill in required fields</span>
          )}
          <button
            onClick={handleNext}
            disabled={!isValid}
            aria-label={!isValid ? 'Please complete required fields' : 'Continue to confirmation'}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-semibold border-none transition-colors ${
              isValid
                ? 'bg-gradient-to-r from-amber to-[#A67C2E] text-white cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)]'
                : 'bg-[#BFBFBF] text-white/70 cursor-not-allowed'
            }`}
          >
            {tCommon('next')} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </>
  )
}
