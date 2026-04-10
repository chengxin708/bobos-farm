"use client"

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { Calendar, MapPin, Users, Phone, Image as ImageIcon, AlertTriangle } from 'lucide-react'

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
}

type TabKey = 'pending' | 'confirmed' | 'refunded' | 'expiring'

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateRange(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function getTimeRemaining(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null
  const now = Date.now()
  const end = new Date(deadline).getTime()
  const diff = end - now
  if (diff <= 0) return { text: 'Expired', urgent: true }
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return { text: `${hours}h ${minutes}m left`, urgent: hours < 6 }
  return { text: `${minutes}m left`, urgent: true }
}

// ── Component ──────────────────────────────────────────────────────

export default function Deposits() {
  const t = useTranslations('admin.deposits')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [updating, setUpdating] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Redirect non-admin
  if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
    router.push('/')
    return null
  }

  // Tick every minute for countdown updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch all reservations with deposit-related statuses
  const { data: pendingRes, mutate: mutatePending } = useSWR<Reservation[]>(
    '/api/reservations?status=PAYMENT_SUBMITTED',
    fetcher
  )
  const { data: confirmedRes, mutate: mutateConfirmed } = useSWR<Reservation[]>(
    '/api/reservations?status=CONFIRMED&depositStatus=CONFIRMED',
    fetcher
  )
  const { data: refundedRes, mutate: mutateRefunded } = useSWR<Reservation[]>(
    '/api/reservations?depositStatus=REFUNDED',
    fetcher
  )
  const { data: expiringRes, mutate: mutateExpiring } = useSWR<Reservation[]>(
    '/api/reservations?status=PENDING_PAYMENT',
    fetcher
  )

  const mutateAll = useCallback(() => {
    mutatePending()
    mutateConfirmed()
    mutateRefunded()
    mutateExpiring()
  }, [mutatePending, mutateConfirmed, mutateRefunded, mutateExpiring])

  // ── Actions ──────────────────────────────────────────────────

  const handleConfirmDeposit = useCallback(async (id: string) => {
    setUpdating(id)
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_deposit' }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to confirm deposit')
        return
      }
      mutateAll()
    } catch {
      alert('Failed to confirm deposit')
    } finally {
      setUpdating(null)
    }
  }, [mutateAll])

  const handleReject = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to reject this deposit?')) return
    setUpdating(id)
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject_deposit' }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to reject deposit')
        return
      }
      mutateAll()
    } catch {
      alert('Failed to reject deposit')
    } finally {
      setUpdating(null)
    }
  }, [mutateAll])

  // ── Compute stats ─────────────────────────────────────────────

  const pendingCount = pendingRes?.length ?? 0
  const collectedTotal = confirmedRes?.reduce((sum, r) => sum + r.depositAmount, 0) ?? 0
  const refundedTotal = refundedRes?.reduce((sum, r) => sum + r.depositAmount, 0) ?? 0

  // Sort expiring by deadline (soonest first)
  const sortedExpiring = [...(expiringRes || [])].sort((a, b) => {
    if (!a.paymentDeadline) return 1
    if (!b.paymentDeadline) return -1
    return new Date(a.paymentDeadline).getTime() - new Date(b.paymentDeadline).getTime()
  })

  const getTabData = (): Reservation[] => {
    switch (activeTab) {
      case 'pending': return pendingRes || []
      case 'confirmed': return confirmedRes || []
      case 'refunded': return refundedRes || []
      case 'expiring': return sortedExpiring
    }
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'pending', label: t('tabs.pending'), count: pendingCount },
    { key: 'confirmed', label: t('tabs.confirmed') },
    { key: 'refunded', label: t('tabs.refunded') },
    { key: 'expiring', label: t('tabs.expiringSoon'), count: sortedExpiring.length },
  ]

  // ── Loading state ────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <TopBar title={t('title')} />
        <div className="flex-1 p-6 flex items-center justify-center bg-cream-bg">
          <p className="text-gray-text">Loading...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* KPI Cards */}
        <div className="flex gap-4">
          <div className="flex-1 bg-[#FEF3CD] rounded-xl p-5 border-l-4 border-[#F4A623]">
            <div className="text-lg font-bold text-brown">{pendingCount} {t('tabs.pending')}</div>
            <div className="text-sm text-gray-text">{t('stats.totalPending')}</div>
          </div>
          <div className="flex-1 bg-[#EAF2E3] rounded-xl p-5 border-l-4 border-[#5B8C3E]">
            <div className="text-lg font-bold text-brown">${collectedTotal.toLocaleString()} Collected</div>
            <div className="text-sm text-gray-text">{t('stats.collectedThisMonth')}</div>
          </div>
          <div className="flex-1 bg-[#FFE0E0] rounded-xl p-5 border-l-4 border-[#DC3545]">
            <div className="text-lg font-bold text-brown">${refundedTotal.toLocaleString()} Refunded</div>
            <div className="text-sm text-gray-text">{t('stats.refundedThisMonth')}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-beige">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-1.5 ${
                activeTab === tab.key ? 'border-amber text-amber' : 'border-transparent text-gray-text hover:text-brown'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-amber text-white' : 'bg-beige text-gray-text'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Deposit Cards */}
        <div className="flex flex-col gap-4">
          {getTabData().length === 0 ? (
            <div className="bg-white rounded-xl border border-beige p-12 text-center">
              <p className="text-gray-text text-sm">No deposits found in this category.</p>
            </div>
          ) : (
            getTabData().map((dep) => {
              const timeRemaining = getTimeRemaining(dep.paymentDeadline)
              const isUpdating = updating === dep.id

              return (
                <div key={dep.id} className="bg-white rounded-xl border border-beige p-5 flex flex-col gap-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-bold text-brown">{dep.user?.name || 'Unknown Guest'}</div>
                      <div className="text-sm text-gray-text">{dep.user?.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Expiring badge */}
                      {activeTab === 'pending' && timeRemaining && timeRemaining.urgent && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-[#D4A017] bg-[#FEF3CD] px-2.5 py-1 rounded-full">
                          <AlertTriangle size={12} /> {timeRemaining.text}
                        </span>
                      )}
                      {/* Status badge */}
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        dep.depositStatus === 'CONFIRMED' ? 'bg-[#EAF2E3] text-[#5B8C3E]' :
                        dep.depositStatus === 'REFUNDED' ? 'bg-[#FFE0E0] text-[#DC3545]' :
                        dep.depositStatus === 'PENDING' ? 'bg-[#E67E22]/15 text-[#E67E22]' :
                        'bg-[#FEF3CD] text-[#D4A017]'
                      }`}>
                        {dep.depositStatus === 'CONFIRMED' ? t('status.confirmed') :
                         dep.depositStatus === 'REFUNDED' ? t('status.refunded') :
                         dep.depositStatus === 'PENDING' ? t('status.pending') :
                         t('status.pending')}
                      </span>
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="flex items-center gap-6 text-sm text-brown">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-gray-text" /> {formatDateRange(dep.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-text" /> {dep.yurt?.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-gray-text" /> {dep.guestCount} {t('card.guests')}
                    </span>
                    <span className="font-semibold text-amber">${dep.depositAmount}</span>
                  </div>

                  {/* Phone */}
                  {dep.user?.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-brown">
                      <Phone size={14} className="text-gray-text" /> {t('card.depositPhone')} {dep.user.phone}
                    </div>
                  )}

                  {/* Payment screenshot */}
                  {dep.paymentScreenshotUrl && (
                    <div className="flex items-center gap-4">
                      <div className="w-[120px] h-[80px] bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        <img
                          src={dep.paymentScreenshotUrl}
                          alt="Payment screenshot"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                            ;(e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="text-gray-text" width="24" height="24"><use href="#image-icon"/></svg>'
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        {dep.paymentReference && (
                          <span className="text-gray-text">{t('card.txnId')} {dep.paymentReference}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {!dep.paymentScreenshotUrl && dep.status === 'PAYMENT_SUBMITTED' && (
                    <div className="flex items-center gap-4">
                      <div className="w-[120px] h-[80px] bg-gray-100 rounded-lg flex items-center justify-center">
                        <ImageIcon size={24} className="text-gray-text" />
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        {dep.paymentReference && (
                          <span className="text-gray-text">{t('card.txnId')} {dep.paymentReference}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Confirmed date */}
                  {activeTab === 'confirmed' && dep.depositConfirmedAt && (
                    <div className="text-xs text-gray-text">
                      Confirmed on {formatDateRange(dep.depositConfirmedAt)}
                    </div>
                  )}

                  {/* Expiring tab: deadline info */}
                  {activeTab === 'expiring' && timeRemaining && (
                    <div className={`flex items-center gap-1.5 text-sm font-semibold ${timeRemaining.urgent ? 'text-[#DC3545]' : 'text-[#D4A017]'}`}>
                      <AlertTriangle size={14} />
                      Payment deadline: {timeRemaining.text}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    {activeTab === 'pending' && (
                      <>
                        <button
                          onClick={() => handleConfirmDeposit(dep.id)}
                          disabled={isUpdating}
                          className="px-4 py-1.5 bg-[#5B8C3E] text-white text-sm font-semibold rounded-md hover:bg-[#5B8C3E]/90 disabled:opacity-50"
                        >
                          {t('actions.confirmDeposit')}
                        </button>
                        <button
                          disabled={isUpdating}
                          className="px-4 py-1.5 bg-white text-brown text-sm font-semibold rounded-md border border-beige hover:bg-beige/30 disabled:opacity-50"
                        >
                          {t('actions.notReceived')}
                        </button>
                        <button
                          onClick={() => handleReject(dep.id)}
                          disabled={isUpdating}
                          className="px-4 py-1.5 text-[#DC3545] text-sm font-semibold hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {activeTab === 'expiring' && (
                      <button
                        className="px-4 py-1.5 bg-amber text-white text-sm font-semibold rounded-md hover:bg-amber/90"
                      >
                        {t('actions.remind')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
