'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations, useLocale } from 'next-intl'
import useSWR from 'swr'
import { X, ShoppingBag, MessageSquare, History, Lock, Unlock, Pencil, Check } from 'lucide-react'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import {
  type Reservation,
  type Order,
  type ActivityLog,
  STATUS_BADGE,
  DEPOSIT_BADGE,
  ORDER_STATUS_BADGE,
  formatDateDisplay,
  formatDateTime,
  activityLogText,
} from './useReservationsData'
import AdminOrderEditor from '@/components/admin/orders/AdminOrderEditor'
import CheckoutPanel from '@/components/admin/orders/CheckoutPanel'
import EditReservationEditor from '@/components/admin/reservations/EditReservationEditor'

// ── Helpers ───────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

// ── Props ──────────────────────────────────────────────────────────

interface ReservationDetailProps {
  reservation: Reservation
  activityLogs: ActivityLog[]
  onClose: () => void
  onAction: {
    confirmDeposit: (id: string) => void
    cancelReservation: (id: string) => void
    completeReservation: (id: string) => void
  }
  isUpdating: boolean
  onOrderChanged?: () => void
}

// ── Yurt type for assign dropdown ────────────────────────────────
interface YurtOption {
  id: string
  name: string
  alias?: string | null
  capacity: number
  status: string
}

// ── Component ──────────────────────────────────────────────────────

