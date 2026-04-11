"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { Search, X, ChevronRight, Lock, Unlock } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface OrderUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

interface OrderYurt {
  id: string
  name: string
}

interface OrderReservation {
  id: string
  date: string
  guestCount: number
  yurt: OrderYurt
  user: OrderUser
}

interface OrderMenuItem {
  id: string
  nameEn: string
  nameZh: string
  price: number
  imageUrl: string | null
}

interface OrderItemDetail {
  id: string
  orderId: string
  menuItemId: string
  quantity: number
  specialNotes: string | null
  menuItem: OrderMenuItem
}

interface Order {
  id: string
  reservationId: string
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED'
  notes: string | null
  estimatedTotal: number | null
  submittedAt: string | null
  lockedAt: string | null
  createdAt: string
  updatedAt: string
  reservation: OrderReservation
  _count: { items: number }
}

interface OrderDetail extends Omit<Order, '_count'> {
  items: OrderItemDetail[]
}

type TabKey = 'all' | 'SUBMITTED' | 'LOCKED'

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  DRAFT:     { bg: 'bg-gray-100',        text: 'text-gray-500' },
  SUBMITTED: { bg: 'bg-[#F4A623]/15',    text: 'text-[#F4A623]' },
  LOCKED:    { bg: 'bg-[#5B8C3E]/15',    text: 'text-[#5B8C3E]' },
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

