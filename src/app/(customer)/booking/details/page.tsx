"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, User, Mail, Phone, AlertCircle, Info, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { useBooking } from '@/contexts/BookingContext'
import { formatPhoneUS } from '@/lib/phone-mask'
import { GuestCountPicker } from '@/components/customer/GuestCountPicker'
import { LanguageToggle } from '@/components/customer/LanguageToggle'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

// Fallback cap until per-date yurt availability has loaded. Once the
// /api/availability/for-date call resolves, the real cap replaces this.
const DEFAULT_SELF_SERVE_CAP = 30

interface YurtAvailability {
  id: string
  name: string
  capacity: number
  isAvailable: boolean
}

interface ForDateResponse {
  date: string
  yurts: YurtAvailability[]
  maxAvailableCapacity: number
}

export default function BookingDetailsPage() {
  const t = useTranslations('booking.details')
  const tCommon = useTranslations('common')
  const tPicker = useTranslations('guestCountPicker')
  const router = useRouter()
  const { data: session } = useSession()
  const booking = useBooking()

  useEffect(() => {
    if (booking.hydrated && !booking.selectedDate) {
      router.replace('/booking/date')
    }
  }, [booking.hydrated, booking.selectedDate, router])

  const [contactName, setContactName] = useState(
    booking.contactName || session?.user?.name || ''
  )
  const [contactEmail, setContactEmail] = useState(
    booking.contactEmail || session?.user?.email || ''
  )
  const [contactPhone, setContactPhone] = useState(booking.contactPhone || '')
  const [guestCount, setGuestCount] = useState<number | null>(
    booking.guestCount > 0 ? booking.guestCount : null,
  )
  const [specialRequests, setSpecialRequests] = useState(booking.specialRequests || '')

  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const { data: userProfile } = useSWR(
    session?.user ? '/api/users/me' : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (session?.user) {
      if (!contactName && session.user.name) setContactName(session.user.name)
      if (!contactEmail && session.user.email) setContactEmail(session.user.email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (userProfile?.phone && !contactPhone) {
      setContactPhone(formatPhoneUS(userProfile.phone))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile])

  const { data: settings } = useSWR<Record<string, string>>('/api/settings/public', fetcher, {
    revalidateOnFocus: false,
  })
  const minRecommended = settings?.guest_warning_threshold
    ? Number(settings.guest_warning_threshold)
    : undefined

  // Pull per-date yurt availability so the guest cap reflects which of
  // the farm's yurts are still free for the selected date.
  const { data: availability } = useSWR<ForDateResponse>(
    booking.selectedDate ? `/api/availability/for-date?date=${booking.selectedDate}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const selfServeCap = availability?.maxAvailableCapacity ?? DEFAULT_SELF_SERVE_CAP
  // Are any yurts already booked/closed on this date? If so, the cap may
  // have shrunk from the venue's overall max and the inquiry banner should
  // explain that the reason is availability, not a policy choice.
  const largerYurtsBooked = useMemo(() => {
    if (!availability) return false
    if (availability.yurts.length === 0) return false
    const venueMax = availability.yurts.reduce((acc, y) => Math.max(acc, y.capacity), 0)
    return selfServeCap < venueMax
  }, [availability, selfServeCap])

  // Picking a count above the date-specific cap routes this booking to the
  // inquiry flow. The stepper stays usable up to hardMax; this flag just
  // tells the page which path the Next button should take.
  const goingToInquiry = guestCount != null && guestCount > selfServeCap

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {}
    e.contactName = contactName.trim().length === 0 ? t('validation.nameRequired') : null
    e.contactEmail = contactEmail.trim().length === 0
      ? t('validation.emailRequired')
      : !contactEmail.includes('@') || !contactEmail.includes('.')
        ? t('validation.emailInvalid')
        : null
    e.contactPhone = contactPhone.trim().length === 0 ? t('validation.phoneRequired') : null
    e.guestCount = guestCount == null ? t('validation.guestsRequired') : null
    return e
  }, [contactName, contactEmail, contactPhone, guestCount, t])

  const isValid = useMemo(() => {
    return Object.values(errors).every((e) => e === null)
  }, [errors])

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  async function handleNext() {
    setTouched({ contactName: true, contactEmail: true, contactPhone: true, guestCount: true })
    if (!isValid || guestCount == null) return

    // Fast path: stepper-cap-based hint says inquiry. Skip the probe.
    if (goingToInquiry) {
      routeToInquiry()
      return
    }

    // Deep check: does the algorithm say a new reservation actually fits
    // on this date, accounting for possible reshuffles of non-manual rows?
    if (booking.selectedDate) {
      try {
        const probeRes = await fetch(
          `/api/availability/check?date=${booking.selectedDate}&guests=${guestCount}`,
        )
        if (probeRes.ok) {
          const probe = await probeRes.json()
          if (probe.shouldInquire) {
            routeToInquiry()
            return
          }
        }
        // Non-OK / network errors fall through to the normal confirm flow.
        // The booking POST will surface a real failure later if it happens.
      } catch {
        // Same as above — don't block the user on a probe failure.
      }
    }

    booking.setDetails({
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      specialRequests: specialRequests.trim(),
      guestCount,
    })
    router.push('/booking/confirm')
  }

  function routeToInquiry() {
    if (guestCount == null) return
    const qs = new URLSearchParams()
    if (booking.selectedDate) qs.set('date', booking.selectedDate)
    qs.set('guestCount', String(guestCount))
    if (specialRequests) qs.set('note', specialRequests)
    router.push(`/inquiries/new?${qs.toString()}`)
  }

  function handleInquireEscape() {
    const qs = new URLSearchParams()
    if (booking.selectedDate) qs.set('date', booking.selectedDate)
    if (guestCount != null) qs.set('guestCount', String(guestCount))
    if (specialRequests) qs.set('note', specialRequests)
    const tail = qs.toString()
    router.push(tail ? `/inquiries/new?${tail}` : '/inquiries/new')
  }

  if (!booking.hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-[3px] border-[#E8ECE4] border-t-[#6B7F5E] animate-spin" />
      </div>
    )
  }

  if (!booking.selectedDate) return null

  const inquiryReasonKey =
    goingToInquiry && largerYurtsBooked
      ? 'inquiryBanner.reasonOverCapDueToBooked'
      : 'inquiryBanner.reasonOverCap'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 bg-[#F8F7F4] px-4 py-3 grid grid-cols-3 items-center">
        <button
          onClick={() => router.push('/booking/date')}
          className="justify-self-start flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon('back')}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <div className="justify-self-center">
          <LanguageToggle />
        </div>
        <span className="justify-self-end text-[15px] text-[#6B6157]">{t('stepLabel')}</span>
      </div>

      <div className="shrink-0 text-center mt-4 mb-6 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">{t('title')}</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
        <div className="max-w-[560px] mx-auto flex flex-col gap-5">

          <div className="bg-[#E8ECE4] rounded-xl p-3.5 flex items-start gap-2.5">
            <Info size={16} className="text-[#6B7F5E] shrink-0 mt-0.5" />
            <div className="text-sm text-[#3D4A35] leading-relaxed">
              <p className="font-semibold">{t('eventTime')}</p>
              <p className="mt-1 text-[#6B6157]">{t('eventTimeNote')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6157] pointer-events-none" />
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onBlur={() => handleBlur('contactName')}
                placeholder={`${t('contactName')} *`}
                aria-label={t('contactName')}
                aria-invalid={touched.contactName && !!errors.contactName}
                style={{ border: touched.contactName && errors.contactName ? '1px solid #C4453A' : '1px solid #E8ECE4', outline: 'none' }}
                className="w-full h-[52px] rounded-xl pl-11 pr-4 text-base bg-white text-[#1A1208] placeholder:text-[#6B6157] focus:!border-[#6B7F5E] transition-colors"
              />
            </div>
            {touched.contactName && errors.contactName && (
              <div className="flex items-center gap-1.5 text-[#C4453A] mt-1">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-sm">{errors.contactName}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6157] pointer-events-none" />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                onBlur={() => handleBlur('contactEmail')}
                placeholder={`${t('email')} *`}
                aria-label={t('email')}
                aria-invalid={touched.contactEmail && !!errors.contactEmail}
                style={{ border: touched.contactEmail && errors.contactEmail ? '1px solid #C4453A' : '1px solid #E8ECE4', outline: 'none' }}
                className="w-full h-[52px] rounded-xl pl-11 pr-4 text-base bg-white text-[#1A1208] placeholder:text-[#6B6157] focus:!border-[#6B7F5E] transition-colors"
              />
            </div>
            {touched.contactEmail && errors.contactEmail && (
              <div className="flex items-center gap-1.5 text-[#C4453A] mt-1">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-sm">{errors.contactEmail}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6157] pointer-events-none" />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(formatPhoneUS(e.target.value))}
                onBlur={() => handleBlur('contactPhone')}
                placeholder={`${t('phoneNumber')} *`}
                aria-label={t('phoneNumber')}
                aria-invalid={touched.contactPhone && !!errors.contactPhone}
                style={{ border: touched.contactPhone && errors.contactPhone ? '1px solid #C4453A' : '1px solid #E8ECE4', outline: 'none' }}
                className="w-full h-[52px] rounded-xl pl-11 pr-4 text-base bg-white text-[#1A1208] placeholder:text-[#6B6157] focus:!border-[#6B7F5E] transition-colors"
              />
            </div>
            {touched.contactPhone && errors.contactPhone && (
              <div className="flex items-center gap-1.5 text-[#C4453A] mt-1">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-sm">{errors.contactPhone}</span>
              </div>
            )}
          </div>

          <GuestCountPicker
            value={guestCount}
            onChange={setGuestCount}
            softThreshold={selfServeCap}
            minRecommended={minRecommended}
          />
          {touched.guestCount && errors.guestCount && (
            <div className="flex items-center gap-1.5 text-[#C4453A] -mt-3">
              <AlertCircle size={14} className="shrink-0" />
              <span className="text-sm">{errors.guestCount}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleInquireEscape}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-[#C4A45C] bg-[#FEFBF4] hover:bg-[#FDF5E6] transition-colors cursor-pointer text-left"
          >
            <MessageCircle size={20} className="text-[#8B6914] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#2C2416]">{tPicker('notSurePrompt')}</p>
              <p className="text-xs text-[#6B6157] mt-0.5">{tPicker('notSureCta')} →</p>
            </div>
          </button>

          {goingToInquiry && (
            <div className="bg-[#FDF5E6] border-2 border-[#C4A45C] rounded-xl p-4 flex items-start gap-3 shadow-[0_2px_8px_rgba(196,164,92,0.15)]">
              <MessageCircle size={20} className="text-[#8B6914] shrink-0 mt-0.5" />
              <div className="text-sm text-[#5A4A1A] leading-relaxed">
                <p className="font-semibold text-[15px]">{t('inquiryBanner.title')}</p>
                <p className="mt-1">{t(inquiryReasonKey, { cap: selfServeCap })}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder={t('specialRequestsPlaceholder')}
              aria-label={t('specialRequests')}
              style={{ border: '1px solid #E8ECE4', outline: 'none' }}
              className="min-h-[100px] px-4 py-3 rounded-xl text-base text-[#1A1208] resize-none placeholder:text-[#6B6157] bg-white focus:!border-[#6B7F5E] transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 p-4 pb-6 bg-[#F8F7F4]">
        <div className="max-w-[560px] mx-auto">
          <button
            onClick={handleNext}
            disabled={!isValid}
            aria-label={!isValid ? 'Please complete required fields' : goingToInquiry ? t('continueAsInquiry') : 'Continue to confirmation'}
            className={`w-full py-3.5 rounded-full text-base font-medium border-none transition-all flex items-center justify-center gap-2 ${
              !isValid
                ? 'bg-[#6B7F5E] text-white opacity-40 cursor-not-allowed'
                : goingToInquiry
                  ? 'bg-[#C4A45C] text-white cursor-pointer shadow-[0_2px_8px_rgba(196,164,92,0.3)]'
                  : 'bg-[#6B7F5E] text-white cursor-pointer shadow-[0_2px_8px_rgba(107,127,94,0.25)]'
            }`}
          >
            {goingToInquiry ? t('continueAsInquiry') : tCommon('next')}
            {goingToInquiry ? <MessageCircle size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
