"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import {
  CalendarDays,
  Tent,
  Users,
  Timer,
  Settings,
  X,
  Minus,
  Plus,
  ChevronRight,
  UtensilsCrossed,
  Check,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface ReservationUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

interface ReservationYurt {
  id: string
  name: string
  capacity: number
}

interface Reservation {
  id: string
  confirmationCode: string
  userId: string
  yurtId: string | null
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_PENDING_REFUND' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  depositConfirmedAt: string | null
  paymentReference: string | null
  paymentScreenshotUrl: string | null
  paymentDeadline: string | null
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  user: ReservationUser
  yurt: ReservationYurt | null
  orders?: Array<{ id: string; status: string; items: { id: string }[] }>
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

function getTimeRemaining(deadline: string | null): string | null {
  if (!deadline) return null
  const now = Date.now()
  const end = new Date(deadline).getTime()
  const diff = end - now
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDaysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Status Badge Config ───────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  CONFIRMED:         { bg: 'bg-[#E8ECE4]', text: 'text-[#6B7F5E]', label: 'confirmed' },
  PENDING_PAYMENT:   { bg: 'bg-[#F5EBE2]', text: 'text-[#C47D52]', label: 'pendingPayment' },
  PAYMENT_SUBMITTED: { bg: 'bg-[#E8ECE4]', text: 'text-[#6B7F5E]', label: 'paymentSubmitted' },
  COMPLETED:         { bg: 'bg-[#E8ECE4]', text: 'text-[#6B7F5E]', label: 'completed' },
  CANCELLED:         { bg: 'bg-[#F5E5E4]', text: 'text-[#C4453A]', label: 'cancelled' },
  EXPIRED:           { bg: 'bg-[#F0EFED]', text: 'text-[#8E8E93]', label: 'expired' },
}

// ── Component ──────────────────────────────────────────────────────

export default function ReservationsPage() {
  const t = useTranslations('reservations')
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // One-shot banner after an account merge (multiple placeholder
  // reservations linked to this account via /claim). Auto-dismisses
  // after 8s; clicking the × clears it immediately. We strip the query
  // param on first render so a refresh doesn't keep showing it.
  const [mergedBanner, setMergedBanner] = useState<number | null>(null)
  useEffect(() => {
    const raw = searchParams.get('mergedCount')
    if (!raw) return
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n > 1) setMergedBanner(n)
    const url = new URL(window.location.href)
    url.searchParams.delete('mergedCount')
    window.history.replaceState({}, '', url.toString())
    const timer = setTimeout(() => setMergedBanner(null), 8000)
    return () => clearTimeout(timer)
  }, [searchParams])

  // Cancel state
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Modify state
  const [modifyingReservation, setModifyingReservation] = useState<Reservation | null>(null)
  const [modifyGuestCount, setModifyGuestCount] = useState(0)
  const [modifySpecialRequests, setModifySpecialRequests] = useState('')
  const [modifySaving, setModifySaving] = useState(false)
  const [modifySaved, setModifySaved] = useState(false)
  const [modifyError, setModifyError] = useState<string | null>(null)
  const modifySheetRef = useRef<HTMLDivElement>(null)

  const { data: reservations, isLoading, mutate } = useSWR<Reservation[]>(
    sessionStatus === 'authenticated' ? '/api/reservations' : null,
    fetcher
  )

  // Fetch business phone for support contact
  const { data: publicSettings } = useSWR<Record<string, string>>(
    '/api/settings/public',
    fetcher,
    { revalidateOnFocus: false }
  )
  const businessPhone = publicSettings?.business_phone || ''
  const cancelWindowDays = publicSettings?.cancellation_window_days ? Number(publicSettings.cancellation_window_days) : 7