export default function Orders() {
  const t = useTranslations('admin.orders')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
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
    if (search.trim()) params.set('search', search.trim())
    const qs = params.toString()
    return `/api/orders${qs ? `?${qs}` : ''}`
  }, [activeTab, search])

  const { data: orders, isLoading, mutate } = useSWR<Order[]>(apiUrl, fetcher)

  // Fetch order detail when selecting
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null)
      return
    }
    let cancelled = false
    fetch(`/api/orders/${selectedOrderId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data: OrderDetail) => {
        if (!cancelled) setSelectedOrder(data)
      })
      .catch(() => {
        if (!cancelled) setSelectedOrder(null)
      })
    return () => { cancelled = true }
  }, [selectedOrderId])

  // ── Tab config ──────────────────────────────────────────────

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('tabs.all') },
    { key: 'SUBMITTED', label: t('tabs.SUBMITTED') },
    { key: 'LOCKED', label: t('tabs.LOCKED') },
  ]

  // ── Actions ──────────────────────────────────────────────────

  const handleLock = useCallback(async (id: string) => {
    if (!confirm(t('actions.confirmLock'))) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to lock order')
        return
      }
      const updated: OrderDetail = await res.json()
      setSelectedOrder(updated)
      mutate()
      showSuccess(t('actions.lock') + ' - OK')
    } catch {
      alert('Failed to lock order')
    } finally {
      setUpdating(false)
    }
  }, [mutate, showSuccess, t])

  const handleUnlock = useCallback(async (id: string) => {
    if (!confirm(t('actions.confirmUnlock'))) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock' }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to unlock order')
        return
      }
      const updated: OrderDetail = await res.json()
      setSelectedOrder(updated)
      mutate()
      showSuccess(t('actions.unlock') + ' - OK')
    } catch {
      alert('Failed to unlock order')
    } finally {
      setUpdating(false)
    }
  }, [mutate, showSuccess, t])

  const clearFilters = useCallback(() => {
    setActiveTab('all')
    setSearch('')
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
        <div className={`flex-1 p-6 flex flex-col gap-5 overflow-auto transition-all ${selectedOrderId ? 'mr-0' : ''}`}>
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

          {/* Search */}
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
            {(search || activeTab !== 'all') && (
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
              <div className="p-8 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-beige/30 rounded animate-pulse" />
                ))}
              </div>
            ) : !orders?.length ? (
              <div className="p-8 text-center text-gray-text text-sm">{t('noResults')}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-beige">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.guest')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.date')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.yurt')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.items')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.total')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.status')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const badge = STATUS_BADGE[o.status] || STATUS_BADGE.DRAFT
                    return (
                      <tr
                        key={o.id}
                        className={`border-b border-beige last:border-b-0 hover:bg-cream-bg/50 cursor-pointer ${selectedOrderId === o.id ? 'bg-amber/5' : ''}`}
                        onClick={() => setSelectedOrderId(o.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-brown">{o.reservation.user?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-text">{o.reservation.user?.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-brown">{formatDateDisplay(o.reservation.date)}</td>
                        <td className="px-4 py-3 text-sm text-brown">{o.reservation.yurt?.name}</td>
                        <td className="px-4 py-3 text-sm text-brown">{o._count.items}</td>
                        <td className="px-4 py-3 text-sm text-brown font-medium">
                          {o.estimatedTotal != null ? `$${o.estimatedTotal.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                            {t(`status.${o.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedOrderId(o.id) }}
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
        {selectedOrderId && (
          <div className="w-[420px] border-l border-beige bg-white flex flex-col overflow-hidden shrink-0">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-beige">
              <h3 className="text-base font-bold text-brown">{t('detail.title')}</h3>
              <button onClick={() => setSelectedOrderId(null)} className="p-1 hover:bg-beige/30 rounded">
                <X size={18} className="text-gray-text" />
              </button>
            </div>

            {/* Panel body */}
            {!selectedOrder ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-text text-sm">{t('loading')}</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                  {/* Status badge + ID */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_BADGE[selectedOrder.status]?.bg} ${STATUS_BADGE[selectedOrder.status]?.text}`}>
                      {t(`status.${selectedOrder.status}`)}
                    </span>
                    <span className="text-xs text-gray-text">#{selectedOrder.id.slice(-8)}</span>
                  </div>

                  {/* Reservation Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-brown">{t('detail.reservationInfo')}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-gray-text uppercase">{t('detail.date')}</div>
                        <div className="text-sm text-brown font-medium">
                          {formatDateDisplay(selectedOrder.reservation.date)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-text uppercase">{t('detail.yurt')}</div>
                        <div className="text-sm text-brown font-medium">{selectedOrder.reservation.yurt?.name}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-text uppercase">{t('detail.guests')}</div>
                        <div className="text-sm text-brown font-medium">{selectedOrder.reservation.guestCount}</div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-beige" />

                  {/* Guest Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-brown">{t('detail.guestInfo')}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-text">{t('detail.name')}</span>
                        <span className="text-sm text-brown font-medium">{selectedOrder.reservation.user?.name || t('detail.notProvided')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-text">{t('detail.email')}</span>
                        <span className="text-sm text-brown">{selectedOrder.reservation.user?.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-text">{t('detail.phone')}</span>
                        <span className="text-sm text-brown">{selectedOrder.reservation.user?.phone || t('detail.notProvided')}</span>
                      </div>
                    </div>
                  </div>

                  <hr className="border-beige" />

                  {/* Order Items */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-brown">{t('detail.orderItems')}</h4>
                    {selectedOrder.items?.length ? (
                      <div className="space-y-2">
                        {/* Header row */}
                        <div className="grid grid-cols-[1fr_40px_60px_60px] gap-2 text-[10px] text-gray-text uppercase">
                          <span>{t('detail.item')}</span>
                          <span className="text-center">{t('detail.qty')}</span>
                          <span className="text-right">{t('detail.price')}</span>
                          <span className="text-right">{t('detail.subtotal')}</span>
                        </div>
                        {selectedOrder.items.map((item) => (
                          <div key={item.id}>
                            <div className="grid grid-cols-[1fr_40px_60px_60px] gap-2 items-start py-1.5 border-t border-beige/50">
                              <div>
                                <div className="text-sm text-brown font-medium">{item.menuItem.nameEn}</div>
                                <div className="text-xs text-gray-text">{item.menuItem.nameZh}</div>
                              </div>
                              <div className="text-sm text-brown text-center">{item.quantity}</div>
                              <div className="text-sm text-brown text-right">${item.menuItem.price.toFixed(2)}</div>
                              <div className="text-sm text-brown text-right font-medium">
                                ${(item.menuItem.price * item.quantity).toFixed(2)}
                              </div>
                            </div>
                            {item.specialNotes && (
                              <div className="mt-1 ml-1 text-xs text-[#F4A623] italic">
                                {t('detail.kitchenNotes')}: {item.specialNotes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-text">{t('noResults')}</p>
                    )}
                  </div>

                  {/* General notes */}
                  {selectedOrder.notes && (
                    <>
                      <hr className="border-beige" />
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold text-brown">{t('detail.generalNotes')}</h4>
                        <p className="text-sm text-brown bg-[#F4A623]/5 rounded p-2">{selectedOrder.notes}</p>
                      </div>
                    </>
                  )}

                  <hr className="border-beige" />

                  {/* Estimated Total */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-brown">{t('detail.estimatedTotal')}</span>
                    <span className="text-lg font-bold text-brown">
                      {selectedOrder.estimatedTotal != null ? `$${selectedOrder.estimatedTotal.toFixed(2)}` : '—'}
                    </span>
                  </div>

                  <hr className="border-beige" />

                  {/* Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-brown">{t('detail.timeline')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-text">{t('detail.created')}</span>
                        <span className="text-xs text-brown">{formatDateTime(selectedOrder.createdAt)}</span>
                      </div>
                      {selectedOrder.submittedAt && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-text">{t('detail.submitted')}</span>
                          <span className="text-xs text-brown">{formatDateTime(selectedOrder.submittedAt)}</span>
                        </div>
                      )}
                      {selectedOrder.lockedAt && (
                        <div className="flex justify-between">
                          <span className="text-xs text-[#5B8C3E]">{t('detail.locked')}</span>
                          <span className="text-xs text-brown">{formatDateTime(selectedOrder.lockedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Panel actions */}
                <div className="px-5 py-4 border-t border-beige flex flex-col gap-2">
                  {/* Lock - show for SUBMITTED */}
                  {selectedOrder.status === 'SUBMITTED' && (
                    <button
                      onClick={() => handleLock(selectedOrder.id)}
                      disabled={updating}
                      className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Lock size={14} />
                      {t('actions.lock')}
                    </button>
                  )}

                  {/* Unlock - show for LOCKED */}
                  {selectedOrder.status === 'LOCKED' && (
                    <button
                      onClick={() => handleUnlock(selectedOrder.id)}
                      disabled={updating}
                      className="w-full py-2 text-sm font-semibold rounded-lg border border-[#F4A623] text-[#F4A623] hover:bg-[#F4A623]/5 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Unlock size={14} />
                      {t('actions.unlock')}
                    </button>
                  )}

                  {/* Close panel */}
                  <button
                    onClick={() => setSelectedOrderId(null)}
                    className="w-full py-2 text-sm font-semibold rounded-lg border border-beige text-gray-text hover:bg-beige/30"
                  >
                    {t('actions.close')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
