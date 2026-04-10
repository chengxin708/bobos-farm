"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Tent, Users, MessageSquare, Upload, Copy, Check, Loader2, Clock, X, FileText, AlertCircle, Shield } from 'lucide-react'
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
  const { data: settings } = useSWR<Record<string, string>>('/api/settings/public', settingsFetcher)
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
  const [isDragOver, setIsDragOver] = useState(false)
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

  // Derive urgency from countdown
  const countdownHours = parseInt(countdown.split(':')[0], 10)
  const isUrgent = countdownHours < 6

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
      setIsDragOver(false)
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
        <div className="w-full max-w-[600px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red/10 flex items-center justify-center">
            <AlertCircle size={28} className="text-red" />
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

  // Expired state -- countdown reached 0
  if (expired && !submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 gap-6">
        <div className="w-full max-w-[600px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F4A623]/10 flex items-center justify-center">
            <Clock size={28} className="text-[#F4A623]" />
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

  const zelleEmail = settings?.zelle_recipient || 'jenny@bobosfarm.com'
  const zelleRecipientName = settings?.zelle_recipient_name || ''
  const zelleDisplay = zelleRecipientName ? `${zelleRecipientName} (${zelleEmail})` : zelleEmail

  return (
    <>
      {/* Two-column content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-8">
          <div className="flex flex-col md:flex-row gap-6 lg:gap-8">

            {/* ============================================
                Mobile: Summary on top (shown only on small)
                ============================================ */}
            <div className="md:hidden flex flex-col gap-4">
              {/* Reservation Summary Card */}
              <div className="bg-white rounded-xl border border-[#E8E2D9] p-5">
                <h3 className="font-playfair text-lg font-bold text-brown mb-4">
                  {t('summaryTitle')}
                </h3>
                <div className="flex flex-col gap-3">
                  {summaryRows.map((row, i) => (
                    <div key={row.labelKey}>
                      <div className="flex items-start gap-3">
                        <row.icon size={16} className="text-amber mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] uppercase tracking-wider text-[#8A7E6B]">
                            {t(`summaryLabels.${row.labelKey}`)}
                          </div>
                          <div className="text-sm font-semibold text-brown truncate">
                            {row.value}
                          </div>
                        </div>
                      </div>
                      {i < summaryRows.length - 1 && (
                        <div className="h-px bg-[#E8E2D9] mt-3 ml-7" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Deposit + Timer row (mobile) */}
              <div className="flex gap-3">
                <div className="flex-1 bg-white rounded-xl border border-[#E8E2D9] p-4 flex flex-col items-center justify-center">
                  <span className="text-[11px] uppercase tracking-wider text-[#8A7E6B] mb-1">{t('depositRequired')}</span>
                  <span className="text-3xl font-bold text-amber font-playfair">${DEPOSIT_AMOUNT}</span>
                </div>
                <div className={`flex-1 rounded-xl border p-4 flex flex-col items-center justify-center ${
                  isUrgent
                    ? 'bg-red/5 border-red/20'
                    : 'bg-green-light border-green/20'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock size={12} className={isUrgent ? 'text-red' : 'text-green'} />
                    <span className={`text-[11px] uppercase tracking-wider ${isUrgent ? 'text-red' : 'text-green'}`}>
                      Time Left
                    </span>
                  </div>
                  <span className={`text-2xl font-bold font-mono tabular-nums ${isUrgent ? 'text-red' : 'text-brown'}`}>
                    {countdown}
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================
                Left Column -- Payment Instructions + Upload
                ============================================ */}
            <div className="flex-1 md:flex-[3] flex flex-col gap-6">

              {/* How to Pay */}
              <div className="bg-white rounded-xl border border-[#E8E2D9] p-6 md:p-8">
                <h3 className="font-playfair text-xl md:text-2xl font-bold text-brown mb-6">
                  {t('howToPay')}
                </h3>

                <div className="flex flex-col gap-5">
                  {/* Step 1 */}
                  <div className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-md bg-amber text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="pt-0.5">
                      <span className="text-sm text-brown leading-relaxed">{t('step1')}</span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-md bg-amber text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm text-brown leading-relaxed pt-0.5">{t('step2')}</span>
                      <button
                        onClick={() => copyToClipboard(zelleEmail, 'step-2')}
                        className="inline-flex items-center gap-2.5 bg-amber/8 hover:bg-amber/15 rounded-lg px-3.5 py-2 border-none cursor-pointer transition-colors group w-fit"
                      >
                        <span className="text-sm font-semibold text-amber font-mono tracking-wide">
                          {zelleDisplay}
                        </span>
                        {copiedField === 'step-2' ? (
                          <span className="flex items-center gap-1 text-green text-xs font-medium">
                            <Check size={13} />
                            Copied!
                          </span>
                        ) : (
                          <Copy size={13} className="text-amber/60 group-hover:text-amber transition-colors" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-md bg-amber text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm text-brown leading-relaxed pt-0.5">{t('step3')}</span>
                      <button
                        onClick={() => copyToClipboard(paymentMemo, 'step-3')}
                        className="inline-flex items-center gap-2.5 bg-amber/8 hover:bg-amber/15 rounded-lg px-3.5 py-2 border-none cursor-pointer transition-colors group w-fit"
                      >
                        <span className="text-sm font-semibold text-amber font-mono tracking-wide">
                          {paymentMemo}
                        </span>
                        {copiedField === 'step-3' ? (
                          <span className="flex items-center gap-1 text-green text-xs font-medium">
                            <Check size={13} />
                            Copied!
                          </span>
                        ) : (
                          <Copy size={13} className="text-amber/60 group-hover:text-amber transition-colors" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="bg-white rounded-xl border border-[#E8E2D9] p-6 md:p-8">
                <h4 className="text-sm font-semibold text-brown mb-4 flex items-center gap-2">
                  <Upload size={16} className="text-amber" />
                  Payment Proof
                </h4>

                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                    uploadedFile
                      ? 'border-green/40 bg-green-light/40 p-4'
                      : isDragOver
                        ? 'border-amber bg-amber-light/50 p-8'
                        : 'border-[#E8E2D9] hover:border-amber/40 hover:bg-amber-light/20 p-8'
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
                    <div className="flex items-center gap-4">
                      {uploadPreview ? (
                        <img
                          src={uploadPreview}
                          alt="Payment screenshot"
                          className="w-16 h-16 rounded-lg object-cover border border-[#E8E2D9]"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-green/10 flex items-center justify-center">
                          <FileText size={24} className="text-green" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brown truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-[#8A7E6B] mt-0.5">
                          {(uploadedFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setUploadedFile(null)
                          setUploadPreview(prev => {
                            if (prev) URL.revokeObjectURL(prev)
                            return null
                          })
                        }}
                        className="w-8 h-8 rounded-full bg-brown/5 hover:bg-red/10 flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
                      >
                        <X size={14} className="text-brown/40" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-12 h-12 rounded-full bg-amber/8 flex items-center justify-center">
                        <Upload size={22} className="text-amber/60" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-brown/70">{t('uploadTitle')}</p>
                        <p className="text-[13px] text-amber font-semibold mt-1">{t('uploadBrowse')}</p>
                      </div>
                      <p className="text-[11px] text-[#8A7E6B]">{t('uploadFormats')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {error && created && (
                <div className="flex items-center gap-3 bg-red/5 border border-red/15 text-red text-sm rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Cancel link -- desktop only, bottom of left column */}
              <div className="hidden md:block">
                <button
                  onClick={handleCancel}
                  className="text-[13px] text-[#8A7E6B] border-none bg-transparent cursor-pointer hover:text-red transition-colors"
                >
                  {t('cancelReservation')}
                </button>
              </div>
            </div>

            {/* ============================================
                Right Column -- Sticky Sidebar
                ============================================ */}
            <div className="md:flex-[2] flex flex-col gap-4">
              <div className="md:sticky md:top-6 flex flex-col gap-4">

                {/* Reservation Summary Card (desktop only) */}
                <div className="hidden md:block bg-white rounded-xl border border-[#E8E2D9] p-5">
                  <h3 className="font-playfair text-lg font-bold text-brown mb-4">
                    {t('summaryTitle')}
                  </h3>
                  <div className="flex flex-col gap-3">
                    {summaryRows.map((row, i) => (
                      <div key={row.labelKey}>
                        <div className="flex items-start gap-3">
                          <row.icon size={16} className="text-amber mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] uppercase tracking-wider text-[#8A7E6B]">
                              {t(`summaryLabels.${row.labelKey}`)}
                            </div>
                            <div className="text-sm font-semibold text-brown">
                              {row.value}
                            </div>
                          </div>
                        </div>
                        {i < summaryRows.length - 1 && (
                          <div className="h-px bg-[#E8E2D9] mt-3 ml-7" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deposit Amount Card (desktop only) */}
                <div className="hidden md:flex bg-white rounded-xl border border-[#E8E2D9] p-5 flex-col items-center">
                  <span className="text-[11px] uppercase tracking-wider text-[#8A7E6B] mb-1">
                    {t('depositRequired')}
                  </span>
                  <span className="text-4xl font-bold text-amber font-playfair">
                    ${DEPOSIT_AMOUNT}
                  </span>
                </div>

                {/* Countdown Timer Card (desktop only) */}
                <div className={`hidden md:flex rounded-xl border p-5 flex-col items-center gap-1.5 ${
                  isUrgent
                    ? 'bg-red/5 border-red/20'
                    : 'bg-green-light border-green/20'
                }`}>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={isUrgent ? 'text-red' : 'text-green'} />
                    <span className={`text-xs font-medium uppercase tracking-wider ${isUrgent ? 'text-red' : 'text-green'}`}>
                      Time Remaining
                    </span>
                  </div>
                  <span className={`text-3xl font-bold font-mono tabular-nums tracking-wider ${
                    isUrgent ? 'text-red' : 'text-brown'
                  }`}>
                    {countdown}
                  </span>
                  <span className="text-[11px] text-[#8A7E6B]">
                    {t('countdownSub')}
                  </span>
                </div>

                {/* Policy + Submit Card */}
                <div className="bg-white rounded-xl border border-[#E8E2D9] p-5 flex flex-col gap-4">
                  {/* Checkbox */}
                  <label className="flex gap-3 cursor-pointer select-none">
                    <button
                      type="button"
                      onClick={() => setAcceptedTerms(!acceptedTerms)}
                      className={`w-[18px] h-[18px] rounded border-[1.5px] shrink-0 mt-0.5 flex items-center justify-center cursor-pointer transition-colors ${
                        acceptedTerms ? 'bg-amber border-amber' : 'border-beige bg-white hover:border-amber/50'
                      }`}
                    >
                      {acceptedTerms && <Check size={12} className="text-white" />}
                    </button>
                    <span className="text-xs text-[#8A7E6B] leading-relaxed">
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
                    className={`h-[52px] rounded-xl text-white text-[15px] font-semibold border-none w-full transition-all flex items-center justify-center gap-2 ${
                      acceptedTerms && !submitting
                        ? 'bg-amber hover:bg-amber/90 cursor-pointer shadow-[0_4px_16px_rgba(184,134,11,0.25)] hover:shadow-[0_6px_20px_rgba(184,134,11,0.35)] btn-warm'
                        : 'bg-[#BFBFBF] cursor-not-allowed'
                    }`}
                  >
                    {submitting && <Loader2 size={18} className="animate-spin" />}
                    {submitting ? 'Submitting...' : t('completedTransfer')}
                  </button>

                  {/* Security note */}
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#8A7E6B]">
                    <Shield size={11} />
                    <span>Secure &amp; encrypted</span>
                  </div>
                </div>

                {/* Cancel -- mobile only */}
                <div className="md:hidden text-center mt-1">
                  <button
                    onClick={handleCancel}
                    className="text-[13px] text-[#8A7E6B] border-none bg-transparent cursor-pointer hover:text-red transition-colors"
                  >
                    {t('cancelReservation')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar with Back button */}
      <div className="h-14 shrink-0 bg-white border-t border-[#E8E2D9] flex items-center justify-between px-4 sm:px-6 lg:px-10">
        <button
          onClick={() => router.push('/booking/details')}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-brown border-none bg-transparent cursor-pointer hover:text-amber transition-colors"
        >
          <ArrowLeft size={16} /> Back to Details
        </button>
        <div />
      </div>
    </>
  )
}