  // Unauthenticated: show prompt + full-screen login modal
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginShowPw, setLoginShowPw] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const { signIn } = await import('next-auth/react')
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      if (result?.error) {
        setLoginError('Invalid email or password')
        setLoginLoading(false)
        return
      }
      window.location.assign('/reservations')
    } catch {
      setLoginError('Something went wrong. Please try again.')
    } finally {
      setLoginLoading(false)
    }
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <User size={48} className="text-[#6B7F5E] mb-4" strokeWidth={1.5} />
          <h2 className="font-[family-name:var(--font-logo)] text-2xl font-semibold text-[#1A1208] mb-2">
            {t('title')}
          </h2>
          <p className="text-[15px] text-[#6B6157] mb-6 max-w-[280px]">
            Sign in to view and manage your reservations
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-[#6B7F5E] text-white rounded-full px-8 py-3 text-base font-medium border-none cursor-pointer transition-all hover:bg-[#5A6E4F] active:scale-[0.97]"
          >
            Sign In
          </button>
        </div>

        {/* Full-screen login modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] bg-[#F8F7F4] flex flex-col overflow-y-auto">
            {/* Close button */}
            <div className="flex justify-end p-4">
              <button
                onClick={() => setShowLoginModal(false)}
                className="w-10 h-10 rounded-full bg-transparent border border-[#E8ECE4] flex items-center justify-center cursor-pointer hover:bg-[#E8ECE4] transition-colors"
              >
                <X size={20} className="text-[#1A1208]" />
              </button>
            </div>

            {/* Login form */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
              <div className="w-full max-w-[400px]">
                <h1 className="font-[family-name:var(--font-logo)] text-3xl font-semibold text-[#1A1208] text-center mb-1">
                  Bobo&apos;s Farm
                </h1>
                <p className="text-[15px] text-[#6B6157] text-center mb-10">
                  波姐农家乐
                </p>

                <h2 className="font-serif text-xl font-semibold text-[#1A1208] mb-6">
                  Sign In
                </h2>

                {loginError && (
                  <div className="bg-[#C4453A]/10 text-[#C4453A] rounded-xl p-3 text-sm mb-4">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6157] pointer-events-none" />
                    <input
                      type="email"
                      placeholder="Email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      style={{ border: '1px solid #E8ECE4', outline: 'none' }}
                      className="w-full h-[52px] rounded-xl pl-11 pr-4 text-base bg-white placeholder:text-[#6B6157] text-[#1A1208] focus:!border-[#6B7F5E] transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6157] pointer-events-none" />
                    <input
                      type={loginShowPw ? 'text' : 'password'}
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      style={{ border: '1px solid #E8ECE4', outline: 'none' }}
                      className="w-full h-[52px] rounded-xl pl-11 pr-12 text-base bg-white placeholder:text-[#6B6157] text-[#1A1208] focus:!border-[#6B7F5E] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setLoginShowPw(!loginShowPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer"
                    >
                      {loginShowPw
                        ? <Eye size={18} className="text-[#6B6157]" />
                        : <EyeOff size={18} className="text-[#6B6157]" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full h-[52px] rounded-full bg-[#6B7F5E] text-white text-base font-medium border-none cursor-pointer transition-all hover:bg-[#5A6E4F] active:scale-[0.97] disabled:opacity-50"
                  >
                    {loginLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <p className="text-[15px] text-[#6B6157] text-center mt-6">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-[#6B7F5E] font-medium no-underline">
                    Sign Up
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Sort: upcoming first (by date asc), then past (by date desc)
  const { upcoming, past } = useMemo(() => {
    if (!reservations) return { upcoming: [], past: [] }
    const now = Date.now()
    const upcomingList: Reservation[] = []
    const pastList: Reservation[] = []

    for (const r of reservations) {
      const rDate = new Date(r.date).getTime()
      const isUpcoming = rDate >= now && !['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED', 'COMPLETED'].includes(r.status)
      if (isUpcoming) {
        upcomingList.push(r)
      } else {
        pastList.push(r)
      }
    }

    upcomingList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    pastList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { upcoming: upcomingList, past: pastList }
  }, [reservations])

  // ── Cancel handlers ────────────────────────────────────────────

  const handleCancelRequest = useCallback((id: string) => {
    setCancelError(null)
    setCancelReason('')
    setConfirmCancelId(id)
  }, [])

  const handleCancelConfirm = useCallback(async () => {
    if (!confirmCancelId) return
    setCancelling(confirmCancelId)
    setCancelError(null)
    try {
      const res = await fetch(`/api/reservations/${confirmCancelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setCancelError(err.error || 'Failed to cancel reservation')
        return
      }
      setConfirmCancelId(null)
      setCancelReason('')
      mutate()
    } catch {
      setCancelError('Failed to cancel reservation. Please try again.')
    } finally {
      setCancelling(null)
    }
  }, [confirmCancelId, cancelReason, mutate])

  // ── Modify handlers ────────────────────────────────────────────

  const openModify = useCallback((r: Reservation) => {
    setModifyingReservation(r)
    setModifyGuestCount(r.guestCount)
    setModifySpecialRequests(r.specialRequests || '')
    setModifyError(null)
    setModifySaved(false)
  }, [])

  const closeModify = useCallback(() => {
    setModifyingReservation(null)
    setModifyError(null)
    setModifySaved(false)
  }, [])

  const handleModifySave = useCallback(async () => {
    if (!modifyingReservation) return
    setModifySaving(true)
    setModifyError(null)
    setModifySaved(false)

    try {
      const payload: Record<string, unknown> = { action: 'modify_details' }
      if (modifyGuestCount !== modifyingReservation.guestCount) {
        payload.guestCount = modifyGuestCount
      }
      if (modifySpecialRequests !== (modifyingReservation.specialRequests || '')) {
        payload.specialRequests = modifySpecialRequests
      }

      // Nothing changed
      if (Object.keys(payload).length <= 1) {
        closeModify()
        return
      }

      const res = await fetch(`/api/reservations/${modifyingReservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setModifyError(err.error || t('modify.error'))
        return
      }

      setModifySaved(true)
      mutate()
      setTimeout(() => {
        closeModify()
      }, 1000)
    } catch {
      setModifyError(t('modify.error'))
    } finally {
      setModifySaving(false)
    }
  }, [modifyingReservation, modifyGuestCount, modifySpecialRequests, mutate, closeModify, t])

  // ── Deposit label helper ───────────────────────────────────────

  const depositLabel = (r: Reservation) => {
    switch (r.depositStatus) {
      case 'CONFIRMED': return t('depositConfirmed')
      case 'REFUNDED': return t('depositRefunded')
      case 'PENDING': return t('depositPending')
      default: return t('depositAwaiting')
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col pb-4">
      {/* Page Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <h1 className="font-[family-name:var(--font-logo)] text-2xl font-semibold text-[#1A1208]">
            {t('title')}
          </h1>
        </div>
        <Link href="/settings" className="p-2 text-[#8E8E93] hover:text-[#1A1208] transition-colors">
          <Settings size={22} />
        </Link>
      </div>

      <div className="px-4 flex flex-col gap-6 mt-2">
        {mergedBanner && (
          <div className="bg-[#E8ECE4] border border-[#6B7F5E]/30 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Check size={16} className="text-[#6B7F5E] mt-0.5 shrink-0" />
              <p className="text-sm text-[#2C2416]">
                {t('mergedBanner', { count: mergedBanner })}
              </p>
            </div>
            <button
              onClick={() => setMergedBanner(null)}
              className="text-[#8C8478] hover:text-[#2C2416] p-0.5"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {/* Loading skeleton */}
        {(isLoading || sessionStatus === 'loading') && (
          <div className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="h-5 w-48 bg-[#F0EFED] rounded animate-pulse mb-3" />
                <div className="h-4 w-36 bg-[#F0EFED] rounded animate-pulse mb-4" />
                <div className="h-4 w-28 bg-[#F0EFED] rounded animate-pulse mb-3" />
                <div className="h-4 w-32 bg-[#F0EFED] rounded animate-pulse" />
                <div className="flex gap-3 mt-5">
                  <div className="h-9 w-24 bg-[#F0EFED] rounded-full animate-pulse" />
                  <div className="h-9 w-24 bg-[#F0EFED] rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sessionStatus === 'authenticated' && upcoming.length === 0 && past.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-20 h-20 rounded-full bg-[#E8ECE4] flex items-center justify-center">
              <CalendarDays size={36} className="text-[#6B7F5E]" />
            </div>
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">
              {t('emptyTitle')}
            </h2>
            <p className="text-sm text-[#8E8E93] text-center">
              {t('emptySubtitle')}
            </p>
            <Link
              href="/booking/start"
              className="no-underline mt-2 bg-[#6B7F5E] text-white rounded-full px-6 py-3 text-sm font-semibold"
            >
              {t('bookFirst')}
            </Link>
          </div>
        )}

        {/* ── Upcoming Section ───────────────────────────────── */}
        {upcoming.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-lg font-semibold text-[#1A1208]">
              {t('upcoming')}
            </h2>

            {upcoming.map((r) => {
              const statusCfg = STATUS_BADGE[r.status] || STATUS_BADGE.EXPIRED
              const isPendingPayment = r.status === 'PENDING_PAYMENT'
              const isPaymentSubmitted = r.status === 'PAYMENT_SUBMITTED'
              const isConfirmed = r.status === 'CONFIRMED'
              const timeLeft = getTimeRemaining(r.paymentDeadline)
              const isCancelling = cancelling === r.id
              const canModify = isConfirmed || isPaymentSubmitted
              const canPreOrder = isConfirmed
              const preOrderCount = (r.orders ?? []).reduce(
                (sum, o) => sum + (o.items?.length ?? 0),
                0,
              )

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3"
                >
                  {/* Date */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={18} className="text-[#6B7F5E] shrink-0 mt-0.5" />
                      <span className="font-serif text-lg font-semibold text-[#1A1208]">
                        {formatLongDate(r.date)}
                      </span>
                    </div>
                  </div>

                  {/* Confirmation Code */}
                  {r.confirmationCode && (
                    <div className="text-xs font-mono text-[#6B7F5E] bg-[#E8ECE4] rounded-lg px-3 py-1.5 self-start">
                      {t('confirmCode')}: {r.confirmationCode}
                    </div>
                  )}

                  {/* Yurt + Guests */}
                  <div className="flex items-center gap-4 text-sm text-[#8E8E93]">
                    <span className="flex items-center gap-1.5">
                      <Tent size={15} className="text-[#8E8E93]" />
                      {r.yurt?.name ?? <span className="italic">{t('pendingAssignment')}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={15} className="text-[#8E8E93]" />
                      {t('guests', { count: r.guestCount })}
                    </span>
                  </div>

                  {/* Status + Deposit */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                      {isConfirmed && <Check size={12} />}
                      {t(`status.${statusCfg.label}`)}
                    </span>
                    <span className="text-sm text-[#8E8E93]">
                      {t('deposit')}: ${r.depositAmount} ({depositLabel(r)})
                    </span>
                  </div>

                  {/* Pre-order info + prominent CTA for confirmed */}
                  {isConfirmed && (
                    <>
                      <Link
                        href={`/pre-order?reservationId=${r.id}`}
                        className="flex items-center gap-2 text-sm text-[#6B7F5E] no-underline hover:underline"
                      >
                        <UtensilsCrossed size={15} />
                        {preOrderCount > 0
                          ? t('itemsPreOrdered', { count: preOrderCount })
                          : t('noPreOrder')
                        }
                      </Link>
                      <Link
                        href={`/pre-order?reservationId=${r.id}`}
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#6B7F5E] text-white rounded-full text-sm font-medium mt-1 no-underline hover:bg-[#5A6E4F] transition-colors"
                      >
                        <UtensilsCrossed size={16} />
                        {t('actions.preOrderMenu')}
                      </Link>
                    </>
                  )}

                  {/* Timer for pending payment */}
                  {isPendingPayment && timeLeft && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#C47D52]">
                      <Timer size={15} />
                      {timeLeft}
                    </div>
                  )}

                  {/* Payment submitted notice */}
                  {isPaymentSubmitted && (
                    <div className="flex items-center gap-2 text-sm text-[#6B7F5E]">
                      <Timer size={15} />
                      {t('waitingForAdmin')}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 mt-1">
                    {canModify && (
                      <button
                        onClick={() => openModify(r)}
                        className="border border-[#6B7F5E] text-[#6B7F5E] rounded-full px-4 py-2 text-sm font-medium cursor-pointer bg-transparent hover:bg-[#6B7F5E]/5 transition-colors"
                      >
                        {t('actions.modify')}
                      </button>
                    )}
                    {/* Pre-order button moved above as full-width CTA */}
                    {isPendingPayment && (
                      <Link
                        href="/booking/confirm"
                        className="no-underline bg-[#C47D52] text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-[#B06D42] transition-colors"
                      >
                        {t('actions.payNow')}
                      </Link>
                    )}
                  </div>

                  {/* Cancel link */}
                  {!isCancelling && !['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED', 'COMPLETED'].includes(r.status) && (
                    <button
                      onClick={() => handleCancelRequest(r.id)}
                      className="self-start text-[#C4453A] text-sm cursor-pointer bg-transparent border-none p-0 hover:underline mt-0.5"
                    >
                      {t('actions.cancelReservation')}
                    </button>
                  )}

                  {/* Cancel reason if cancelled */}
                  {r.status === 'CANCELLED' && r.cancelReason && (
                    <div className="text-sm text-[#C4453A] bg-[#C4453A]/5 px-3 py-2 rounded-lg">
                      Reason: {r.cancelReason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Past Section ───────────────────────────────────── */}
        {past.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-lg font-semibold text-[#8E8E93]">
              {t('past')}
            </h2>

            {past.map((r) => {
              const statusCfg = STATUS_BADGE[r.status] || STATUS_BADGE.EXPIRED

              return (
                <div
                  key={r.id}
                  className="bg-[#F8F7F4] rounded-xl p-4 flex flex-col gap-2"
                >
                  {/* Date */}
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-base font-semibold text-[#1A1208]/70">
                      {formatLongDate(r.date)}
                    </span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                      {t(`status.${statusCfg.label}`)}
                    </span>
                  </div>

                  {/* Yurt + Guests */}
                  <div className="flex items-center gap-4 text-sm text-[#8E8E93]">
                    <span className="flex items-center gap-1.5">
                      <Tent size={14} />
                      {r.yurt?.name ?? <span className="italic">{t('pendingAssignment')}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {t('guests', { count: r.guestCount })}
                    </span>
                  </div>

                  {/* Cancel reason */}
                  {r.status === 'CANCELLED' && r.cancelReason && (
                    <div className="text-sm text-[#C4453A]/80 mt-1">
                      Reason: {r.cancelReason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Account section */}
        <div className="mt-8 pt-6 border-t border-[#E8ECE4]">
          <button
            onClick={async () => {
              const { signOut } = await import('next-auth/react')
              await signOut({ redirect: false })
              window.location.href = '/'
            }}
            className="w-full py-3 rounded-full border border-[#C4453A]/30 text-[#C4453A] text-sm font-medium bg-transparent cursor-pointer hover:bg-[#C4453A]/5 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Modify Bottom Sheet ─────────────────────────────── */}
      {modifyingReservation && (
        <div
          className="fixed inset-0 bg-black/40 z-[100] flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModify()
          }}
        >
          <div
            ref={modifySheetRef}
            className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-auto animate-slide-up"
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#F0EFED] sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-serif text-lg font-bold text-[#1A1208]">
                {t('modify.title')}
              </h3>
              <button
                onClick={closeModify}
                className="p-1.5 text-[#8E8E93] hover:text-[#1A1208] cursor-pointer bg-transparent border-none transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-5">
              {/* Change Date */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-base font-medium text-[#1A1208]">
                  <CalendarDays size={16} className="text-[#6B7F5E]" />
                  {t('modify.changeDate')}
                </label>
                <div className="flex items-center justify-between bg-[#F8F7F4] rounded-xl px-4 py-3">
                  <span className="text-[15px] text-[#1A1208]">
                    {formatLongDate(modifyingReservation.date)}
                  </span>
                  <ChevronRight size={16} className="text-[#8E8E93]" />
                </div>
                <p className="text-xs text-[#8E8E93]">
                  {t('modify.contactToReschedule')}
                  {businessPhone && (
                    <>
                      {' '}
                      <a href={`tel:${businessPhone}`} className="text-[#6B7F5E] font-semibold underline">{businessPhone}</a>
                    </>
                  )}
                </p>
              </div>

              {/* Guest Count */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-base font-medium text-[#1A1208]">
                  <Users size={16} className="text-[#6B7F5E]" />
                  {t('modify.guestCount')}
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setModifyGuestCount(prev => Math.max(1, prev - 1))}
                    disabled={modifyGuestCount <= 1}
                    className="w-10 h-10 rounded-full border border-[#E0DFDC] flex items-center justify-center cursor-pointer bg-white hover:bg-[#F8F7F4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus size={16} className="text-[#1A1208]" />
                  </button>
                  <span className="text-xl font-semibold text-[#1A1208] w-8 text-center tabular-nums">
                    {modifyGuestCount}
                  </span>
                  <button
                    onClick={() => setModifyGuestCount(prev => Math.min(modifyingReservation.yurt?.capacity ?? 10, prev + 1))}
                    disabled={modifyGuestCount >= (modifyingReservation.yurt?.capacity ?? 10)}
                    className="w-10 h-10 rounded-full border border-[#E0DFDC] flex items-center justify-center cursor-pointer bg-white hover:bg-[#F8F7F4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={16} className="text-[#1A1208]" />
                  </button>
                </div>
                <p className="text-xs text-[#8E8E93]">
                  {t('modify.maxCapacity', { capacity: modifyingReservation.yurt?.capacity ?? 10 })}
                </p>
              </div>

              {/* Special Requests */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-base font-medium text-[#1A1208]">
                  {t('modify.specialRequests')}
                </label>
                <textarea
                  value={modifySpecialRequests}
                  onChange={(e) => setModifySpecialRequests(e.target.value)}
                  placeholder={t('modify.specialRequestsPlaceholder')}
                  rows={3}
                  className="w-full bg-[#F8F7F4] rounded-xl px-4 py-3 text-[15px] text-[#1A1208] border-none outline-none resize-none focus:ring-2 focus:ring-[#6B7F5E]/30 placeholder:text-[#C0BFB9]"
                />
              </div>

              {/* Error */}
              {modifyError && (
                <div className="bg-[#C4453A]/10 text-[#C4453A] text-sm rounded-lg px-4 py-2.5">
                  {modifyError}
                </div>
              )}

              {/* Success */}
              {modifySaved && (
                <div className="bg-[#E8ECE4] text-[#6B7F5E] text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <Check size={16} />
                  {t('modify.saved')}
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleModifySave}
                disabled={modifySaving || modifySaved}
                className="w-full bg-[#6B7F5E] text-white rounded-full py-3 text-sm font-semibold cursor-pointer border-none hover:bg-[#5A6E4F] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {modifySaving && (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                {modifySaving ? t('modify.saving') : t('modify.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Dialog ──────────────────────── */}
      {confirmCancelId && (() => {
        const reservation = reservations?.find(r => r.id === confirmCancelId)
        const daysUntil = reservation ? getDaysUntil(reservation.date) : 0
        const refundEligible = daysUntil >= cancelWindowDays

        return (
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-[400px] max-w-full shadow-[0_8px_40px_rgba(0,0,0,0.15)] flex flex-col gap-4">
              <h3 className="font-serif text-xl font-bold text-[#1A1208]">
                {t('cancelDialog.title')}
              </h3>
              <p className="text-[15px] text-[#1A1208]/60">
                {t('cancelDialog.message')}
              </p>

              {/* Refund eligibility info */}
              <div className={`text-sm rounded-lg px-4 py-2.5 ${
                refundEligible
                  ? 'bg-[#E8ECE4] text-[#6B7F5E]'
                  : 'bg-[#F5EBE2] text-[#C47D52]'
              }`}>
                {refundEligible
                  ? t('cancelDialog.refundEligible')
                  : t('cancelDialog.refundNotEligible')
                }
              </div>

              {/* Optional reason */}
              <div className="flex flex-col gap-1.5">
                <label className="text-base font-medium text-[#1A1208]">
                  {t('cancelDialog.reasonLabel')}
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('cancelDialog.reasonPlaceholder')}
                  rows={2}
                  className="w-full bg-[#F8F7F4] rounded-xl px-4 py-3 text-[15px] text-[#1A1208] border-none outline-none resize-none focus:ring-2 focus:ring-[#6B7F5E]/30 placeholder:text-[#C0BFB9]"
                />
              </div>

              {cancelError && (
                <div className="bg-[#C4453A]/10 text-[#C4453A] text-sm rounded-lg px-3 py-2">
                  {cancelError}
                </div>
              )}

              {businessPhone && (
                <div className="bg-[#F8F7F4] rounded-lg px-4 py-3 text-sm text-[#1A1208]/70">
                  {t('cancelDialog.contactSupport')}{' '}
                  <a href={`tel:${businessPhone}`} className="text-[#6B7F5E] font-semibold underline">{businessPhone}</a>
                </div>
              )}

              <div className="flex gap-3 justify-end mt-1">
                <button
                  onClick={() => { setConfirmCancelId(null); setCancelError(null); setCancelReason('') }}
                  disabled={!!cancelling}
                  className="px-5 py-2.5 rounded-full border border-[#6B7F5E] text-[#6B7F5E] text-sm font-medium cursor-pointer bg-white disabled:opacity-50 hover:bg-[#6B7F5E]/5 transition-colors"
                >
                  {t('cancelDialog.keep')}
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={!!cancelling}
                  className="px-5 py-2.5 rounded-full bg-[#C4453A] text-white text-sm font-semibold cursor-pointer border-none disabled:opacity-50 flex items-center gap-2 hover:bg-[#B33D32] transition-colors"
                >
                  {cancelling && (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  )}
                  {cancelling ? t('cancelDialog.cancelling') : t('cancelDialog.confirm')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
