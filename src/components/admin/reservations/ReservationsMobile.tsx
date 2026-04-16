'use client'

import { useState } from 'react'
import { Search, X, History, AlertCircle, ShoppingBag, Lock, RefreshCcw } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import ReservationDetail from './ReservationDetail'
import {
  useReservationsData,
  type Reservation,
} from './useReservationsData'

// ── Filter Chip ───────────────────────────────────────────────────

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-[#6B7F5E] text-white'
          : 'bg-white border border-[#E8ECE4] text-[#8C8478]'
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className={`text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center ${
          active ? 'bg-white/25 text-white' : 'bg-[#6B7F5E]/10 text-[#6B7F5E]'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Reservation Card ──────────────────────────────────────────────

function ReservationCard({
  reservation,
  onClick,
  onConfirmDeposit,
  onRejectDeposit,
  onMarkRefunded,
  isUpdating,
  t,
}: {
  reservation: Reservation
  onClick: () => void
  onConfirmDeposit: (id: string) => void
  onRejectDeposit: (id: string) => void
  onMarkRefunded: (id: string) => void
  isUpdating: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, values?: any) => string
}) {
  const r = reservation
  const isPaymentSubmitted = r.status === 'PAYMENT_SUBMITTED'

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex flex-col gap-2 active:bg-[#F8F7F4]/80 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="text-sm font-semibold text-brown">{r.user?.name || 'N/A'}</div>
        <StatusBadge
          type="reservation"
          status={r.status}
          label={t(`status.${r.status}`)}
        />
      </div>
      <div className="text-xs text-[#8C8478]">
        {r.yurt?.name}{r.yurt?.alias ? ` (${r.yurt.alias})` : ''} · {t('guestsSuffix', { count: r.guestCount })}
      </div>

      {/* Inline action buttons for PAYMENT_SUBMITTED */}
      {isPaymentSubmitted && (
        <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[#E8ECE4]">
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDeposit(r.id) }}
            disabled={isUpdating}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-[#5B8C3E] text-white disabled:opacity-50"
          >
            {t('actions.confirm')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRejectDeposit(r.id) }}
            disabled={isUpdating}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DC3545]/30 text-[#DC3545] disabled:opacity-50"
          >
            {t('actions.reject')}
          </button>
        </div>
      )}

      {/* Inline action for CANCELLED_PENDING_REFUND */}
      {r.status === 'CANCELLED_PENDING_REFUND' && (
        <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[#E8ECE4]">
          <span className="text-xs text-[#DC3545] font-medium flex-1">
            {t('refundAmount', { amount: r.depositAmount })}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRefunded(r.id) }}
            disabled={isUpdating}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5B8C3E] text-white disabled:opacity-50"
          >
            {t('actions.markRefunded')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function ReservationsMobile() {
  const data = useReservationsData()
  const [showSearch, setShowSearch] = useState(false)

  const {
    sessionStatus,
    filter, setFilter,
    showHistory, setShowHistory,
    historyDateFrom, setHistoryDateFrom,
    historyDateTo, setHistoryDateTo,
    historyStatus, setHistoryStatus,
    search, setSearch,
    pendingDepositCount,
    pendingRefundCount,
    pendingOrderCount,
    heldByAdminCount,
    actionNeededCount,
    confirmedCount,
    completedCount,
    groupedReservations,
    isLoading,
    selectedRes, setSelectedRes,
    detailRes,
    activityLogs,
    confirmDeposit,
    markRefunded,
    cancelAndRefund,
    cancelReservation,
    completeReservation,
    updating,
    mutateReservations,
    mutateDetail,
    mutateActivityLogs,
    successMsg, setSuccessMsg,
    t,
  } = data

  // ── Loading ──────────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <AdminTopBar title={t('title')} />
        <div className="flex-1 p-4 flex items-center justify-center">
          <p className="text-[#8C8478] text-sm">{t('loading')}</p>
        </div>
      </>
    )
  }

  // ── Detail overlay ───────────────────────────────────────────

  if (selectedRes) {
    const panelRes = detailRes || selectedRes
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <ReservationDetail
          reservation={panelRes}
          activityLogs={activityLogs}
          onClose={() => setSelectedRes(null)}
          onAction={{ confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation }}
          isUpdating={updating}
          onOrderChanged={() => { mutateReservations(); mutateDetail(); mutateActivityLogs() }}
        />
      </div>
    )
  }

  return (
    <>
      <AdminTopBar title={t('title')} />
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-auto">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-[#EAF2E3] border border-[#5B8C3E]/30 text-[#2D5016] rounded-lg px-3 py-2 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/60 hover:text-[#2D5016]">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        )}

        {/* Search + History toggle */}
        <div className="flex items-center gap-2">
          {showSearch ? (
            <div className="flex-1 flex items-center bg-white border border-[#E8ECE4] rounded-lg px-3 py-2 gap-2">
              <Search size={16} className="text-[#8C8478] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="text-sm bg-transparent outline-none flex-1"
                autoFocus
              />
              <button onClick={() => { setSearch(''); setShowSearch(false) }} className="text-[#8C8478]">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="flex-1 flex items-center bg-white border border-[#E8ECE4] rounded-lg px-3 py-2 gap-2"
            >
              <Search size={16} className="text-[#8C8478]" />
              <span className="text-sm text-[#8C8478]">{t('searchPlaceholder')}</span>
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg border ${
              showHistory ? 'border-[#6B7F5E] bg-[#6B7F5E]/10' : 'border-[#E8ECE4] bg-white'
            }`}
          >
            <History size={18} className={showHistory ? 'text-[#6B7F5E]' : 'text-[#8C8478]'} />
          </button>
        </div>

        {/* History filters */}
        {showHistory && (
          <div className="flex flex-col gap-2">
            {/* Status chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {['all', 'COMPLETED', 'CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED'].map(s => (
                <FilterChip
                  key={s}
                  label={s === 'all' ? t('filters.all') : t(`status.${s}`)}
                  active={historyStatus === s}
                  onClick={() => setHistoryStatus(s)}
                />
              ))}
            </div>
            {/* Date range */}
            <div className="flex items-center gap-2 bg-white border border-[#E8ECE4] rounded-xl px-3 py-2">
              <span className="text-[10px] font-semibold text-[#8C8478] uppercase shrink-0">{t('historyDateRange')}</span>
              <input
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                className="text-xs bg-transparent outline-none border border-[#E8ECE4] rounded-lg px-2 py-1 text-[#2C2416] focus:border-[#6B7F5E] w-[120px]"
              />
              <span className="text-xs text-[#8C8478]">—</span>
              <input
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                className="text-xs bg-transparent outline-none border border-[#E8ECE4] rounded-lg px-2 py-1 text-[#2C2416] focus:border-[#6B7F5E] w-[120px]"
              />
              {(historyDateFrom || historyDateTo) && (
                <button
                  onClick={() => { setHistoryDateFrom(''); setHistoryDateTo('') }}
                  className="text-[#8C8478] hover:text-brown shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action alerts — only when not in history mode */}
        {!showHistory && (pendingDepositCount > 0 || heldByAdminCount > 0 || pendingOrderCount > 0 || pendingRefundCount > 0) && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {pendingDepositCount > 0 && (
              <button
                onClick={() => { setFilter('action-needed'); setShowHistory(false) }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E67E22]/10 border border-[#E67E22]/20 text-[#E67E22] text-xs font-semibold"
              >
                <AlertCircle size={14} />
                {t('pendingDeposits', { count: pendingDepositCount })}
              </button>
            )}
            {heldByAdminCount > 0 && (
              <button
                onClick={() => { setFilter('action-needed'); setShowHistory(false) }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4A623]/10 border border-[#F4A623]/20 text-[#F4A623] text-xs font-semibold"
              >
                <Lock size={14} />
                {t('heldByAdmin', { count: heldByAdminCount })}
              </button>
            )}
            {pendingOrderCount > 0 && (
              <button
                onClick={() => { setFilter('all'); setShowHistory(false) }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E67E22]/10 border border-[#E67E22]/20 text-[#E67E22] text-xs font-semibold"
              >
                <ShoppingBag size={14} />
                {t('pendingOrders', { count: pendingOrderCount })}
              </button>
            )}
            {pendingRefundCount > 0 && (
              <button
                onClick={() => { setFilter('pending-refund'); setShowHistory(false) }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DC3545]/10 border border-[#DC3545]/20 text-[#DC3545] text-xs font-semibold"
              >
                <RefreshCcw size={14} />
                {t('pendingRefunds', { count: pendingRefundCount })}
              </button>
            )}
          </div>
        )}

        {/* Filter chips */}
        {!showHistory && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <FilterChip
              label={t('filters.actionNeeded')}
              count={actionNeededCount}
              active={filter === 'action-needed'}
              onClick={() => setFilter('action-needed')}
            />
            <FilterChip
              label={t('filters.pendingRefund')}
              count={pendingRefundCount}
              active={filter === 'pending-refund'}
              onClick={() => setFilter('pending-refund')}
            />
            <FilterChip
              label={t('filters.confirmed')}
              count={confirmedCount}
              active={filter === 'confirmed'}
              onClick={() => setFilter('confirmed')}
            />
            <FilterChip
              label={t('filters.completed')}
              count={completedCount}
              active={filter === 'completed'}
              onClick={() => setFilter('completed')}
            />
            <FilterChip
              label={t('filters.all')}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-[#8C8478] text-sm">{t('loading')}</p>
          </div>
        ) : groupedReservations.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8ECE4] p-8 text-center">
            <p className="text-[#8C8478] text-sm">{t('noResults')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupedReservations.map((group) => (
              <div key={group.dateKey}>
                {/* Date group header */}
                <div className="text-xs font-semibold text-[#8C8478] uppercase tracking-wider mb-2">
                  {group.dateLabel}
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {group.reservations.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onClick={() => setSelectedRes(r)}
                      onConfirmDeposit={confirmDeposit}
                      onRejectDeposit={cancelReservation}
                      onMarkRefunded={markRefunded}
                      isUpdating={updating}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
