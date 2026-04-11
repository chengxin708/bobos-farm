'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { X, ChevronRight, ShoppingBag, MessageSquare, History } from 'lucide-react'
import {
  type Reservation,
  type ActivityLog,
  STATUS_BADGE,
  DEPOSIT_BADGE,
  ORDER_STATUS_BADGE,
  formatDateDisplay,
  formatDateTime,
  activityLogText,
} from './useReservationsData'

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
}

// ── Component ──────────────────────────────────────────────────────

export default function ReservationDetail({
  reservation,
  activityLogs,
  onClose,
  onAction,
  isUpdating,
}: ReservationDetailProps) {
  const t = useTranslations('admin.reservations')
  const panelOrder = reservation.order || null

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
                  <span className="text-xs text-[#8C8478]">{t('detail.itemCount')}</span>
                  <span className="text-sm text-brown font-medium">{panelOrder.items?.length ?? 0} items</span>
                </div>
                {panelOrder.estimatedTotal != null && (
                  <div className="flex justify-between">
                    <span className="text-xs text-[#8C8478]">{t('detail.estimatedTotal')}</span>
                    <span className="text-sm text-brown font-medium">${panelOrder.estimatedTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <Link
                href="/admin/reservations?view=orders"
                className="flex items-center gap-1 text-xs font-semibold text-[#8B6914] hover:underline"
              >
                {t('detail.viewFullOrder')} <ChevronRight size={12} />
              </Link>
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
                <span className="text-xs text-[#DC3545]">Cancelled</span>
                <span className="text-xs text-brown">{formatDateTime(reservation.cancelledAt)}</span>
              </div>
            )}
            {reservation.cancelReason && (
              <div className="mt-1 p-2 rounded bg-[#DC3545]/5 text-xs text-[#DC3545]">
                Reason: {reservation.cancelReason}
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
                      <span className="text-xs text-brown leading-snug block">{activityLogText(log)}</span>
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
        {/* Confirm Deposit - show for PAYMENT_SUBMITTED */}
        {reservation.status === 'PAYMENT_SUBMITTED' && (
          <button
            onClick={() => onAction.confirmDeposit(reservation.id)}
            disabled={isUpdating}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
          >
            {t('actions.confirm')}
          </button>
        )}

        {/* Complete - show for CONFIRMED */}
        {reservation.status === 'CONFIRMED' && (
          <button
            onClick={() => onAction.completeReservation(reservation.id)}
            disabled={isUpdating}
            className="w-full py-2 text-sm font-semibold rounded-lg bg-[#2980B9] text-white hover:bg-[#2980B9]/90 disabled:opacity-50"
          >
            {t('actions.complete')}
          </button>
        )}

        {/* Cancel - show for non-terminal states */}
        {!['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(reservation.status) && (
          <button
            onClick={() => onAction.cancelReservation(reservation.id)}
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
    </div>
  )
}
