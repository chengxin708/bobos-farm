"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import Link from 'next/link'
import TopBar from '@/components/admin/TopBar'
import { Search, X, ChevronRight, ShoppingBag, MessageSquare, History } from 'lucide-react'

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

interface OrderItem {
  id: string
  quantity: number
  menuItem: {
    id: string
    nameEn: string
    nameZh: string | null
    price: number
  }
}

interface Order {
  id: string
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED'
  estimatedTotal: number | null
  notes: string | null
  submittedAt: string | null
  items: OrderItem[]
}

interface ActivityLog {
  id: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  user?: { name: string | null; email: string } | null
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
  order?: Order | null
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

const ORDER_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:     { bg: 'bg-gray-100',       text: 'text-gray-500',   label: 'Draft' },
  SUBMITTED: { bg: 'bg-[#E67E22]/15',   text: 'text-[#E67E22]',  label: 'Submitted' },
  LOCKED:    { bg: 'bg-[#2980B9]/15',   text: 'text-[#2980B9]',  label: 'Locked' },
}

function activityLogText(log: ActivityLog): string {
  const details = log.details as Record<string, unknown> | null
  const actor = log.user?.name || log.user?.email || 'System'
  switch (log.action) {
    case 'RESERVATION_MODIFIED': {
      const parts: string[] = []
      if (details?.guestCount) parts.push(`guest count to ${details.guestCount}`)
      if (details?.specialRequests !== undefined) parts.push('special requests')
      return parts.length
        ? `${actor} updated ${parts.join(' and ')}`
        : `${actor} modified reservation`
    }
    case 'RESERVATION_RESCHEDULED':
      return `${actor} rescheduled reservation`
    case 'RESERVATION_CANCELLED':
      return `${actor} cancelled reservation`
    case 'PAYMENT_SUBMITTED':
      return `${actor} submitted payment`
    case 'DEPOSIT_CONFIRMED':
      return `Deposit confirmed by ${actor}`
    case 'ORDER_SUBMITTED':
      return `${actor} submitted a pre-order`
    case 'ORDER_UPDATED':
      return `${actor} updated their pre-order`
    default:
      return `${log.action.replace(/_/g, ' ').toLowerCase()} by ${actor}`
  }
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setSuccessMsg(null), 3000)
  }, [])

  // Redirect non-admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [sessionStatus, session, router])

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

  // ── Fetch full detail + activity logs when a reservation is selected ──
  const { data: detailRes } = useSWR<Reservation>(
    selectedRes ? `/api/reservations/${selectedRes.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  const { data: activityLogs } = useSWR<ActivityLog[]>(
    selectedRes ? `/api/activity-logs?targetId=${selectedRes.id}&targetType=RESERVATION` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

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

  const handleAction = useCallback(async (id: string, action: string, data?: Record<string, unknown>): Promise<boolean> => {
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
        return false
      }

      const updated = await res.json()
      // Update selected reservation if it's the same one
      if (selectedRes?.id === id) setSelectedRes(updated)
      mutate()
      return true
    } catch {
      alert('Failed to update reservation')
      return false
    } finally {
      setUpdating(false)
    }
  }, [selectedRes, mutate])

  const confirmDeposit = useCallback(async (id: string) => {
    if (!confirm('Confirm this deposit? The reservation will become active.')) return
    const ok = await handleAction(id, 'admin', {
      status: 'CONFIRMED',
      depositStatus: 'CONFIRMED',
      depositConfirmedAt: new Date().toISOString(),
    })
    if (ok) showSuccess('Deposit confirmed. Reservation is now active.')
  }, [handleAction, showSuccess])

  const cancelReservation = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation? This cannot be undone.')) return
    const ok = await handleAction(id, 'cancel')
    if (ok) showSuccess('Reservation cancelled successfully.')
  }, [handleAction, showSuccess])

  const completeReservation = useCallback(async (id: string) => {
    if (!confirm('Mark this reservation as completed?')) return
    const ok = await handleAction(id, 'admin', { status: 'COMPLETED' })
    if (ok) showSuccess('Reservation marked as completed.')
  }, [handleAction, showSuccess])

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
          {/* Success Message */}
          {successMsg && (
            <div className="bg-[#EAF2E3] border border-[#5B8C3E]/30 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
              {successMsg}
              <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/60 hover:text-[#2D5016]">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
          )}

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
        {selectedRes && (() => {
          const panelRes: Reservation = detailRes || selectedRes
          const panelOrder = detailRes?.order || null
          return (
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
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_BADGE[panelRes.status]?.bg} ${STATUS_BADGE[panelRes.status]?.text}`}>
                  {t(`status.${panelRes.status}`)}
                </span>
                <span className="text-xs text-gray-text">#{panelRes.id.slice(-8)}</span>
              </div>

              {/* Reservation Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-brown">{t('detail.reservationInfo')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.date')}</div>
                    <div className="text-sm text-brown font-medium">{formatDateDisplay(panelRes.date)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.yurt')}</div>
                    <div className="text-sm text-brown font-medium">{panelRes.yurt?.name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-text uppercase">{t('detail.guests')}</div>
                    <div className="text-sm text-brown font-medium">{panelRes.guestCount}</div>
                  </div>
                </div>
              </div>

              {/* Special Requests — highlighted */}
              {panelRes.specialRequests && (
                <div className="rounded-lg border border-[#8B6914]/20 bg-[#8B6914]/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare size={13} className="text-[#8B6914]" />
                    <span className="text-xs font-semibold text-[#8B6914] uppercase">{t('detail.specialRequests')}</span>
                  </div>
                  <p className="text-sm text-brown leading-relaxed">{panelRes.specialRequests}</p>
                </div>
              )}

              <hr className="border-beige" />

              {/* Pre-order Summary */}
              {panelOrder && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag size={14} className="text-[#E67E22]" />
                        <h4 className="text-sm font-bold text-brown">{t('detail.preOrder')}</h4>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_BADGE[panelOrder.status]?.bg} ${ORDER_STATUS_BADGE[panelOrder.status]?.text}`}>
                        {ORDER_STATUS_BADGE[panelOrder.status]?.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-text">{t('detail.itemCount')}</span>
                        <span className="text-sm text-brown font-medium">{panelOrder.items?.length ?? 0} items</span>
                      </div>
                      {panelOrder.estimatedTotal != null && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-text">{t('detail.estimatedTotal')}</span>
                          <span className="text-sm text-brown font-medium">${panelOrder.estimatedTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/admin/orders"
                      className="flex items-center gap-1 text-xs font-semibold text-[#8B6914] hover:underline"
                    >
                      {t('detail.viewFullOrder')} <ChevronRight size={12} />
                    </Link>
                  </div>
                  <hr className="border-beige" />
                </>
              )}

              {/* Guest Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-brown">{t('detail.guestInfo')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.name')}</span>
                    <span className="text-sm text-brown font-medium">{panelRes.user?.name || t('detail.notProvided')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.email')}</span>
                    <span className="text-sm text-brown">{panelRes.user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.phone')}</span>
                    <span className="text-sm text-brown">{panelRes.user?.phone || t('detail.notProvided')}</span>
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
                    <span className="text-sm text-brown font-medium">${panelRes.depositAmount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-text">{t('detail.depositStatus')}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DEPOSIT_BADGE[panelRes.depositStatus]?.bg} ${DEPOSIT_BADGE[panelRes.depositStatus]?.text}`}>
                      {t(`depositStatus.${panelRes.depositStatus}`)}
                    </span>
                  </div>
                  {panelRes.paymentReference && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-text">{t('detail.paymentReference')}</span>
                      <span className="text-sm text-brown">{panelRes.paymentReference}</span>
                    </div>
                  )}
                  {panelRes.paymentDeadline && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-text">{t('detail.paymentDeadline')}</span>
                      <span className="text-sm text-brown">{formatDateTime(panelRes.paymentDeadline)}</span>
                    </div>
                  )}
                  {panelRes.paymentScreenshotUrl && (
                    <div>
                      <span className="text-xs text-gray-text">{t('detail.screenshot')}</span>
                      <a
                        href={panelRes.paymentScreenshotUrl}
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

              {/* Activity Timeline */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <History size={14} className="text-[#8B6914]" />
                  <h4 className="text-sm font-bold text-brown">{t('detail.timeline')}</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.created')}</span>
                    <span className="text-xs text-brown">{formatDateTime(panelRes.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-text">{t('detail.updated')}</span>
                    <span className="text-xs text-brown">{formatDateTime(panelRes.updatedAt)}</span>
                  </div>
                  {panelRes.cancelledAt && (
                    <div className="flex justify-between">
                      <span className="text-xs text-[#DC3545]">Cancelled</span>
                      <span className="text-xs text-brown">{formatDateTime(panelRes.cancelledAt)}</span>
                    </div>
                  )}
                  {panelRes.cancelReason && (
                    <div className="mt-1 p-2 rounded bg-[#DC3545]/5 text-xs text-[#DC3545]">
                      Reason: {panelRes.cancelReason}
                    </div>
                  )}
                </div>

                {/* Modification history from activity logs */}
                {activityLogs && activityLogs.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-[10px] text-gray-text uppercase font-semibold">{t('detail.modifications')}</div>
                    <div className="relative pl-3.5 space-y-0">
                      {/* Vertical timeline line */}
                      <div className="absolute left-[5px] top-1 bottom-1 w-px bg-beige" />
                      {activityLogs.map((log) => (
                        <div key={log.id} className="relative flex items-start gap-2.5 py-1.5">
                          <span className="relative z-10 mt-1.5 shrink-0 w-[7px] h-[7px] rounded-full bg-[#8B6914] ring-2 ring-white" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-brown leading-snug block">{activityLogText(log)}</span>
                            <span className="text-[10px] text-gray-text">{formatDateTime(log.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel actions */}
            <div className="px-5 py-4 border-t border-beige flex flex-col gap-2">
              {/* Confirm Deposit - show for PAYMENT_SUBMITTED */}
              {panelRes.status === 'PAYMENT_SUBMITTED' && (
                <button
                  onClick={() => confirmDeposit(panelRes.id)}
                  disabled={updating}
                  className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
                >
                  {t('actions.confirm')}
                </button>
              )}

              {/* Complete - show for CONFIRMED */}
              {panelRes.status === 'CONFIRMED' && (
                <button
                  onClick={() => completeReservation(panelRes.id)}
                  disabled={updating}
                  className="w-full py-2 text-sm font-semibold rounded-lg bg-[#2980B9] text-white hover:bg-[#2980B9]/90 disabled:opacity-50"
                >
                  {t('actions.complete')}
                </button>
              )}

              {/* Cancel - show for non-terminal states */}
              {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(panelRes.status) && (
                <button
                  onClick={() => cancelReservation(panelRes.id)}
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
          )
        })()}
      </div>
    </>
  )
}
