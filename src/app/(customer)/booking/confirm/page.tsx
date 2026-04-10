"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Tent, Users, MessageSquare, Upload, Copy, Check, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { useBooking } from '@/contexts/BookingContext'

const settingsFetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

export default function BookingConfirmPage() {
  const t = useTranslations('booking.confirm')
  const router = useRouter()
  const booking = useBooking()
  const { data: settings } = useSWR('/api/settings', settingsFetcher)
  const DEPOSIT_AMOUNT = settings?.deposit_amount ? Number(settings.deposit_amount) : 300

  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('12:00:00')
  const [expired, setExpired] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uploadPreviewRef = useRef<string | null>(null)
  const creationAttempted = useRef(false)

  // Keep ref in sync for cleanup
  useEffect(() => {
    uploadPreviewRef.current = uploadPreview
  }, [uploadPreview])

  // Cleanup blob URLs and timers on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      if (uploadPreviewRef.current) URL.revokeObjectURL(uploadPreviewRef.current)
    }
  }, [])

  // Redirect back if no booking details (only after hydration to prevent false redirect on refresh)
  useEffect(() => {
    if (booking.hydrated && (!booking.selectedDate || !booking.selectedYurtId || !booking.contactName)) {
      router.replace('/booking/date')
    }
  }, [booking.hydrated, booking.selectedDate, booking.selectedYurtId, booking.contactName, router])

  // Create reservation when arriving at this page (after hydration)
  useEffect(() => {
    if (!booking.hydrated) return
    if (creationAttempted.current) return
    if (!booking.selectedDate || !booking.selectedYurtId) return
    // If reservation already exists (coming back from navigation)
    if (booking.reservationId) {
      setCreated(true)
      return
    }

    creationAttempted.current = true
    createReservation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.hydrated, booking.selectedDate, booking.selectedYurtId])

  async function createReservation() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yurtId: booking.selectedYurtId,
          date: booking.selectedDate,
          guestCount: booking.guestCount,
          specialRequests: booking.specialRequests || undefined,
        }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent('/booking/confirm')}`)
          return
        }
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create reservation')
      }

      const reservation = await res.json()
      booking.setReservation(reservation.id, reservation.paymentDeadline)
      setCreated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      creationAttempted.current = false // allow retry
    } finally {
      setCreating(false)
    }
  }

  // Countdown timer
  useEffect(() => {
    if (!booking.paymentDeadline) return

    function updateCountdown() {
      const deadline = new Date(booking.paymentDeadline!).getTime()
      const now = Date.now()
      const diff = Math.max(0, deadline - now)

      if (diff === 0) {
        setCountdown('00:00:00')
        setExpired(true)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      )
    }

    updateCountdown()
    timerRef.current = setInterval(updateCountdown, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [booking.paymentDeadline])

  // File upload handler
  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, or PDF file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB')
      return
    }
    setUploadedFile(file)
    setError(null)
    if (file.type.startsWith('image/')) {
      // Revoke previous blob URL to avoid memory leak
      setUploadPreview(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(file)
      })
    } else {
      setUploadPreview(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [])

  // Drop handler
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (file) handleFileChange(file)
    },
    [handleFileChange]
  )

  // Copy to clipboard
  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // fallback - ignore
    }
  }

  // Upload screenshot to Supabase Storage via API route
  async function uploadScreenshot(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('reservationId', booking.reservationId!)

    const res = await fetch('/api/reservations/upload-screenshot', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to upload screenshot')
    }

    const data = await res.json()
    return data.url
  }

  // Submit payment
  async function handleSubmitPayment() {
    if (!booking.reservationId || !acceptedTerms) return
    setSubmitting(true)
    setError(null)

    try {
      // Upload screenshot if provided
      let screenshotUrl: string | null = null
      if (uploadedFile) {
        screenshotUrl = await uploadScreenshot(uploadedFile)
      }

      const res = await fetch(`/api/reservations/${booking.reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_payment',
          paymentReference: `BOBO-${booking.selectedDate?.replace(/-/g, '')}-${booking.contactName.split(' ')[0]?.toUpperCase()}`,
          ...(screenshotUrl ? { paymentScreenshotUrl: screenshotUrl } : {}),
        }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?callbackUrl=${encodeURIComponent('/booking/confirm')}`)
          return
        }
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit payment')
      }

      setSubmitted(true)
      // Redirect to reservations after short delay
      redirectTimerRef.current = setTimeout(() => {
        booking.resetBooking()
        router.push('/reservations')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel reservation
  async function handleCancel() {
    if (!booking.reservationId) return
    try {
      await fetch(`/api/reservations/${booking.reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: 'User cancelled during booking' }),
      })
    } catch {
      // ignore cancel errors
    }
    booking.resetBooking()
    router.push('/booking/date')
  }

  // Format date for display
  const formattedDate = booking.selectedDate
    ? new Date(booking.selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const paymentMemo = `BOBO-${booking.selectedDate?.replace(/-/g, '') || ''}-${booking.contactName.split(' ')[0]?.toUpperCase() || ''}`

  // Show spinner while hydrating from sessionStorage
  if (!booking.hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-[3px] border-beige border-t-amber animate-spin" />
      </div>
    )
  }

  if (!booking.selectedDate || !booking.selectedYurtId) return null

  // Success state
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 gap-6">
        <div className="w-20 h-20 rounded-full bg-green flex items-center justify-center">
          <Check size={40} className="text-white" />
        </div>
        <h2 className="font-playfair text-2xl font-bold text-brown text-center">
          Payment Submitted!
        </h2>
        <p className="text-brown/60 text-center max-w-md">
          Your reservation is being processed. You&apos;ll receive a confirmation email once your deposit is verified.
        </p>
        <p className="text-sm text-[#8E8E93]">Redirecting to your reservations...</p>
      </div>
    )
  }

  // Creating state
  if (creating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 gap-4">
        <Loader2 size={40} className="text-amber animate-spin" />
        <p className="text-brown/60">Creating your reservation...</p>
      </div>
    )
  }

  // Error state (failed to create)
  if (error && !created) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 gap-4">
        <div className="w-[600px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red/10 flex items-center justify-center">
            <span className="text-red text-2xl font-bold">!</span>
          </div>
          <h3 className="font-playfair text-xl font-bold text-brown">Booking Failed</h3>
          <p className="text-sm text-brown/60 text-center">{error}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => router.push('/booking/date')}
              className="px-6 py-2.5 rounded-xl border border-beige text-brown text-sm font-medium cursor-pointer bg-white"
            >
              Start Over
            </button>
            <button
              onClick={createReservation}
              className="px-6 py-2.5 rounded-xl bg-amber text-white text-sm font-semibold cursor-pointer border-none"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Expired state — countdown reached 0
  if (expired && !submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 gap-6">
        <div className="w-[600px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F4A623]/10 flex items-center justify-center">
            <span className="text-[#F4A623] text-2xl font-bold">&#x23f0;</span>
          </div>
          <h3 className="font-playfair text-xl font-bold text-brown">Time Expired</h3>
          <p className="text-sm text-brown/60 text-center max-w-md">
            Your payment window has expired and the reservation hold has been released.
            Please start a new booking to reserve your spot.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => {
                booking.resetBooking()
                router.push('/booking/date')
              }}
              className="px-6 py-2.5 rounded-xl bg-amber text-white text-sm font-semibold cursor-pointer border-none"
            >
              Start New Booking
            </button>
            <button
              onClick={() => router.push('/reservations')}
              className="px-6 py-2.5 rounded-xl border border-beige text-brown text-sm font-medium cursor-pointer bg-white"
            >
              View Reservations
            </button>
          </div>
        </div>
      </div>
    )
  }

  const summaryRows = [
    { icon: Calendar, labelKey: 'date' as const, value: formattedDate },
    {
      icon: Tent,
      labelKey: 'yurt' as const,
      value: `${booking.selectedYurt?.name || ''} (up to ${booking.selectedYurt?.capacity || 0} guests)`,
    },
    { icon: Users, labelKey: 'guests' as const, value: String(booking.guestCount) },
    {
      icon: MessageSquare,
      labelKey: 'specialRequests' as const,
      value: booking.specialRequests || 'None',
    },
  ]

  const paymentSteps = [
    { num: 1, textKey: 'step1' as const, highlight: null },
    { num: 2, textKey: 'step2' as const, highlight: 'jenny@bobosfarm.com' },
    { num: 3, textKey: 'step3' as const, highlight: paymentMemo },
  ]

  return (
    <>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 sm:px-10 lg:px-20 gap-6 overflow-y-auto">
        {/* Reservation Summary */}
        <div className="w-[600px] bg-[#FEFCF3] rounded-2xl p-6 border-[1.5px] border-beige flex flex-col gap-5">
          <h3 className="font-playfair text-xl font-bold text-brown">{t('summaryTitle')}</h3>
          <div className="h-px bg-beige" />
          <div className="flex flex-col gap-4">
            {summaryRows.map((row) => (
              <div key={row.labelKey} className="flex items-start gap-3">
                <row.icon size={18} className="text-amber mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-brown/53">{t(`summaryLabels.${row.labelKey}`)}</div>
                  <div className="text-sm font-medium text-brown">{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Card */}
        <div className="w-[600px] bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="font-playfair text-xl font-bold text-brown">{t('depositRequired')}</h3>
            <span className="font-playfair text-3xl font-bold text-amber">${DEPOSIT_AMOUNT}</span>
          </div>
          <div className="h-px bg-beige" />

          <p className="text-base font-bold text-brown">{t('howToPay')}</p>

          <div className="flex flex-col gap-4.5">
            {paymentSteps.map((step) => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-brown">{t(step.textKey)}</span>
                  {step.highlight && (
                    <button
                      onClick={() => copyToClipboard(step.highlight!, `step-${step.num}`)}
                      className="flex items-center gap-2 bg-amber-light rounded-lg px-3 py-1.5 border-none cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-amber">{step.highlight}</span>
                      {copiedField === `step-${step.num}` ? (
                        <Check size={14} className="text-green" />
                      ) : (
                        <Copy size={14} className="text-amber" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Countdown */}
          <div className="bg-[#F4A623] rounded-lg px-4 py-3.5 flex flex-col items-center gap-1">
            <span className="text-sm font-bold text-white">
              &#x23f0; {t('countdown', { time: countdown })}
            </span>
            <span className="text-xs text-white/80">{t('countdownSub')}</span>
          </div>

          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`h-[180px] border-[1.5px] border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
              uploadedFile ? 'border-green bg-green-light/30' : 'border-beige hover:border-amber/50 hover:bg-amber-light/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            {uploadedFile ? (
              <>
                {uploadPreview ? (
                  <img
                    src={uploadPreview}
                    alt="Payment screenshot"
                    className="h-24 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-green/10 flex items-center justify-center">
                    <Check size={24} className="text-green" />
                  </div>
                )}
                <span className="text-sm text-green font-medium">{uploadedFile.name}</span>
                <span className="text-[11px] text-brown/40">Click to change</span>
              </>
            ) : (
              <>
                <Upload size={32} className="text-beige" />
                <span className="text-sm text-brown/53">{t('uploadTitle')}</span>
                <span className="text-[13px] text-amber font-semibold">{t('uploadBrowse')}</span>
                <span className="text-[11px] text-brown/33">{t('uploadFormats')}</span>
              </>
            )}
          </div>

          {/* Error message */}
          {error && created && (
            <div className="bg-red/10 text-red text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Checkbox */}
          <label className="flex gap-3 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setAcceptedTerms(!acceptedTerms)}
              className={`w-[18px] h-[18px] rounded border-[1.5px] shrink-0 mt-0.5 flex items-center justify-center cursor-pointer ${
                acceptedTerms ? 'bg-amber border-amber' : 'border-beige bg-white'
              }`}
            >
              {acceptedTerms && <Check size={12} className="text-white" />}
            </button>
            <span className="text-xs text-brown/53 leading-relaxed">
              {t('cancellationPolicyText')}{' '}
              <Link href="/cancellation" className="text-amber font-medium no-underline hover:underline">
                {t('cancellationPolicyLink')}
              </Link>
            </span>
          </label>

          {/* Submit Button */}
          <button
            onClick={handleSubmitPayment}
            disabled={!acceptedTerms || submitting}
            className={`h-[52px] rounded-2xl text-white text-base font-semibold border-none w-full transition-colors flex items-center justify-center gap-2 ${
              acceptedTerms && !submitting
                ? 'bg-gradient-to-r from-amber to-[#A67C2E] cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)]'
                : 'bg-[#BFBFBF] cursor-not-allowed'
            }`}
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? 'Submitting...' : t('completedTransfer')}
          </button>

          <button
            onClick={handleCancel}
            className="text-[13px] text-[#8E8E93] text-center border-none bg-transparent cursor-pointer hover:text-red transition-colors"
          >
            {t('cancelReservation')}
          </button>
        </div>
      </div>

      {/* Bottom Bar with Back button */}
      <div className="h-16 shrink-0 bg-white border-t border-beige flex items-center justify-between px-4 sm:px-10 lg:px-20">
        <button
          onClick={() => router.push('/booking/details')}
          className="flex items-center gap-2 px-4 py-2.5 text-[15px] font-medium text-brown border-none bg-transparent cursor-pointer"
        >
          <ArrowLeft size={18} /> Back to Details
        </button>
        <div />
      </div>
    </>
  )
}
