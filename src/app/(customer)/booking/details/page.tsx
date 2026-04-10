"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, User, Mail, Phone, Minus, Plus, AlertCircle, Info, X } from 'lucide-react'
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
        <div className="w-10 h-10 rounded-full border-[3px] border-[#E8ECE4] border-t-[#6B7F5E] animate-spin" />
      </div>
    )
  }

  if (!booking.selectedDate || !booking.selectedYurtId) return null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-[#F8F7F4] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/booking/yurt')}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon('back')}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <span className="text-sm text-[#8C8478]">Step 3 of 4</span>
      </div>

      {/* Page Title */}
      <div className="text-center mt-4 mb-6 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">{t('title')}</h1>
      </div>

      {/* Form Container */}
      <div className="flex-1 px-4 pb-28">
        <div className="max-w-[560px] mx-auto flex flex-col gap-5">

          {/* Contact Name */}
          <div className="flex flex-col gap-1">
            <div className={`relative flex items-center h-[52px] px-4 rounded-xl border transition-colors ${
              touched.contactName && errors.contactName
                ? 'border-[#C4453A]'
                : 'border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20'
            }`}>
              <User size={18} className="text-[#8C8478] shrink-0 mr-3" />
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onBlur={() => handleBlur('contactName')}
                placeholder={`${t('contactName')} *`}
                aria-label={t('contactName')}
                aria-invalid={touched.contactName && !!errors.contactName}
                className="flex-1 text-base bg-transparent outline-none text-[#1A1208] placeholder:text-[#8C8478]"
              />
            </div>
            {touched.contactName && errors.contactName && (
              <div className="flex items-center gap-1.5 text-[#C4453A] mt-1">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-sm">{errors.contactName}</span>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <div className={`relative flex items-center h-[52px] px-4 rounded-xl border transition-colors ${
              touched.contactEmail && errors.contactEmail
                ? 'border-[#C4453A]'
                : 'border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20'
            }`}>
              <Mail size={18} className="text-[#8C8478] shrink-0 mr-3" />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                onBlur={() => handleBlur('contactEmail')}
                placeholder={`${t('email')} *`}
                aria-label={t('email')}
                aria-invalid={touched.contactEmail && !!errors.contactEmail}
                className="flex-1 text-base bg-transparent outline-none text-[#1A1208] placeholder:text-[#8C8478]"
              />
            </div>
            {touched.contactEmail && errors.contactEmail && (
              <div className="flex items-center gap-1.5 text-[#C4453A] mt-1">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-sm">{errors.contactEmail}</span>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1">
            <div className="relative flex items-center h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20 transition-colors">
              <Phone size={18} className="text-[#8C8478] shrink-0 mr-3" />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                onBlur={() => handleBlur('contactPhone')}
                placeholder={`${t('phoneNumber')} (${tCommon('optional')})`}
                aria-label={t('phoneNumber')}
                className="flex-1 text-base bg-transparent outline-none text-[#1A1208] placeholder:text-[#8C8478]"
              />
            </div>
          </div>

          {/* Guest Counter */}
          <div className="rounded-xl border border-[#E8ECE4] p-4">
            <label className="text-sm font-medium text-[#8C8478]">{t('numberOfGuests')}</label>
            <div className="flex items-center justify-center gap-6 mt-3">
              <button
                onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                disabled={guestCount <= 1}
                aria-label="Decrease guest count"
                className={`w-10 h-10 rounded-full border border-[#E8ECE4] flex items-center justify-center bg-transparent transition-colors ${
                  guestCount <= 1 ? 'cursor-not-allowed text-[#8C8478]/30' : 'cursor-pointer text-[#1A1208] hover:bg-[#E8ECE4]/50'
                }`}
              >
                <Minus size={18} />
              </button>
              <span className="text-xl font-medium text-[#1A1208] w-10 text-center">{guestCount}</span>
              <button
                onClick={() => setGuestCount(Math.min(maxGuests, guestCount + 1))}
                disabled={guestCount >= maxGuests}
                aria-label="Increase guest count"
                className={`w-10 h-10 rounded-full border border-[#E8ECE4] flex items-center justify-center bg-transparent transition-colors ${
                  guestCount >= maxGuests ? 'cursor-not-allowed text-[#8C8478]/30' : 'cursor-pointer text-[#1A1208] hover:bg-[#E8ECE4]/50'
                }`}
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="text-sm text-[#8C8478] text-center mt-2">
              Yurt capacity: {maxGuests} guests
            </p>
          </div>

          {/* Capacity Notice - shown when below recommended minimum and not dismissed */}
          {guestCount < MIN_RECOMMENDED_GUESTS && !capacityNoticeDismissed && (
            <div className="bg-[#E8ECE4] rounded-xl p-3 flex items-start gap-2.5">
              <Info size={16} className="text-[#6B7F5E] shrink-0 mt-0.5" />
              <p className="text-sm text-[#3D4A35] leading-relaxed flex-1">
                {t('capacityNotice')}
              </p>
              <button
                onClick={() => setCapacityNoticeDismissed(true)}
                aria-label="Dismiss notice"
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#D4DDD0] transition-colors border-none bg-transparent cursor-pointer"
              >
                <X size={14} className="text-[#6B7F5E]" />
              </button>
            </div>
          )}

          {/* Special Requests */}
          <div className="flex flex-col gap-1">
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder={t('specialRequestsPlaceholder')}
              aria-label={t('specialRequests')}
              className="min-h-[100px] px-4 py-3 rounded-xl border border-[#E8ECE4] focus:border-[#6B7F5E] focus:ring-1 focus:ring-[#6B7F5E]/20 text-base text-[#1A1208] resize-none outline-none placeholder:text-[#8C8478] bg-transparent transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Bottom Fixed Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-[#F8F7F4]">
        <div className="max-w-[560px] mx-auto">
          <button
            onClick={handleNext}
            disabled={!isValid}
            aria-label={!isValid ? 'Please complete required fields' : 'Continue to confirmation'}
            className={`w-full py-3.5 rounded-full text-base font-medium border-none transition-all flex items-center justify-center gap-2 ${
              isValid
                ? 'bg-[#6B7F5E] text-white cursor-pointer shadow-[0_2px_8px_rgba(107,127,94,0.25)]'
                : 'bg-[#6B7F5E] text-white opacity-40 cursor-not-allowed'
            }`}
          >
            {tCommon('next')}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
