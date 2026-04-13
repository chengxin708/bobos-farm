'use client'

import { useState } from 'react'
import { Search, X, History, AlertCircle, ShoppingBag, Lock } from 'lucide-react'
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
      className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-[#6B7F5E] text-white'
          : 'bg-white border border-[#E8ECE4] text-[#8C8478] hover:border-[#6B7F5E]/30'
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className={`text-[11px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center ${
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
  isSelected,
  onClick,
  onConfirmDeposit,
  onRejectDeposit,
  isUpdating,
  t,
}: {
  reservation: Reservation
  isSelected: boolean
  onClick: () => void
  onConfirmDeposit: (id: string) => void
  onRejectDeposit: (id: string) => void
  isUpdating: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, values?: any) => string
}) {
  const r = reservation
  const isPaymentSubmitted = r.status === 'PAYMENT_SUBMITTED'

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-4 border cursor-pointer transition-all ${
        isSelected
          ? 'border-[#6B7F5E] ring-1 ring-[#6B7F5E]/20'
          : 'border-[#E8ECE4] hover:border-[#6B7F5E]/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-brown truncate">{r.user?.name || 'N/A'}</span>
            <span className="text-xs text-[#8C8478]">{r.yurt?.name}</span>
            <span className="text-xs text-[#8C8478]">{r.guestCount}{t('guestsSuffix', { count: r.guestCount }).replace(String(r.guestCount), '').trim()}</span>
          </div>
          {r.user?.email && (
            <div className="text-xs text-[#8C8478] mt-0.5 truncate">{r.user.email}</div>
          )}
        </div>
        <StatusBadge
          type="reservation"
          status={r.status}
          label={t(`status.${r.status}`)}
        />
      </div>

      {/* Inline action buttons for PAYMENT_SUBMITTED */}
      {isPaymentSubmitted && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E8ECE4]">
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmDeposit(r.id) }}
            disabled={isUpdating}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-[#5B8C3E] text-white hover:bg-[#5B8C3E]/90 disabled:opacity-50"
          >
            {t('actions.confirm')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRejectDeposit(r.id) }}
            disabled={isUpdating}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#DC3545]/30 text-[#DC3545] hover:bg-[#DC3545]/5 disabled:opacity-50"
          >
            {t('actions.reject')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function ReservationsDesktop() {
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
    pendingOrderCount,
    heldByAdminCount,
    actionNeededCount,
    confirmedCount,
    groupedReservations,
    isLoading,
    selectedRes, setSelectedRes,
    detailRes,
    activityLogs,
    confirmDeposit,
    cancelReservation,
    completeReservation,
    updating,
    mutateReservations,
    mutateDetail,
    successMsg, setSuccessMsg,
    t,
  } = data

  // ── Loading ──────────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <div className="flex-1 p-6 flex items-center justify-center bg-[#F8F7F4]">
        <p className="text-[#8C8478]">{t('loading')}</p>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex-1 flex bg-[#F8F7F4] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-auto">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-[#EAF2E3] border border-[#5B8C3E]/30 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/60 hover:text-[#2D5016]">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        )}

        {/* Header: title + search icon + history toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-brown font-playfair">{t('title')}</h2>
            <p className="text-sm text-[#8C8478] mt-0.5">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg border transition-colors ${
                showSearch || search ? 'border-[#6B7F5E] bg-[#6B7F5E]/10' : 'border-[#E8ECE4] bg-white'
              }`}
            >
              <Search size={18} className={showSearch || search ? 'text-[#6B7F5E]' : 'text-[#8C8478]'} />
            </button>
            {/* History toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                showHistory
                  ? 'border-[#6B7F5E] bg-[#6B7F5E]/10 text-[#6B7F5E]'
                  : 'border-[#E8ECE4] bg-white text-[#8C8478] hover:border-[#6B7F5E]/30'
              }`}
            >
              <History size={16} />
              {t('history')}
            </button>
          </div>
        </div>

        {/* Collapsible search bar */}
        {showSearch && (
          <div className="flex items-center bg-white border border-[#E8ECE4] rounded-xl px-3 py-2 gap-2">
            <Search size={16} className="text-[#8C8478] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="text-sm bg-transparent outline-none flex-1"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#8C8478] hover:text-brown">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* History filters */}
        {showHistory && (
          <div className="flex flex-col gap-3">
            {/* Status chips */}
            <div className="flex items-center gap-2">
              {['all', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map(s => (
                <FilterChip
                  key={s}
                  label={s === 'all' ? t('filters.all') : t(`status.${s}`)}
                  active={historyStatus === s}
                  onClick={() => setHistoryStatus(s)}
                />
              ))}
            </div>
            {/* Date range */}
            <div className="flex items-center gap-3 bg-white border border-[#E8ECE4] rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-[#8C8478] uppercase shrink-0">{t('historyDateRange')}</span>
              <input
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                className="text-sm bg-transparent outline-none border border-[#E8ECE4] rounded-lg px-2 py-1 text-[#2C2416] focus:border-[#6B7F5E]"
              />
              <span className="text-xs text-[#8C8478]">—</span>
              <input
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                className="text-sm bg-transparent outline-none border border-[#E8ECE4] rounded-lg px-2 py-1 text-[#2C2416] focus:border-[#6B7F5E]"
              />
              {(historyDateFrom || historyDateTo) && (
                <button
                  onClick={() => { setHistoryDateFrom(''); setHistoryDateTo('') }}
                  className="text-[#8C8478] hover:text-brown"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action alerts — only when not in history mode */}
        {!showHistory && (pendingDepositCount > 0 || heldByAdminCount > 0 || pendingOrderCount > 0) && (
          <div className="flex items-center gap-3 flex-wrap">
            {pendingDepositCount > 0 && (
              <button
                onClick={() => { setFilter('action-needed'); setShowHistory(false) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E67E22]/10 border border-[#E67E22]/20 text-[#E67E22] text-sm font-semibold hover:bg-[#E67E22]/15 transition-colors"
              >
                <AlertCircle size={16} />
                {t('pendingDeposits', { count: pendingDepositCount })}
              </button>
            )}
            {heldByAdminCount > 0 && (
              <button
                onClick={() => { setFilter('action-needed'); setShowHistory(false) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F4A623]/10 border border-[#F4A623]/20 text-[#F4A623] text-sm font-semibold hover:bg-[#F4A623]/15 transition-colors"
              >
                <Lock size={16} />
                {t('heldByAdmin', { count: heldByAdminCount })}
              </button>
            )}
            {pendingOrderCount > 0 && (
              <button
                onClick={() => { setFilter('all'); setShowHistory(false) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E67E22]/10 border border-[#E67E22]/20 text-[#E67E22] text-sm font-semibold hover:bg-[#E67E22]/15 transition-colors"
              >
                <ShoppingBag size={16} />
                {t('pendingOrders', { count: pendingOrderCount })}
              </button>
            )}
          </div>
        )}

        {/* Filter chips */}
        {!showHistory && (
          <div className="flex items-center gap-2">
            <FilterChip
              label={t('filters.actionNeeded')}
              count={actionNeededCount}
              active={filter === 'action-needed'}
              onClick={() => setFilter('action-needed')}
            />
            <FilterChip
              label={t('filters.confirmed')}
              count={confirmedCount}
              active={filter === 'confirmed'}
              onClick={() => setFilter('confirmed')}
            />
            <FilterChip
              label={t('filters.all')}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
          </div>
        )}

        {/* Card list grouped by date */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-[#8C8478] text-sm">{t('loading')}</p>
          </div>
        ) : groupedReservations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-[#8C8478] text-sm">{t('noResults')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
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
                      isSelected={selectedRes?.id === r.id}
                      onClick={() => setSelectedRes(r)}
                      onConfirmDeposit={confirmDeposit}
                      onRejectDeposit={cancelReservation}
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

      {/* Detail Side Drawer (400px right panel) */}
      {selectedRes && (
        <div className="w-[400px] border-l border-[#E8ECE4] bg-white flex flex-col overflow-hidden shrink-0">
          <ReservationDetail
            reservation={detailRes || selectedRes}
            activityLogs={activityLogs}
            onClose={() => setSelectedRes(null)}
            onAction={{ confirmDeposit, cancelReservation, completeReservation }}
            isUpdating={updating}
            onOrderChanged={() => { mutateReservations(); mutateDetail() }}
          />
        </div>
      )}
    </div>
  )
}