export default function ReservationDetail({
  reservation,
  activityLogs,
  onClose,
  onAction,
  isUpdating,
  onOrderChanged,
}: ReservationDetailProps) {
  const t = useTranslations('admin.reservations')
  const tc = useTranslations('admin.common')
  const tOrders = useTranslations('admin.orders')
  const locale = useLocale()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'
  const panelOrder = reservation.order || null

  const [detailTab, setDetailTab] = useState<'info' | 'order'>('info')
  const [showOrderEditor, setShowOrderEditor] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showEditEditor, setShowEditEditor] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'deposit' | 'waiveDeposit' | 'complete' | 'cancel' | null>(null)
  const [editingDeposit, setEditingDeposit] = useState(false)
  const [depositInput, setDepositInput] = useState('')
  const [savingDeposit, setSavingDeposit] = useState(false)
  const [unlockingDeposit, setUnlockingDeposit] = useState(false)

  // Assign Yurt state
  const [selectedYurtId, setSelectedYurtId] = useState('')
  const [assigningYurt, setAssigningYurt] = useState(false)

  // Fetch available yurts when no yurt assigned
  const { data: allYurts } = useSWR<YurtOption[]>(
    reservation.yurtId === null ? '/api/yurts' : null,
    fetcher,
    { revalidateOnFocus: false }
  )
  // Fetch reservations for the same date to determine occupied yurts
  const { data: dateReservations } = useSWR<Reservation[]>(
    reservation.yurtId === null ? `/api/reservations?date=${reservation.date}` : null,
    (url: string) => fetch(url).then(r => r.json()).then(d => d.reservations ?? d),
    { revalidateOnFocus: false }
  )

  const occupiedYurtIds = new Set(
    (dateReservations || [])
      .filter(r => r.id !== reservation.id && r.yurtId && !['CANCELLED', 'EXPIRED'].includes(r.status))
      .map(r => r.yurtId)
  )

  const activeYurts = (allYurts || []).filter(y => y.status === 'ACTIVE')

  const handleAssignYurt = async () => {
    if (!selectedYurtId) return
    setAssigningYurt(true)
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_yurt', yurtId: selectedYurtId }),
      })
      if (res.ok) {
        onOrderChanged?.()
      }
    } catch { /* ignore */ }
    finally { setAssigningYurt(false) }
  }

  const handleWaiveDeposit = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CONFIRMED',
          depositAmount: 0,
          depositStatus: 'CONFIRMED',
          depositConfirmedAt: new Date().toISOString(),
        }),
      })
      if (res.ok) onOrderChanged?.()
    } catch { /* ignore */ }
  }, [reservation.id, onOrderChanged])

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return
    if (confirmAction === 'deposit') onAction.confirmDeposit(reservation.id)
    if (confirmAction === 'waiveDeposit') handleWaiveDeposit()
    if (confirmAction === 'complete') onAction.completeReservation(reservation.id)
    if (confirmAction === 'cancel') onAction.cancelReservation(reservation.id)
    setConfirmAction(null)
  }, [confirmAction, onAction, reservation.id, handleWaiveDeposit])

  const confirmDialogConfig = {
    deposit: { title: t('dialog.confirmDeposit'), message: t('dialog.confirmDepositMsg'), variant: 'success' as const, confirmLabel: t('actions.confirm') },
    waiveDeposit: { title: t('dialog.waiveDeposit'), message: t('dialog.waiveDepositMsg'), variant: 'confirm' as const, confirmLabel: t('dialog.waiveDepositConfirm') },
    complete: { title: t('dialog.completeReservation'), message: t('dialog.completeReservationMsg'), variant: 'confirm' as const, confirmLabel: t('actions.complete') },
    cancel: { title: t('dialog.cancelReservation'), message: t('dialog.cancelReservationMsg'), variant: 'danger' as const, confirmLabel: t('actions.cancel') },
  }

  // Fetch full order details (with items) when order exists
  const { data: fullOrder, mutate: mutateOrder } = useSWR<Order>(
    panelOrder?.id ? `/api/orders/${panelOrder.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Use fullOrder if available, fallback to panelOrder
  const orderData = fullOrder || panelOrder

  const handleOrderSaved = () => {
    mutateOrder()
    onOrderChanged?.()
  }

  const handleCheckoutCompleted = () => {
    setShowCheckout(false)
    mutateOrder()
    onOrderChanged?.()
  }

  const handleSaveDeposit = async () => {
    const amount = Number(depositInput)
    if (isNaN(amount) || amount < 0) return
    setSavingDeposit(true)
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', depositAmount: amount }),
      })
      if (res.ok) {
        onOrderChanged?.()
        setEditingDeposit(false)
      }
    } catch { /* ignore */ }
    finally { setSavingDeposit(false) }
  }

  const handleUnlockDeposit = async () => {
    setUnlockingDeposit(true)
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositStatus: 'PENDING', depositConfirmedAt: null }),
      })
      if (res.ok) {
        onOrderChanged?.()
      }
    } catch { /* ignore */ }
    finally { setUnlockingDeposit(false) }
  }

  const handleMarkRefunded = async () => {
    setSavingDeposit(true)
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositStatus: 'REFUNDED' }),
      })
      if (res.ok) {
        onOrderChanged?.()
      }
    } catch { /* ignore */ }
    finally { setSavingDeposit(false) }
  }

  const handleRelockDeposit = async () => {
    setSavingDeposit(true)
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositStatus: 'CONFIRMED', depositConfirmedAt: new Date().toISOString() }),
      })
      if (res.ok) {
        onOrderChanged?.()
      }
    } catch { /* ignore */ }
    finally { setSavingDeposit(false) }
  }

  const handleLockOrder = async () => {
    if (!orderData) return
    await fetch(`/api/orders/${orderData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' }),
    })
    mutateOrder()
    onOrderChanged?.()
  }

  const handleUnlockOrder = async () => {
    if (!orderData) return
    await fetch(`/api/orders/${orderData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unlock' }),
    })
    mutateOrder()
    onOrderChanged?.()
  }

  // ── Tab: Reservation Info ────────────────────────────────────

  function renderInfoTab() {
    return (
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Assign Yurt — shown when no yurt assigned */}
        {reservation.yurtId === null && isAdmin && (
          <div className="rounded-lg p-4" style={{ backgroundColor: '#FFF8E1' }}>
            <label className="text-sm font-semibold text-[#8B6914] block mb-2">{t('assignYurt')}</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedYurtId}
                onChange={e => setSelectedYurtId(e.target.value)}
                className="flex-1 h-9 px-3 text-sm rounded-lg border border-[#E8E2D9] bg-white outline-none focus:border-[#6B7F5E]"
              >
                <option value="">{t('selectYurt')}</option>
                {activeYurts.map(y => (
                  <option key={y.id} value={y.id} disabled={occupiedYurtIds.has(y.id)}>
                    {y.name}{y.alias ? ` (${y.alias})` : ''} ({tc('capacityGuests', { capacity: y.capacity })}){occupiedYurtIds.has(y.id) ? ` — ${tc('occupied')}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignYurt}
                disabled={!selectedYurtId || assigningYurt}
                className="h-9 px-4 text-sm font-semibold rounded-lg bg-[#8B6914] text-white hover:bg-[#8B6914]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('assign')}
              </button>
            </div>
          </div>
        )}

        {/* Status badge — single label for held reservations */}
        <div className="flex items-center gap-2 flex-wrap">
          {reservation.holdByAdmin && reservation.status === 'PENDING_PAYMENT' ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F4A623]/15 text-[#F4A623] flex items-center gap-1">
              <Lock size={11} />
              {t('awaitingDeposit')}
            </span>
          ) : (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_BADGE[reservation.status]?.bg} ${STATUS_BADGE[reservation.status]?.text}`}>
              {t(`status.${reservation.status}`)}
            </span>
          )}
          <span className="text-xs text-[#8C8478]">#{reservation.id.slice(-8)}</span>
        </div>

        {/* Reservation Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-brown">{t('detail.reservationInfo')}</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-[#8C8478] uppercase">{t('detail.date')}</div>
              <div className="text-sm text-brown font-medium">{formatDateDisplay(reservation.date)}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#8C8478] uppercase">{t('detail.yurt')}</div>
              <div className="text-sm text-brown font-medium">{reservation.yurt?.name}{reservation.yurt?.alias ? ` (${reservation.yurt.alias})` : ''}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#8C8478] uppercase">{t('detail.guests')}</div>
              <div className="text-sm text-brown font-medium">{reservation.guestCount}</div>
            </div>
          </div>
        </div>

        {/* Special Requests */}
        {reservation.specialRequests && (
          <div className="rounded-lg border border-[#8B6914]/20 bg-[#8B6914]/5 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare size={13} className="text-[#8B6914]" />
              <span className="text-xs font-semibold text-[#8B6914] uppercase">{t('detail.specialRequests')}</span>
            </div>
            <p className="text-sm text-brown leading-relaxed">{reservation.specialRequests}</p>
          </div>
        )}

        <hr className="border-[#E8ECE4]" />

        {/* Guest Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-brown">{t('detail.guestInfo')}</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-[#8C8478]">{t('detail.name')}</span>
              <span className="text-sm text-brown font-medium">{reservation.user?.name || t('detail.notProvided')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#8C8478]">{t('detail.email')}</span>
              <span className="text-sm text-brown">{reservation.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#8C8478]">{t('detail.phone')}</span>
              <span className="text-sm text-brown">{reservation.user?.phone || t('detail.notProvided')}</span>
            </div>
          </div>
        </div>

        <hr className="border-[#E8ECE4]" />

        {/* Payment Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-brown">{t('detail.paymentInfo')}</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8C8478]">{t('detail.depositAmount')}</span>
              {editingDeposit ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-brown">$</span>
                  <input
                    type="number"
                    min="0"
                    value={depositInput}
                    onChange={(e) => setDepositInput(e.target.value)}
                    className="w-20 h-7 px-2 text-sm rounded border border-[#E8E2D9] outline-none focus:border-[#6B7F5E]"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDeposit(); if (e.key === 'Escape') setEditingDeposit(false); }}
                  />
                  <button
                    onClick={handleSaveDeposit}
                    disabled={savingDeposit}
                    className="p-1 rounded hover:bg-[#5B8C3E]/10 text-[#5B8C3E] disabled:opacity-50"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingDeposit(false)}
                    className="p-1 rounded hover:bg-[#DC3545]/10 text-[#DC3545]"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-brown font-medium">${reservation.depositAmount}</span>
                  {reservation.depositStatus === 'CONFIRMED' ? (
                    /* Deposit confirmed — show lock icon, must unlock to edit */
                    <button
                      onClick={handleUnlockDeposit}
                      disabled={unlockingDeposit}
                      className="p-0.5 rounded hover:bg-[#F4A623]/10 text-[#F4A623] disabled:opacity-50"
                      title={t('detail.unlockDeposit')}
                    >
                      <Lock size={12} />
                    </button>
                  ) : (
                    /* Deposit not confirmed — can edit freely */
                    <button
                      onClick={() => { setDepositInput(String(reservation.depositAmount)); setEditingDeposit(true); }}
                      className="p-0.5 rounded hover:bg-[#E8ECE4]/50 text-[#8C8478] hover:text-brown"
                      title={t('detail.editDeposit')}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8C8478]">{t('detail.depositStatus')}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DEPOSIT_BADGE[reservation.depositStatus]?.bg} ${DEPOSIT_BADGE[reservation.depositStatus]?.text}`}>
                  {t(`depositStatus.${reservation.depositStatus}`)}
                </span>
                {/* Re-confirm button when deposit was unlocked back to PENDING */}
                {reservation.depositStatus === 'PENDING' && isAdmin && (
                  <button
                    onClick={handleRelockDeposit}
                    disabled={savingDeposit}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5B8C3E]/10 text-[#5B8C3E] hover:bg-[#5B8C3E]/20 disabled:opacity-50 transition-colors"
                  >
                    {t('detail.reconfirmDeposit')}
                  </button>
                )}
                {/* Mark as Refunded — for CONFIRMED deposits */}
                {reservation.depositStatus === 'CONFIRMED' && isAdmin && (
                  <button
                    onClick={handleMarkRefunded}
                    disabled={savingDeposit}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2980B9]/10 text-[#2980B9] hover:bg-[#2980B9]/20 disabled:opacity-50 transition-colors"
                  >
                    {t('detail.markRefunded')}
                  </button>
                )}
                {/* Re-mark as Confirmed — for REFUNDED deposits */}
                {reservation.depositStatus === 'REFUNDED' && isAdmin && (
                  <button
                    onClick={handleRelockDeposit}
                    disabled={savingDeposit}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5B8C3E]/10 text-[#5B8C3E] hover:bg-[#5B8C3E]/20 disabled:opacity-50 transition-colors"
                  >
                    {t('detail.markConfirmed')}
                  </button>
                )}
              </div>
            </div>
            {reservation.paymentReference && (
              <div className="flex justify-between">
                <span className="text-xs text-[#8C8478]">{t('detail.paymentReference')}</span>
                <span className="text-sm text-brown">{reservation.paymentReference}</span>
              </div>
            )}
            {reservation.paymentDeadline && (
              <div className="flex justify-between">
                <span className="text-xs text-[#8C8478]">{t('detail.paymentDeadline')}</span>
                <span className="text-sm text-brown">{formatDateTime(reservation.paymentDeadline)}</span>
              </div>
            )}
            {reservation.paymentScreenshotUrl && (
              <div>
                <span className="text-xs text-[#8C8478]">{t('detail.screenshot')}</span>
                <a
                  href={reservation.paymentScreenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8B6914] font-semibold hover:underline ml-2"
                >
                  {t('detail.viewScreenshot')}
                </a>
              </div>
            )}
          </div>
        </div>

        <hr className="border-[#E8ECE4]" />

        {/* Activity Timeline */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <History size={14} className="text-[#8B6914]" />
            <h4 className="text-sm font-bold text-brown">{t('detail.timeline')}</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-xs text-[#8C8478]">{t('detail.created')}</span>
              <span className="text-xs text-brown">{formatDateTime(reservation.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-[#8C8478]">{t('detail.updated')}</span>
              <span className="text-xs text-brown">{formatDateTime(reservation.updatedAt)}</span>
            </div>
            {reservation.cancelledAt && (
              <div className="flex justify-between">
                <span className="text-xs text-[#DC3545]">{t('cancelled')}</span>
                <span className="text-xs text-brown">{formatDateTime(reservation.cancelledAt)}</span>
              </div>
            )}
            {reservation.cancelReason && (
              <div className="mt-1 p-2 rounded bg-[#DC3545]/5 text-xs text-[#DC3545]">
                {t('cancelReason', { reason: reservation.cancelReason })}
              </div>
            )}
          </div>

          {/* Modification history from activity logs */}
          {activityLogs.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-[10px] text-[#8C8478] uppercase font-semibold">{t('detail.modifications')}</div>
              <div className="relative pl-3.5 space-y-0">
                {/* Vertical timeline line */}
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[#E8ECE4]" />
                {activityLogs.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-2.5 py-1.5">
                    <span className="relative z-10 mt-1.5 shrink-0 w-[7px] h-[7px] rounded-full bg-[#8B6914] ring-2 ring-white" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-brown leading-snug block">{activityLogText(log, t)}</span>
                      <span className="text-[10px] text-[#8C8478]">{formatDateTime(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tab: Pre-order ──────────────────────────────────────────

  function renderOrderTab() {
    // No order state
    if (!orderData) {
      return (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center gap-4">
          <ShoppingBag size={40} className="text-[#E8ECE4]" />
          <p className="text-sm text-[#8C8478]">{t('noOrder')}</p>
          {reservation.status === 'CONFIRMED' && isAdmin && (
            <button
              onClick={() => setShowOrderEditor(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#6B7F5E] text-white hover:bg-[#6B7F5E]/90"
            >
              {tOrders('placeOrder')}
            </button>
          )}
        </div>
      )
    }

    // Has order
    const order = orderData as Order
    const badge = ORDER_STATUS_BADGE[order.status] || ORDER_STATUS_BADGE.DRAFT

    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Order content */}
        <div className="p-5 flex flex-col gap-4 flex-1">
          {/* Order status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-[#E67E22]" />
              <h4 className="text-sm font-bold text-brown">{t('detail.preOrder')}</h4>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {tOrders(`status.${order.status}`)}
            </span>
          </div>

          {/* Confirmed lock indicator */}
          {order.status === 'LOCKED' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#5B8C3E]/10 border border-[#5B8C3E]/20">
              <Lock size={14} className="text-[#5B8C3E]" />
              <span className="text-xs font-semibold text-[#5B8C3E]">{t('orderConfirmed')}</span>
            </div>
          )}

          {/* Full item list */}
          {order.items && order.items.length > 0 ? (
            <div className="bg-[#F8F7F4] rounded-xl p-3 space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="text-[#1A1208]">
                      {locale === 'zh' && item.menuItem?.nameZh ? item.menuItem.nameZh : item.menuItem?.nameEn}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[#8C8478]">&times;{item.quantity}</span>
                    <span className="text-[#1A1208] font-medium w-16 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      ${((item.menuItem?.price ?? 0) * item.quantity).toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Subtotal */}
              <div className="border-t border-[#E8ECE4] pt-2 mt-2 flex justify-between text-sm font-semibold">
                <span className="text-[#8C8478]">{tOrders('subtotal')}</span>
                <span className="text-[#1A1208]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  ${order.estimatedTotal?.toFixed(0) ?? '\u2014'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#8C8478]">
              {t('itemsSuffix', { count: 0 })}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="text-xs text-[#8C8478] italic">
              {tOrders('notes')}: {order.notes}
            </div>
          )}
        </div>

        {/* Order action buttons — sticky bottom */}
        <div className="px-5 py-4 border-t border-[#E8ECE4] flex flex-col gap-2">
          {/* Confirm & Lock — for SUBMITTED */}
          {order.status === 'SUBMITTED' && (
            <>
              <button
                onClick={handleLockOrder}
                className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 flex items-center justify-center gap-1.5"
              >
                <Lock size={14} />
                {tOrders('confirmLock')}
              </button>
              <button
                onClick={() => setShowOrderEditor(true)}
                className="w-full py-2 text-sm font-semibold rounded-lg border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5"
              >
                {tOrders('editOrder')}
              </button>
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full py-2 text-sm font-semibold rounded-lg bg-[#1A1208] text-white hover:bg-[#1A1208]/90"
              >
                {tOrders('checkout')}
              </button>
            </>
          )}

          {/* LOCKED: Unlock + Edit + Checkout */}
          {order.status === 'LOCKED' && (
            <>
              <button
                onClick={handleUnlockOrder}
                className="w-full py-2 text-sm font-semibold rounded-lg border border-[#8C8478] text-[#8C8478] hover:bg-[#8C8478]/5 flex items-center justify-center gap-1.5"
              >
                <Unlock size={14} />
                {tOrders('unlockOrder')}
              </button>
              <button
                onClick={() => setShowOrderEditor(true)}
                className="w-full py-2 text-sm font-semibold rounded-lg border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5"
              >
                {tOrders('editOrder')}
              </button>
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full py-2 text-sm font-semibold rounded-lg bg-[#1A1208] text-white hover:bg-[#1A1208]/90"
              >
                {tOrders('checkout')}
              </button>
            </>
          )}

          {/* BILLED: Checkout */}
          {order.status === 'BILLED' && (
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-2 text-sm font-semibold rounded-lg bg-[#1A1208] text-white hover:bg-[#1A1208]/90"
            >
              {tOrders('checkout')}
            </button>
          )}

          {/* PAID: View Bill */}
          {order.status === 'PAID' && (
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-2 text-sm font-semibold rounded-lg bg-[#1A1208] text-white hover:bg-[#1A1208]/90"
            >
              {tOrders('viewBill')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Info tab action buttons ─────────────────────────────────

  function renderInfoActions() {
    return (
      <div className="px-5 py-4 border-t border-[#E8ECE4] flex flex-col gap-2">
        {/* Edit Reservation — non-terminal states */}
        {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(reservation.status) && (
          <button
            onClick={() => setShowEditEditor(true)}
            className="w-full py-2 text-sm font-semibold rounded-lg border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5"
          >
            {t('actions.editReservation')}
          </button>
        )}

        {/* Confirm Deposit — PAYMENT_SUBMITTED or PENDING_PAYMENT (admin can confirm directly) */}
        {(reservation.status === 'PAYMENT_SUBMITTED' || reservation.status === 'PENDING_PAYMENT') && isAdmin && (
          <>
            <button
              onClick={() => setConfirmAction('deposit')}
              disabled={isUpdating}
              className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
            >
              {t('actions.confirmDeposit')}
            </button>
            {/* Waive Deposit — skip deposit, confirm directly */}
            {reservation.holdByAdmin && reservation.depositAmount > 0 && (
              <button
                onClick={() => setConfirmAction('waiveDeposit')}
                disabled={isUpdating}
                className="w-full py-2 text-sm font-semibold rounded-lg border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5 disabled:opacity-50"
              >
                {t('actions.waiveDeposit')}
              </button>
            )}
          </>
        )}

        {/* Complete — CONFIRMED, requires order to be PAID if order exists */}
        {reservation.status === 'CONFIRMED' && (
          (() => {
            const hasUnpaidOrder = orderData && orderData.status !== 'PAID'
            return (
              <button
                onClick={() => !hasUnpaidOrder && setConfirmAction('complete')}
                disabled={isUpdating || !!hasUnpaidOrder}
                title={hasUnpaidOrder ? t('actions.completeRequiresCheckout') : undefined}
                className={`w-full py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                  hasUnpaidOrder
                    ? 'bg-[#2980B9]/40 text-white cursor-not-allowed'
                    : 'bg-[#2980B9] text-white hover:bg-[#2980B9]/90'
                }`}
              >
                {t('actions.complete')}
                {hasUnpaidOrder && (
                  <span className="text-[10px] font-normal opacity-80">
                    ({t('actions.checkoutFirst')})
                  </span>
                )}
              </button>
            )
          })()
        )}

        {/* Cancel — non-terminal states */}
        {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(reservation.status) && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setConfirmAction('cancel')}
              disabled={isUpdating}
              className="w-full py-2 text-sm font-semibold rounded-lg border border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545]/5 disabled:opacity-50"
            >
              {t('actions.cancel')}
            </button>
            {isAdmin && (
              <span className="text-[11px] text-[#8A7E6B]">管理员可随时取消，不受 7 天限制</span>
            )}
          </div>
        )}

        {/* Close panel */}
        <button
          onClick={onClose}
          className="w-full py-2 text-sm font-semibold rounded-lg border border-[#E8ECE4] text-[#8C8478] hover:bg-[#E8ECE4]/30"
        >
          {t('actions.close')}
        </button>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8ECE4]">
        <h3 className="text-base font-bold text-brown">{t('detail.title')}</h3>
        <button onClick={onClose} className="p-1 hover:bg-[#E8ECE4]/30 rounded">
          <X size={18} className="text-[#8C8478]" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#E8ECE4]">
        <button
          onClick={() => setDetailTab('info')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            detailTab === 'info'
              ? 'text-[#6B7F5E] border-b-2 border-[#6B7F5E]'
              : 'text-[#8C8478] hover:text-brown'
          }`}
        >
          {t('detail.tabs.info')}
        </button>
        <button
          onClick={() => setDetailTab('order')}
          className={`flex-1 py-3 text-sm font-medium relative transition-colors ${
            detailTab === 'order'
              ? 'text-[#6B7F5E] border-b-2 border-[#6B7F5E]'
              : 'text-[#8C8478] hover:text-brown'
          }`}
        >
          {t('detail.tabs.preOrder')}
          {/* Order status badge on tab */}
          {orderData && orderData.status === 'SUBMITTED' && (
            <span className="ml-1.5 text-[10px] text-[#E67E22] font-semibold">&#9888;{t('orderPending')}</span>
          )}
          {orderData && orderData.status === 'LOCKED' && (
            <span className="ml-1.5 text-[10px] text-[#5B8C3E] font-semibold">&#10003;</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {detailTab === 'info' ? (
        <>
          {renderInfoTab()}
          {renderInfoActions()}
        </>
      ) : (
        renderOrderTab()
      )}

      {/* AdminOrderEditor overlay */}
      <AdminOrderEditor
        reservationId={reservation.id}
        customerName={reservation.user?.name || reservation.user?.email}
        existingOrder={
          orderData && 'items' in orderData
            ? {
                id: orderData.id,
                items: ((orderData as Order).items || []).map((item) => ({
                  menuItemId: item.menuItem?.id || item.id,
                  quantity: item.quantity,
                  menuItem: item.menuItem,
                })),
                notes: (orderData as Order).notes,
              }
            : null
        }
        isOpen={showOrderEditor}
        onClose={() => setShowOrderEditor(false)}
        onSaved={handleOrderSaved}
      />

      {/* EditReservationEditor overlay */}
      <EditReservationEditor
        reservation={{
          id: reservation.id,
          date: reservation.date,
          yurtId: reservation.yurtId,
          guestCount: reservation.guestCount,
          specialRequests: reservation.specialRequests,
          yurt: reservation.yurt,
        }}
        isOpen={showEditEditor}
        onClose={() => setShowEditEditor(false)}
        onSaved={handleOrderSaved}
      />

      {/* CheckoutPanel overlay */}
      {orderData && 'items' in orderData && (
        <CheckoutPanel
          reservation={{
            id: reservation.id,
            depositAmount: reservation.depositAmount,
            depositStatus: reservation.depositStatus,
            user: reservation.user,
            yurt: reservation.yurt,
            date: reservation.date,
            guestCount: reservation.guestCount,
          }}
          order={{
            id: orderData.id,
            status: orderData.status,
            estimatedTotal: (orderData as Order).estimatedTotal,
            finalTotal: (orderData as Order).finalTotal,
            discount: (orderData as Order).discount,
            paymentMethod: (orderData as Order).paymentMethod,
            paidAt: (orderData as Order).paidAt,
            items: ((orderData as Order).items || []).map((item) => ({
              id: item.id,
              quantity: item.quantity,
              specialNotes: item.specialNotes || null,
              menuItem: item.menuItem,
            })),
          }}
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          onCompleted={handleCheckoutCompleted}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={true}
          title={confirmDialogConfig[confirmAction].title}
          message={confirmDialogConfig[confirmAction].message}
          variant={confirmDialogConfig[confirmAction].variant}
          confirmLabel={confirmDialogConfig[confirmAction].confirmLabel}
          loading={isUpdating}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
