"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Calendar, Tent, Users, Mail, Upload, Copy, Check, CheckCircle, Loader2, Clock, X, FileText, AlertCircle } from 'lucide-react'
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

  const zelleEmail = settings?.zelle_recipient || 'jenny@bobosfarm.com'
  const zelleRecipientName = settings?.zelle_recipient_name || ''
  const zelleDisplay = zelleRecipientName ? `${zelleRecipientName} (${zelleEmail})` : zelleEmail

  // Show spinner while hydrating from sessionStorage
  if (!booking.hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <Loader2 size={32} className="text-[#C47D52] animate-spin" />
      </div>
    )
  }

  if (!booking.selectedDate || !booking.selectedYurtId) return null

  // ============ Success state ============
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 gap-5">
        <div className="w-16 h-16 rounded-full bg-[#6B7F5E] flex items-center justify-center">
          <CheckCircle size={36} className="text-white" />
        </div>
        <h2 className="font-serif text-2xl text-[#1A1208] text-center">
          Reservation Confirmed!
        </h2>
        <p className="text-sm text-[#8C8478] text-center">
          Redirecting to your reservations...
        </p>
      </div>
    )
  }

  // ============ Creating state ============
  if (creating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 gap-4">
        <Loader2 size={36} className="text-[#C47D52] animate-spin" />
        <p className="text-sm text-[#8C8478]">Creating your reservation...</p>
      </div>
    )
  }

  // ============ Error state (failed to create) ============
  if (error && !created) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 gap-5">
        <div className="w-16 h-16 rounded-full bg-[#C4453A]/10 flex items-center justify-center">
          <AlertCircle size={28} className="text-[#C4453A]" />
        </div>
        <h3 className="font-serif text-xl text-[#1A1208]">Booking Failed</h3>
        <p className="text-sm text-[#8C8478] text-center max-w-sm">{error}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => router.push('/booking/date')}
            className="px-6 py-2.5 rounded-full border border-[#D6D1CA] text-[#1A1208] text-sm font-medium cursor-pointer bg-white"
          >
            Start Over
          </button>
          <button
            onClick={createReservation}
            className="px-6 py-2.5 rounded-full bg-[#C47D52] text-white text-sm font-medium cursor-pointer border-none"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ============ Expired state ============
  if (expired && !submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 gap-5">
        <div className="w-16 h-16 rounded-full bg-[#C4453A]/10 flex items-center justify-center">
          <Clock size={28} className="text-[#C4453A]" />
        </div>
        <h3 className="font-serif text-xl text-[#1A1208]">Payment Deadline Expired</h3>
        <p className="text-sm text-[#8C8478] text-center max-w-sm">
          Please start a new booking
        </p>
        <Link
          href="/booking/date"
          onClick={() => booking.resetBooking()}
          className="mt-2 px-6 py-2.5 rounded-full bg-[#C47D52] text-white text-sm font-medium no-underline"
        >
          Start New Booking
        </Link>
      </div>
    )
  }

  // ============ Main confirm UI ============
  const summaryCard = (
    <div className="bg-[#F2EDE6] rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="font-serif text-lg text-[#1A1208]">Your Reservation</h3>

      <div className="flex flex-col gap-3">
        {/* Date */}
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-[#8C8478] shrink-0" />
          <span className="text-sm text-[#1A1208]">{formattedDate}</span>
        </div>
        {/* Yurt */}
        <div className="flex items-center gap-3">
          <Tent size={16} className="text-[#8C8478] shrink-0" />
          <span className="text-sm text-[#1A1208]">{booking.selectedYurt?.name || ''}</span>
        </div>
        {/* Guests */}
        <div className="flex items-center gap-3">
          <Users size={16} className="text-[#8C8478] shrink-0" />
          <span className="text-sm text-[#1A1208]">{booking.guestCount} guests</span>
        </div>
        {/* Email */}
        <div className="flex items-center gap-3">
          <Mail size={16} className="text-[#8C8478] shrink-0" />
          <span className="text-sm text-[#1A1208]">{booking.contactEmail}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#D6D1CA]" />

      {/* Deposit */}
      <div className="text-center">
        <div className="text-xs text-[#8C8478] mb-1">{t('depositRequired')}</div>
        <div className="text-[#C47D52] text-xl font-serif font-medium">${DEPOSIT_AMOUNT}</div>
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-center gap-2">
        <Clock size={14} className={isUrgent ? 'text-[#C4453A]' : 'text-[#8C8478]'} />
        <span className={`text-sm font-mono tabular-nums ${isUrgent ? 'text-[#C4453A]' : 'text-[#8C8478]'}`}>
          Payment due in {countdown}
        </span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-[#F8F7F4] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/booking/details')}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label="Back"
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <span className="text-sm text-[#8C8478]">Step 4 of 4</span>
      </div>

      {/* Page Title */}
      <div className="text-center mt-4 mb-6 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">Confirm &amp; Pay</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6">

            {/* ===== Mobile: Summary card on top ===== */}
            <div className="md:hidden">
              {summaryCard}
            </div>

            {/* ===== Left Column: Payment + Upload ===== */}
            <div className="flex-1 flex flex-col gap-6">

              {/* Payment Instructions */}
              <div className="flex flex-col gap-4">
                <h2 className="font-serif text-lg text-[#1A1208]">Payment Instructions</h2>

                <div className="flex flex-col gap-4">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F2EDE6] text-[#8C8478] text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span className="text-sm text-[#3D3229] leading-relaxed pt-0.5">Open Zelle in your bank app</span>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F2EDE6] text-[#8C8478] text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div className="flex flex-col gap-2 pt-0.5">
                      <span className="text-sm text-[#3D3229] leading-relaxed">
                        Send to: <span className="font-medium">{zelleDisplay}</span>
                      </span>
                      <button
                        onClick={() => copyToClipboard(zelleEmail, 'email')}
                        className="inline-flex items-center gap-1.5 border border-[#6B7F5E] text-[#6B7F5E] rounded-full px-3 py-1 text-xs font-medium bg-transparent cursor-pointer hover:bg-[#6B7F5E]/5 transition-colors w-fit"
                      >
                        {copiedField === 'email' ? (
                          <>
                            <Check size={12} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F2EDE6] text-[#8C8478] text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span className="text-sm text-[#3D3229] leading-relaxed pt-0.5">Amount: <span className="font-medium">${DEPOSIT_AMOUNT}</span></span>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F2EDE6] text-[#8C8478] text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <div className="flex flex-col gap-2 pt-0.5">
                      <span className="text-sm text-[#3D3229] leading-relaxed">
                        Memo: <span className="font-mono font-medium">{paymentMemo}</span>
                      </span>
                      <button
                        onClick={() => copyToClipboard(paymentMemo, 'memo')}
                        className="inline-flex items-center gap-1.5 border border-[#6B7F5E] text-[#6B7F5E] rounded-full px-3 py-1 text-xs font-medium bg-transparent cursor-pointer hover:bg-[#6B7F5E]/5 transition-colors w-fit"
                      >
                        {copiedField === 'memo' ? (
                          <>
                            <Check size={12} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#F2EDE6] text-[#8C8478] text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">5</span>
                    <span className="text-sm text-[#3D3229] leading-relaxed pt-0.5">Upload screenshot below</span>
                  </div>
                </div>
              </div>

              {/* Upload Zone */}
              <div className="flex flex-col gap-3">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                    uploadedFile
                      ? 'border-[#6B7F5E]/40 bg-[#E8ECE4]/30 p-4'
                      : isDragOver
                        ? 'border-[#6B7F5E] bg-[#E8ECE4]/50 p-8'
                        : 'border-[#E8ECE4] hover:border-[#6B7F5E]/40 p-8'
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
                          className="w-14 h-14 rounded-xl object-cover border border-[#E8ECE4]"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-[#6B7F5E]/10 flex items-center justify-center">
                          <FileText size={22} className="text-[#6B7F5E]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1208] truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-[#8C8478] mt-0.5">
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
                        className="w-8 h-8 rounded-full bg-[#1A1208]/5 hover:bg-[#C4453A]/10 flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
                      >
                        <X size={14} className="text-[#8C8478]" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <Upload size={24} className="text-[#6B7F5E]" />
                      <div className="text-center">
                        <p className="text-sm text-[#3D3229]">Upload payment proof</p>
                        <p className="text-xs text-[#8C8478] mt-1">Tap or drag file here</p>
                      </div>
                      <p className="text-[11px] text-[#8C8478]">JPG, PNG, PDF (max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {error && created && (
                <div className="flex items-center gap-3 bg-[#C4453A]/5 border border-[#C4453A]/15 text-[#C4453A] text-sm rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Terms Checkbox */}
              <label className="flex gap-3 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setAcceptedTerms(!acceptedTerms)}
                  className={`w-[18px] h-[18px] rounded border-[1.5px] shrink-0 mt-0.5 flex items-center justify-center cursor-pointer transition-colors ${
                    acceptedTerms ? 'bg-[#6B7F5E] border-[#6B7F5E]' : 'border-[#D6D1CA] bg-white hover:border-[#6B7F5E]/50'
                  }`}
                >
                  {acceptedTerms && <Check size={12} className="text-white" />}
                </button>
                <span className="text-xs text-[#8C8478] leading-relaxed">
                  {t('cancellationPolicyText')}{' '}
                  <Link href="/cancellation" className="text-[#C47D52] font-medium no-underline hover:underline">
                    {t('cancellationPolicyLink')}
                  </Link>
                </span>
              </label>

              {/* Submit Button */}
              <button
                onClick={handleSubmitPayment}
                disabled={!acceptedTerms || submitting}
                className={`rounded-full py-3.5 text-base font-medium w-full border-none transition-all flex items-center justify-center gap-2 ${
                  acceptedTerms && !submitting
                    ? 'bg-[#C47D52] text-white cursor-pointer hover:bg-[#B06D42]'
                    : 'bg-[#C47D52] text-white opacity-40 cursor-not-allowed'
                }`}
              >
                {submitting && <Loader2 size={18} className="animate-spin" />}
                {submitting ? 'Submitting...' : t('completedTransfer')}
              </button>

              {/* Cancel link */}
              <div className="text-center md:text-left">
                <button
                  onClick={handleCancel}
                  className="text-xs text-[#8C8478] border-none bg-transparent cursor-pointer hover:text-[#C4453A] transition-colors"
                >
                  {t('cancelReservation')}
                </button>
              </div>
            </div>

            {/* ===== Right Column: Sticky summary (desktop only) ===== */}
            <div className="hidden md:block md:w-[340px] shrink-0">
              <div className="sticky top-20">
                {summaryCard}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
