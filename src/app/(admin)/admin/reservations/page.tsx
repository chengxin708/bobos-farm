"use client"

import { useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { Search, X, ChevronRight } from 'lucide-react'

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

type TabKey = 'all' | 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING_PAYMENT:   { bg: 'bg-[#F4A623]/15', text: 'text-[#F4A623]' },
  PAYMENT_SUBMITTED: { bg: 'bg-[#E67E22]/15', text: 'text-[#E67E22]' },
  CONFIRMED:         { bg: 'bg-[#2980B9]/15', text: 'text-[#2980B9]' },
  COMPLETED:         { bg: 'bg-[#5B8C3E]/15', text: 'text-[#5B8C3E]' },
  CANCELLED:         { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
  EXPIRED:           { bg: 'bg-gray-100',      text: 'text-gray-500' },
}

const DEPOSIT_BADGE: Record<string, { bg: string; text: string }> = {
  UNPAID:    { bg: 'bg-gray-100',       text: 'text-gray-500' },
  PENDING:   { bg: 'bg-[#F4A623]/15',   text: 'text-[#F4A623]' },
  CONFIRMED: { bg: 'bg-[#5B8C3E]/15',   text: 'text-[#5B8C3E]' },
  REFUNDED:  { bg: 'bg-[#2980B9]/15',   text: 'text-[#2980B9]' },
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Component ──────────────────────────────────────────────────────

export default function Reservations() {
  const t = useTranslations('admin.reservations')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [updating, setUpdating] = useState(false)

  // Redirect non-admin
  if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
    router.push('/')
    return null
  }

  // ── API URL construction ─────────────────────────────────────

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (activeTab !== 'all') params.set('status', activeTab)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (search.trim()) params.set('search', search.trim())
    const qs = params.toString()
    return `/api/reservations${qs ? `?${qs}` : ''}`
  }, [activeTab, startDate, endDate, search])

  const { data: reservations, isLoading, mutate } = useSWR<Reservation[]>(apiUrl, fetcher)

  // ── Tab counts (basic - from current data) ───────────────────

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'PENDING_PAYMENT', label: t('tabs.pendingPayment') },
    { key: 'PAYMENT_SUBMITTED', label: t('tabs.paymentSubmitted') },
    { key: 'CONFIRMED', label: t('tabs.confirmed') },
    { key: 'COMPLETED', label: t('tabs.completed') },
    { key: 'CANCELLED', label: t('tabs.cancelled') },
    { key: 'EXPIRED', label: t('tabs.expired') },
  ]

  // ── Actions ──────────────────────────────────────────────────

  const handleAction = useCallback(async (id: string, action: string, data?: Record<string, unknown>) => {
    setUpdating(true)
    try {
      const body = action === 'cancel'
        ? { action: 'cancel' }
        : { ...data }

      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to update reservation')
        return
      }

      const updated = await res.json()
      // Update selected reservation if it's the same one
      if (selectedRes?.id === id) setSelectedRes(updated)
      mutate()
    } catch {
      alert('Failed to update reservation')
    } finally {
      setUpdating(false)
    }
  }, [selectedRes, mutate])

  const confirmDeposit = useCallback((id: string) => {
    handleAction(id, 'admin', {
      status: 'CONFIRMED',
      depositStatus: 'CONFIRMED',
      depositConfirmedAt: new Date().toISOString(),
    })
  }, [handleAction])

  const cancelReservation = useCallback((id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return
    handleAction(id, 'cancel')
  }, [handleAction])

  const completeReservation = useCallback((id: string) => {
    handleAction(id, 'admin', { status: 'COMPLETED' })
  }, [handleAction])

  const clearFilters = useCallback(() => {
    setActiveTab('all')
    setSearch('')
    setStartDate('')
    setEndDate('')
  }, [])

  // ── Loading state ────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <TopBar title={t('title')} />
        <div className="flex-1 p-6 flex items-center justify-center bg-cream-bg">
          <p className="text-gray-text">{t('loading')}</p>
        </div>
      </>
    )
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex bg-cream-bg overflow-hidden">
        {/* Main Content */}
        <div className={`flex-1 p-6 flex flex-col gap-5 overflow-auto transition-all ${selectedRes ? 'mr-0' : ''}`}>
          {/* Title + subtitle */}
          <div>
            <h2 className="text-xl font-bold text-brown font-playfair">{t('title')}</h2>
            <p className="text-sm text-gray-text mt-0.5">{t('subtitle')}</p>
          </div>

          {/* Search + Date filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex items-center bg-white border border-beige rounded-md px-3 py-2 gap-2 w-72">
              <Search size={16} className="text-gray-text shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="text-sm bg-transparent outline-none flex-1"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-text hover:text-brown">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-text">{t('startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm border border-beige rounded-md px-2 py-1.5 bg-white text-brown"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-text">{t('endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm border border-beige rounded-md px-2 py-1.5 bg-white text-brown"
              />
            </div>
            {(search || startDate || endDate || activeTab !== 'all') && (
              <button onClick={clearFilters} className="text-xs text-amber font-semibold hover:underline">
                {t('clearFilters')}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-beige overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-amber text-amber'
                    : 'border-transparent text-gray-text hover:text-brown'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-beige overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-text text-sm">{t('loading')}</div>
            ) : !reservations?.length ? (
              <div className="p-8 text-center text-gray-text text-sm">{t('noResults')}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-beige">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.guest')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.date')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.yurt')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.guests')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.status')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.deposit')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => {
                    const sBadge = STATUS_BADGE[r.status] || STATUS_BADGE.EXPIRED
                    const dBadge = DEPOSIT_BADGE[r.depositStatus] || DEPOSIT_BADGE.UNPAID
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-beige last:border-b-0 hover:bg-cream-bg/50 cursor-pointer ${selectedRes?.id === r.id ? 'bg-amber/5' : ''}`}
                        onClick={() => setSelectedRes(r)}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-brown">{r.user?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-text">{r.user?.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-brown">{formatDateDisplay(r.date)}</td>
                        <td className="px-4 py-3 text-sm text-brown">{r.yurt?.name}</td>
                        <td className="px-4 py-3 text-sm text-brown">{r.guestCount}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sBadge.bg} ${sBadge.text}`}>
                            {t(`status.${r.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dBadge.bg} ${dBadge.text}`}>
                            {t(`depositStatus.${r.depositStatus}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedRes(r) }}
                            className="text-xs font-semibold text-amber hover:underline flex items-center gap-0.5"
                          >
                            {t('actions.view')} <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail Side Panel */}
        {selectedRes && (
          <div className="w-[400px] border-l border-beige bg-white flex flex-col overflow-hidden shrink-0">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-beige">
              <h3 className="text-base font-bold text-brown">{t('detail.title')}</h3>
              <button onClick={() => setSelectedRes(null)} className="p-1 hover:bg-beige/30 rounded">
                <X size={18} className="text-gray-text" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_BADGE[selectedRes.status]?.bg} ${STATUS_BADGE[selectedRes.status]?.text}`}>
                  {t(`status.${selectedRes.status}`)}
                </span>
                <span className="text-xs text-gray-text">#{selectedRes.id.slice(-8)}</span>
              </div>

              {/* Reservation Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-brown">{t('detail.reservationInfo')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.date')}</div>
                    <div className="text-sm text-brown font-medium">{formatDateDisplay(selectedRes.date)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.yurt')}</div>
                    <div className="text-sm text-brown font-medium">{selectedRes.yurt?.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.guests')}</div>
                    <div className="text-sm text-brown font-medium">{selectedRes.guestCount}</div>
                  </div>
                </div>
                {selectedRes.specialRequests && (
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.specialRequests')}</div>
                    <div className="text-sm text-brown mt-0.5">{selectedRes.specialRequests}</div>
                  </div>
                )}
              </div>

              <hr className="border-beige" />

              {/* Guest Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-brown">{t('detail.guestInfo')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.name')}</span>
                    <span className="text-sm text-brown font-medium">{selectedRes.user?.name || t('detail.notProvided')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.email')}</span>
                    <span className="text-sm text-brown">{selectedRes.user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.phone')}</span>
                    <span className="text-sm text-brown">{selectedRes.user?.phone || t('detail.notProvided')}</span>
                  </div>
                </div>
              </div>

              <hr className="border-beige" />

              {/* Payment Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-brown">{t('detail.paymentInfo')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.depositAmount')}</span>
                    <span className="text-sm text-brown font-medium">${selectedRes.depositAmount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-text">{t('detail.depositStatus')}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DEPOSIT_BADGE[selectedRes.depositStatus]?.bg} ${DEPOSIT_BADGE[selectedRes.depositStatus]?.text}`}>
                      {t(`depositStatus.${selectedRes.depositStatus}`)}
                    </span>
                  </div>
                  {selectedRes.paymentReference && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-text">{t('detail.paymentReference')}</span>
                      <span className="text-sm text-brown">{selectedRes.paymentReference}</span>
                    </div>
                  )}
                  {selectedRes.paymentDeadline && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-text">{t('detail.paymentDeadline')}</span>
                      <span className="text-sm text-brown">{formatDateTime(selectedRes.paymentDeadline)}</span>
                    </div>
                  )}
                  {selectedRes.paymentScreenshotUrl && (
                    <div>
                      <span className="text-xs text-gray-text">{t('detail.screenshot')}</span>
                      <a
                        href={selectedRes.paymentScreenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber font-semibold hover:underline ml-2"
                      >
                        {t('detail.viewScreenshot')}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-beige" />

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-brown">{t('detail.timeline')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.created')}</span>
                    <span className="text-xs text-brown">{formatDateTime(selectedRes.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.updated')}</span>
                    <span className="text-xs text-brown">{formatDateTime(selectedRes.updatedAt)}</span>
                  </div>
                  {selectedRes.cancelledAt && (
                    <div className="flex justify-between">
                      <span className="text-xs text-[#DC3545]">Cancelled</span>
                      <span className="text-xs text-brown">{formatDateTime(selectedRes.cancelledAt)}</span>
                    </div>
                  )}
                  {selectedRes.cancelReason && (
                    <div className="mt-1 p-2 rounded bg-[#DC3545]/5 text-xs text-[#DC3545]">
                      Reason: {selectedRes.cancelReason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel actions */}
            <div className="px-5 py-4 border-t border-beige flex flex-col gap-2">
              {/* Confirm Deposit - show for PAYMENT_SUBMITTED */}
              {selectedRes.status === 'PAYMENT_SUBMITTED' && (
                <button
                  onClick={() => confirmDeposit(selectedRes.id)}
                  disabled={updating}
                  className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
                >
                  {t('actions.confirm')}
                </button>
              )}

              {/* Complete - show for CONFIRMED */}
              {selectedRes.status === 'CONFIRMED' && (
                <button
                  onClick={() => completeReservation(selectedRes.id)}
                  disabled={updating}
                  className="w-full py-2 text-sm font-semibold rounded-lg bg-[#2980B9] text-white hover:bg-[#2980B9]/90 disabled:opacity-50"
                >
                  {t('actions.complete')}
                </button>
              )}

              {/* Cancel - show for non-terminal states */}
              {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(selectedRes.status) && (
                <button
                  onClick={() => cancelReservation(selectedRes.id)}
                  disabled={updating}
                  className="w-full py-2 text-sm font-semibold rounded-lg border border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545]/5 disabled:opacity-50"
                >
                  {t('actions.cancel')}
                </button>
              )}

              {/* Close panel */}
              <button
                onClick={() => setSelectedRes(null)}
                className="w-full py-2 text-sm font-semibold rounded-lg border border-beige text-gray-text hover:bg-beige/30"
              >
                {t('actions.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
