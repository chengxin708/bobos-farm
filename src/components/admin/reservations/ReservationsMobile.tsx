'use client'

import { useState } from 'react'
import { Search, X, Calendar, Lock, Unlock } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import ReservationDetail from './ReservationDetail'
import {
  useReservationsData,
  type ViewMode,
  type TabKey,
  type OrderTabKey,
  formatDateDisplay,
  ORDER_STATUS_BADGE,
} from './useReservationsData'

// ── Segmented Control ──────────────────────────────────────────────

function SegmentedControl({
  value,
  onChange,
  labels,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
  labels: Record<ViewMode, string>
}) {
  const segments: { key: ViewMode; label: string }[] = [
    { key: 'all', label: labels.all },
    { key: 'deposits', label: labels.deposits },
    { key: 'orders', label: labels.orders },
  ]

  return (
    <div className="flex gap-1 bg-[#F0EDE8] rounded-full p-1">
      {segments.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            value === s.key
              ? 'bg-[#6B7F5E] text-white'
              : 'bg-transparent text-[#8C8478]'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function ReservationsMobile() {
  const data = useReservationsData()
  const [showSearch, setShowSearch] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)

  const {
    sessionStatus,
    view, setView,
    activeTab, setActiveTab,
    search, setSearch,
    startDate, setStartDate,
    endDate, setEndDate,
    reservationTabs,
    orderTab, setOrderTab,
    orderTabs,
    reservations,
    orders,
    isLoading,
    selectedRes, setSelectedRes,
    detailRes,
    activityLogs,
    confirmDeposit,
    cancelReservation,
    completeReservation,
    handleLockOrder,
    handleUnlockOrder,
    updating,
    mutateReservations,
    mutateOrders,
    successMsg, setSuccessMsg,
    t,
    tOrders,
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
          onAction={{ confirmDeposit, cancelReservation, completeReservation }}
          isUpdating={updating}
          onOrderChanged={() => { mutateReservations(); mutateOrders(); }}
        />
      </div>
    )
  }

  // ── Status chips for reservations ────────────────────────────

  const statusChips: { key: TabKey; label: string }[] = reservationTabs
  const orderStatusChips: { key: OrderTabKey; label: string }[] = orderTabs

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

        {/* Segmented Control */}
        <SegmentedControl value={view} onChange={setView} labels={{ all: t('viewSegments.all'), deposits: t('viewSegments.deposits'), orders: t('viewSegments.orders') }} />

        {/* Search + Date filter toggle */}
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
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`p-2 rounded-lg border ${showDateFilter || startDate || endDate ? 'border-[#6B7F5E] bg-[#6B7F5E]/10' : 'border-[#E8ECE4] bg-white'}`}
          >
            <Calendar size={18} className={showDateFilter || startDate || endDate ? 'text-[#6B7F5E]' : 'text-[#8C8478]'} />
          </button>
        </div>

        {/* Date filters (collapsible) */}
        {showDateFilter && view !== 'orders' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-[#8C8478] uppercase">{t('startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border border-[#E8ECE4] rounded-lg px-2 py-1.5 bg-white text-brown"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-[#8C8478] uppercase">{t('endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border border-[#E8ECE4] rounded-lg px-2 py-1.5 bg-white text-brown"
              />
            </div>
          </div>
        )}

        {/* Status chips (horizontal scrolling) */}
        {view === 'all' && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setActiveTab(chip.key)}
                className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  activeTab === chip.key
                    ? 'bg-[#6B7F5E] text-white'
                    : 'bg-white border border-[#E8ECE4] text-[#8C8478]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {view === 'orders' && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {orderStatusChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setOrderTab(chip.key)}
                className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  orderTab === chip.key
                    ? 'bg-[#6B7F5E] text-white'
                    : 'bg-white border border-[#E8ECE4] text-[#8C8478]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-[#8C8478] text-sm">{t('loading')}</p>
          </div>
        ) : view === 'orders' ? (
          /* ── Orders card list ──────────────────────────────── */
          orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8ECE4] p-8 text-center">
              <p className="text-[#8C8478] text-sm">{tOrders('noResults')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((o) => {
                const badge = ORDER_STATUS_BADGE[o.status] || ORDER_STATUS_BADGE.DRAFT
                return (
                  <div
                    key={o.id}
                    className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex flex-col gap-2 active:bg-[#F8F7F4]/80"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-brown">{o.reservation.user?.name || 'N/A'}</div>
                        <div className="text-xs text-[#8C8478]">{o.reservation.user?.email}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {tOrders(`status.${o.status}`)}
                      </span>
                    </div>
                    <div className="text-xs text-[#8C8478]">
                      {formatDateDisplay(o.reservation.date)} · {o.reservation.yurt?.name} · {t('itemsSuffix', { count: o._count.items })}
                    </div>
                    {o.estimatedTotal != null && (
                      <div className="text-sm font-semibold text-brown">${o.estimatedTotal.toFixed(2)}</div>
                    )}
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 justify-end mt-1">
                      {o.status === 'SUBMITTED' && (
                        <button
                          onClick={() => handleLockOrder(o.id)}
                          disabled={updating}
                          className="flex items-center gap-1 px-3 py-1 bg-[#5B8C3E] text-white text-xs font-semibold rounded-md disabled:opacity-50"
                        >
                          <Lock size={12} /> {tOrders('actions.lock')}
                        </button>
                      )}
                      {o.status === 'LOCKED' && (
                        <button
                          onClick={() => handleUnlockOrder(o.id)}
                          disabled={updating}
                          className="flex items-center gap-1 px-3 py-1 border border-[#F4A623] text-[#F4A623] text-xs font-semibold rounded-md disabled:opacity-50"
                        >
                          <Unlock size={12} /> {tOrders('actions.unlock')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          /* ── Reservations / Deposits card list ────────────── */
          reservations.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8ECE4] p-8 text-center">
              <p className="text-[#8C8478] text-sm">{t('noResults')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reservations.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRes(r)}
                  className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex flex-col gap-2 active:bg-[#F8F7F4]/80 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-semibold text-brown">{r.user?.name || 'N/A'}</div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge
                        type="reservation"
                        status={r.status}
                        label={t(`status.${r.status}`)}
                      />
                      <StatusBadge
                        type="deposit"
                        status={r.depositStatus}
                        label={t(`depositStatus.${r.depositStatus}`)}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-[#8C8478]">
                    {formatDateDisplay(r.date)} · {r.yurt?.name} · {t('guestsSuffix', { count: r.guestCount })}
                  </div>

                  {/* Deposits view: prominent action buttons */}
                  {view === 'deposits' && r.status === 'PAYMENT_SUBMITTED' && (
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDeposit(r.id) }}
                        disabled={updating}
                        className="px-3 py-1 bg-[#5B8C3E] text-white text-xs font-semibold rounded-md disabled:opacity-50"
                      >
                        {t('actions.confirm')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelReservation(r.id) }}
                        disabled={updating}
                        className="px-3 py-1 text-[#DC3545] text-xs font-semibold hover:underline disabled:opacity-50"
                      >
                        {t('actions.reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </>
  )
}
