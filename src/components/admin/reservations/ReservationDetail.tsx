'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import useSWR from 'swr'
import { X, ShoppingBag, MessageSquare, History } from 'lucide-react'
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
  const tOrders = useTranslations('admin.orders')
  const locale = useLocale()
  const panelOrder = reservation.order || null

  const [showOrderEditor, setShowOrderEditor] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'deposit' | 'complete' | 'cancel' | null>(null)

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return
    if (confirmAction === 'deposit') onAction.confirmDeposit(reservation.id)
    if (confirmAction === 'complete') onAction.completeReservation(reservation.id)
    if (confirmAction === 'cancel') onAction.cancelReservation(reservation.id)
    setConfirmAction(null)
  }, [confirmAction, onAction, reservation.id])

  const confirmDialogConfig = {
    deposit: { title: t('dialog.confirmDeposit'), message: t('dialog.confirmDepositMsg'), variant: 'success' as const, confirmLabel: t('actions.confirm') },
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

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8ECE4]">
        <h3 className="text-base font-bold text-brown">{t('detail.title')}</h3>
        <button onClick={onClose} className="p-1 hover:bg-[#E8ECE4]/30 rounded">
          <X size={18} className="text-[#8C8478]" />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_BADGE[reservation.status]?.bg} ${STATUS_BADGE[reservation.status]?.text}`}>
            {t(`status.${reservation.status}`)}
          </span>
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
              <div className="text-sm text-brown font-medium">{reservation.yurt?.name}</div>
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

        {/* Pre-order Details — full item list */}
        {orderData && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-[#E67E22]" />
                  <h4 className="text-sm font-bold text-brown">{t('detail.preOrder')}</h4>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_BADGE[orderData.status]?.bg} ${ORDER_STATUS_BADGE[orderData.status]?.text}`}>
                  {tOrders(`status.${orderData.status}`)}
                </span>
              </div>

              {/* Full item list */}
              {orderData.items && orderData.items.length > 0 ? (
                <div className="bg-[#F8F7F4] rounded-xl p-3 space-y-2">
                  {orderData.items.map((item) => (
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
                      ${orderData.estimatedTotal?.toFixed(0) ?? '\u2014'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#8C8478]">
                  {t('itemsSuffix', { count: 0 })}
                </div>
              )}

              {/* Notes */}
              {orderData.notes && (
                <div className="text-xs text-[#8C8478] italic">
                  {tOrders('notes')}: {orderData.notes}
                </div>
              )}
            </div>
            <hr className="border-[#E8ECE4]" />
          </>
        )}

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
            <div className="flex justify-between">
              <span className="text-xs text-[#8C8478]">{t('detail.depositAmount')}</span>
              <span className="text-sm text-brown font-medium">${reservation.depositAmount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#8C8478]">{t('detail.depositStatus')}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DEPOSIT_BADGE[reservation.depositStatus]?.bg} ${DEPOSIT_BADGE[reservation.depositStatus]?.text}`}>
                {t(`depositStatus.${reservation.depositStatus}`)}
              </span>
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

      {/* Panel actions */}
      <div className="px-5 py-4 border-t border-[#E8ECE4] flex flex-col gap-2">
        {/* Order Editor - show for CONFIRMED reservations */}
        {reservation.status === 'CONFIRMED' && (
          <button
            onClick={() => setShowOrderEditor(true)}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#6B7F5E] text-white hover:bg-[#6B7F5E]/90"
          >
            {orderData ? tOrders('editOrder') : tOrders('placeOrder')}
          </button>
        )}

        {/* Lock/Unlock order */}
        {orderData && orderData.status === 'SUBMITTED' && (
          <button
            onClick={async () => {
              await fetch(`/api/orders/${orderData.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'lock' }),
              })
              mutateOrder()
              onOrderChanged?.()
            }}
            className="w-full py-2 text-sm font-semibold rounded-lg border border-[#E67E22] text-[#E67E22] hover:bg-[#E67E22]/5"
          >
            {tOrders('lockOrder')}
          </button>
        )}
        {orderData && orderData.status === 'LOCKED' && (
          <button
            onClick={async () => {
              await fetch(`/api/orders/${orderData.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock' }),
              })
              mutateOrder()
              onOrderChanged?.()
            }}
            className="w-full py-2 text-sm font-semibold rounded-lg border border-[#8C8478] text-[#8C8478] hover:bg-[#8C8478]/5"
          >
            {tOrders('unlockOrder')}
          </button>
        )}

        {/* Checkout - show when order exists and is actionable */}
        {orderData && ['SUBMITTED', 'LOCKED', 'BILLED'].includes(orderData.status) && (
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#1A1208] text-white hover:bg-[#1A1208]/90"
          >
            {tOrders('checkout')}
          </button>
        )}

        {/* View bill - show when order is PAID */}
        {orderData && orderData.status === 'PAID' && (
          <button
            onClick={() => setShowCheckout(true)}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#1A1208] text-white hover:bg-[#1A1208]/90"
          >
            {tOrders('viewBill')}
          </button>
        )}

        {/* Confirm Deposit - show for PAYMENT_SUBMITTED */}
        {reservation.status === 'PAYMENT_SUBMITTED' && (
          <button
            onClick={() => setConfirmAction('deposit')}
            disabled={isUpdating}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
          >
            {t('actions.confirm')}
          </button>
        )}

        {/* Complete - show for CONFIRMED */}
        {reservation.status === 'CONFIRMED' && (
          <button
            onClick={() => setConfirmAction('complete')}
            disabled={isUpdating}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#2980B9] text-white hover:bg-[#2980B9]/90 disabled:opacity-50"
          >
            {t('actions.complete')}
          </button>
        )}

        {/* Cancel - show for non-terminal states */}
        {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(reservation.status) && (
          <button
            onClick={() => setConfirmAction('cancel')}
            disabled={isUpdating}
            className="w-full py-2 text-sm font-semibold rounded-lg border border-[#DC3545] text-[#DC3545] hover:bg-[#DC3545]/5 disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
        )}

        {/* Close panel */}
        <button
          onClick={onClose}
          className="w-full py-2 text-sm font-semibold rounded-lg border border-[#E8ECE4] text-[#8C8478] hover:bg-[#E8ECE4]/30"
        >
          {t('actions.close')}
        </button>
      </div>

      {/* AdminOrderEditor overlay */}
      <AdminOrderEditor
        reservationId={reservation.id}
        customerName={reservation.user?.name || reservation.user?.email}
        existingOrder={
          orderData
            ? {
                id: orderData.id,
                items: (orderData.items || []).map((item) => ({
                  menuItemId: item.menuItem?.id || item.id,
                  quantity: item.quantity,
                  menuItem: item.menuItem,
                })),
                notes: orderData.notes,
              }
            : null
        }
        isOpen={showOrderEditor}
        onClose={() => setShowOrderEditor(false)}
        onSaved={handleOrderSaved}
      />

      {/* CheckoutPanel overlay */}
      {orderData && (
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
            estimatedTotal: orderData.estimatedTotal,
            finalTotal: orderData.finalTotal,
            discount: orderData.discount,
            paymentMethod: orderData.paymentMethod,
            paidAt: orderData.paidAt,
            items: (orderData.items || []).map((item) => ({
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
