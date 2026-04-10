"use client"

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { Tent, Users, CircleDollarSign, CircleCheck, ClipboardList, Timer, CalendarDays } from 'lucide-react'

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
  userId: string
  yurtId: string
  date: string
  guestCount: number
  specialRequests: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
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
  yurt: ReservationYurt
  order?: { id: string; status: string; items: { id: string }[] } | null
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

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  CONFIRMED:         { bg: 'bg-[#3B82F6]', text: 'text-white', label: 'confirmed' },
  PENDING_PAYMENT:   { bg: 'bg-[#F4A623]', text: 'text-white', label: 'pendingPayment' },
  PAYMENT_SUBMITTED: { bg: 'bg-[#E67E22]', text: 'text-white', label: 'paymentSubmitted' },
  COMPLETED:         { bg: 'bg-[#5B8C3E]', text: 'text-white', label: 'completed' },
  CANCELLED:         { bg: 'bg-[#DC3545]', text: 'text-white', label: 'cancelled' },
  EXPIRED:           { bg: 'bg-gray-400',   text: 'text-white', label: 'expired' },
}

// ── Component ──────────────────────────────────────────────────────

export default function ReservationsPage() {
  const t = useTranslations('reservations')
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const { data: reservations, isLoading, mutate } = useSWR<Reservation[]>(
    sessionStatus === 'authenticated' ? '/api/reservations' : null,
    fetcher
  )

  // Redirect unauthenticated users
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [sessionStatus, router])

  const handleCancelRequest = useCallback((id: string) => {
    setCancelError(null)
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
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (!res.ok) {
        const err = await res.json()
        setCancelError(err.error || 'Failed to cancel reservation')
        return
      }
      setConfirmCancelId(null)
      mutate()
    } catch {
      setCancelError('Failed to cancel reservation. Please try again.')
    } finally {
      setCancelling(null)
    }
  }, [confirmCancelId, mutate])

  // Sort: upcoming first (by date asc), then past (by date desc)
  const sorted = useMemo(() => {
    if (!reservations) return []
    const now = Date.now()
    return [...reservations].sort((a, b) => {
      const aDate = new Date(a.date).getTime()
      const bDate = new Date(b.date).getTime()
      const aUpcoming = aDate >= now && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(a.status)
      const bUpcoming = bDate >= now && !['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(b.status)

      if (aUpcoming && !bUpcoming) return -1
      if (!aUpcoming && bUpcoming) return 1
      if (aUpcoming && bUpcoming) return aDate - bDate
      return bDate - aDate
    })
  }, [reservations])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return {
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      day: d.getDate().toString(),
      month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase(),
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-cream overflow-auto">
      <div className="flex-1 flex flex-col items-center py-[60px] px-6 md:px-20 gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-playfair text-[32px] font-bold text-brown">{t('title')}</h1>
          <p className="text-base text-[#8E8E93]">{t('subtitle')}</p>
        </div>

        {/* Loading skeleton */}
        {(isLoading || sessionStatus === 'loading') && (
          <div className="flex flex-col gap-4 w-[800px] max-w-full py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-6 rounded-2xl p-6 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col items-center gap-1 w-[72px] shrink-0">
                  <div className="h-3 w-8 bg-beige/30 rounded animate-pulse" />
                  <div className="h-10 w-10 bg-beige/30 rounded-full animate-pulse" />
                  <div className="h-3 w-12 bg-beige/30 rounded animate-pulse" />
                </div>
                <div className="w-px bg-beige self-stretch" />
                <div className="flex flex-col gap-3 flex-1">
                  <div className="h-5 w-40 bg-beige/30 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-beige/30 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-beige/30 rounded animate-pulse" />
                </div>
                <div className="flex flex-col items-end">
                  <div className="h-6 w-20 bg-beige/30 rounded-xl animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sorted.length === 0 && sessionStatus === 'authenticated' && (
          <div className="flex flex-col items-center gap-5 py-16 w-[800px] max-w-full">
            <div className="w-32 h-32 rounded-full bg-[#F9F6F1] flex items-center justify-center">
              <CalendarDays size={48} className="text-beige" />
            </div>
            <h2 className="font-playfair text-xl font-bold text-brown">{t('emptyTitle') || 'No reservations yet'}</h2>
            <p className="text-sm text-[#8E8E93] text-center max-w-md">
              {t('emptySubtitle') || 'Book your first yurt experience and enjoy a farm-to-table feast in the Hudson Valley.'}
            </p>
            <Link
              href="/booking/date"
              className="no-underline px-8 py-3 rounded-2xl bg-gradient-to-r from-[#8B6914] to-[#A67C2E] text-white text-sm font-semibold shadow-[0_4px_16px_rgba(139,105,20,0.2)]"
            >
              {t('bookFirst') || 'Book Your First Yurt'}
            </Link>
          </div>
        )}

        {/* Cards */}
        {sorted.length > 0 && (
          <div className="flex flex-col gap-4 w-[800px] max-w-full">
            {sorted.map((r) => {
              const dateInfo = formatDate(r.date)
              const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.EXPIRED
              const isTerminal = ['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(r.status)
              const isMuted = isTerminal
              const isPendingPayment = r.status === 'PENDING_PAYMENT'
              const isPaymentSubmitted = r.status === 'PAYMENT_SUBMITTED'
              const isConfirmed = r.status === 'CONFIRMED'
              const timeLeft = getTimeRemaining(r.paymentDeadline)
              const isCancelling = cancelling === r.id

              return (
                <div
                  key={r.id}
                  className="flex gap-6 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                  style={{
                    backgroundColor: isMuted ? '#FAFAF8' : '#FFFFFF',
                    borderLeft: isPendingPayment ? '4px solid #8B6914' : undefined,
                    opacity: isMuted ? 0.8 : 1,
                  }}
                >
                  {/* Date Column */}
                  <div className="flex flex-col items-center gap-0.5 w-[72px] shrink-0">
                    <span className="text-[11px] font-bold text-[#8E8E93] tracking-[1.5px]">{dateInfo.dow}</span>
                    <span className="font-playfair text-[40px] font-bold text-brown leading-none">{dateInfo.day}</span>
                    <span className="text-[11px] text-[#8E8E93]">{dateInfo.month}</span>
                  </div>

                  {/* Divider */}
                  <div className="w-px bg-beige self-stretch" />

                  {/* Info Column */}
                  <div className="flex flex-col gap-2.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <Tent size={18} className="text-amber" />
                      <span className="text-base font-semibold text-brown">{r.yurt?.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Users size={18} className="text-amber" />
                      <span className="text-sm text-[#8E8E93]">{t('guests', { count: r.guestCount })}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <CircleDollarSign
                        size={18}
                        className={r.depositStatus === 'CONFIRMED' ? 'text-[#5B8C3E]' : 'text-[#F4A623]'}
                      />
                      <span className={`text-sm ${r.depositStatus === 'CONFIRMED' ? 'text-[#5B8C3E]' : 'text-[#F4A623]'}`}>
                        ${r.depositAmount} {r.depositStatus === 'CONFIRMED' ? 'deposit confirmed' :
                          r.depositStatus === 'REFUNDED' ? 'refunded' :
                          r.depositStatus === 'PENDING' ? 'payment submitted' :
                          'awaiting payment'}
                      </span>
                      {r.depositStatus === 'CONFIRMED' && !isTerminal && (
                        <CircleCheck size={16} className="text-[#5B8C3E]" />
                      )}
                    </div>

                    {/* Pre-order line for confirmed */}
                    {isConfirmed && (
                      <div className="flex items-center gap-2.5">
                        <ClipboardList size={18} className="text-amber" />
                        {r.order && r.order.items.length > 0 ? (
                          <>
                            <span className="text-sm text-[#8E8E93]">{r.order.items.length} items ordered</span>
                            <Link href={`/pre-order?reservationId=${r.id}`} className="text-sm font-semibold text-amber no-underline">
                              {t('viewOrder')}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-[#8E8E93]">{t('notOrderedYet')}</span>
                            <Link href={`/pre-order?reservationId=${r.id}`} className="text-sm font-semibold text-amber no-underline">
                              {t('preOrderNow')}
                            </Link>
                          </>
                        )}
                      </div>
                    )}

                    {/* Timer for pending payment */}
                    {isPendingPayment && timeLeft && (
                      <div className="flex items-center gap-2.5">
                        <Timer size={18} className="text-[#F4A623]" />
                        <span className="text-sm font-semibold text-[#F4A623]">{timeLeft}</span>
                      </div>
                    )}

                    {/* Payment submitted notice */}
                    {isPaymentSubmitted && (
                      <div className="flex items-center gap-2.5">
                        <Timer size={18} className="text-[#E67E22]" />
                        <span className="text-sm text-[#E67E22]">{t('waitingForAdmin')}</span>
                      </div>
                    )}

                    {/* Cancel reason */}
                    {r.status === 'CANCELLED' && r.cancelReason && (
                      <div className="text-xs text-[#DC3545] bg-[#DC3545]/5 px-3 py-1.5 rounded-lg mt-1">
                        Reason: {r.cancelReason}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Status + Actions */}
                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`text-xs font-semibold px-3.5 py-1 rounded-xl ${statusCfg.bg} ${statusCfg.text}`}
                    >
                      {t(`status.${statusCfg.label}`)}
                    </span>
                    <div className="flex-1" />

                    {/* Actions based on status */}
                    {isConfirmed && (
                      <>
                        <Link
                          href={`/pre-order?reservationId=${r.id}`}
                          className="no-underline text-[13px] font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-[#8B6914] to-[#A67C2E]"
                        >
                          Pre-Order Menu
                        </Link>
                        <button
                          disabled
                          title="Coming soon"
                          className="text-[13px] font-medium text-brown px-5 py-2 rounded-lg border border-beige bg-white cursor-not-allowed opacity-50"
                        >
                          {t('actions.reschedule')}
                        </button>
                        <button
                          onClick={() => handleCancelRequest(r.id)}
                          disabled={isCancelling}
                          className="text-[13px] font-medium text-[#EF4444] cursor-pointer disabled:opacity-50 bg-transparent border-none"
                        >
                          {t('actions.cancel')}
                        </button>
                      </>
                    )}
                    {isPendingPayment && (
                      <>
                        <Link
                          href="/booking/confirm"
                          className="no-underline text-[13px] font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-[#8B6914] to-[#A67C2E]"
                        >
                          {t('actions.payNow')}
                        </Link>
                        <button
                          onClick={() => handleCancelRequest(r.id)}
                          disabled={isCancelling}
                          className="text-[13px] font-medium text-[#EF4444] cursor-pointer disabled:opacity-50 bg-transparent border-none"
                        >
                          {t('actions.cancel')}
                        </button>
                      </>
                    )}
                    {isPaymentSubmitted && (
                      <span className="text-[13px] text-[#8E8E93] italic">{t('awaitingConfirmation')}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* Inline error banner */}
        {cancelError && !confirmCancelId && (
          <div className="w-[800px] max-w-full bg-[#DC3545]/10 text-[#DC3545] text-sm rounded-lg px-4 py-3 flex items-center justify-between">
            <span>{cancelError}</span>
            <button
              onClick={() => setCancelError(null)}
              className="text-[#DC3545] font-semibold text-sm border-none bg-transparent cursor-pointer ml-4"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog overlay */}
      {confirmCancelId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-[400px] max-w-full shadow-[0_8px_40px_rgba(0,0,0,0.15)] flex flex-col gap-4">
            <h3 className="font-playfair text-xl font-bold text-brown">{t('cancelDialog.title')}</h3>
            <p className="text-sm text-brown/60">
              {t('cancelDialog.message')}
            </p>
            {cancelError && (
              <div className="bg-[#DC3545]/10 text-[#DC3545] text-sm rounded-lg px-3 py-2">
                {cancelError}
              </div>
            )}
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => { setConfirmCancelId(null); setCancelError(null) }}
                disabled={!!cancelling}
                className="px-5 py-2.5 rounded-xl border border-beige text-brown text-sm font-medium cursor-pointer bg-white disabled:opacity-50"
              >
                {t('cancelDialog.keep')}
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={!!cancelling}
                className="px-5 py-2.5 rounded-xl bg-[#DC3545] text-white text-sm font-semibold cursor-pointer border-none disabled:opacity-50 flex items-center gap-2"
              >
                {cancelling && (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                {cancelling ? t('cancelDialog.cancelling') : t('cancelDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
