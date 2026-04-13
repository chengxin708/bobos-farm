'use client'

import { Search, X, ChevronRight, Lock, Unlock } from 'lucide-react'
import StatusBadge from '@/components/admin/StatusBadge'
import ReservationDetail from './ReservationDetail'
import {
  useReservationsData,
  type ViewMode,
  ORDER_STATUS_BADGE,
  formatDateDisplay,
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
          className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${
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

export default function ReservationsDesktop() {
  const data = useReservationsData()

  const {
    sessionStatus,
    view, setView,
    activeTab, setActiveTab,
    search, setSearch,
    startDate, setStartDate,
    endDate, setEndDate,
    clearFilters,
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
    mutateDetail,
    successMsg, setSuccessMsg,
    t,
    tOrders,
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
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-auto">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-[#EAF2E3] border border-[#5B8C3E]/30 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/60 hover:text-[#2D5016]">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        )}

        {/* Title row + Segmented Control */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-brown font-playfair">{t('title')}</h2>
            <p className="text-sm text-[#8C8478] mt-0.5">{t('subtitle')}</p>
          </div>
          <SegmentedControl value={view} onChange={setView} labels={{ all: t('viewSegments.all'), deposits: t('viewSegments.deposits'), orders: t('viewSegments.orders') }} />
        </div>

        {/* Search + Date filters */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex items-center bg-white border border-[#E8ECE4] rounded-xl px-3 py-2 gap-2 w-72">
            <Search size={16} className="text-[#8C8478] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="text-sm bg-transparent outline-none flex-1"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#8C8478] hover:text-brown">
                <X size={14} />
              </button>
            )}
          </div>
          {view !== 'orders' && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#8C8478]">{t('startDate')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm border border-[#E8ECE4] rounded-xl px-2 py-1.5 bg-white text-brown"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#8C8478]">{t('endDate')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm border border-[#E8ECE4] rounded-xl px-2 py-1.5 bg-white text-brown"
                />
              </div>
            </>
          )}
          {(search || startDate || endDate || activeTab !== 'all' || orderTab !== 'all') && (
            <button onClick={clearFilters} className="text-xs text-[#8B6914] font-semibold hover:underline">
              {t('clearFilters')}
            </button>
          )}
        </div>

        {/* Status tabs */}
        {view === 'all' && (
          <div className="flex gap-1 border-b border-[#E8ECE4] overflow-x-auto">
            {reservationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[#8B6914] text-[#8B6914]'
                    : 'border-transparent text-[#8C8478] hover:text-brown'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {view === 'orders' && (
          <div className="flex gap-1 border-b border-[#E8ECE4] overflow-x-auto">
            {orderTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setOrderTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
                  orderTab === tab.key
                    ? 'border-[#8B6914] text-[#8B6914]'
                    : 'border-transparent text-[#8C8478] hover:text-brown'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Table content ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-[#8C8478] text-sm">{t('loading')}</div>
          ) : view === 'orders' ? (
            /* ── Orders table ───────────────────────────────── */
            !orders.length ? (
              <div className="p-8 text-center text-[#8C8478] text-sm">{tOrders('noResults')}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8ECE4]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.guest')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.date')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.yurt')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.items')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.total')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.status')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{tOrders('table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const badge = ORDER_STATUS_BADGE[o.status] || ORDER_STATUS_BADGE.DRAFT
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-[#E8ECE4] last:border-b-0 hover:bg-[#F8F7F4]/50 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-brown">{o.reservation.user?.name || 'N/A'}</div>
                          <div className="text-xs text-[#8C8478]">{o.reservation.user?.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-brown">{formatDateDisplay(o.reservation.date)}</td>
                        <td className="px-4 py-3 text-sm text-brown">{o.reservation.yurt?.name}</td>
                        <td className="px-4 py-3 text-sm text-brown">{o._count.items}</td>
                        <td className="px-4 py-3 text-sm text-brown font-medium">
                          {o.estimatedTotal != null ? `$${o.estimatedTotal.toFixed(2)}` : '\u2014'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                            {tOrders(`status.${o.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {o.status === 'SUBMITTED' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleLockOrder(o.id) }}
                                disabled={updating}
                                className="flex items-center gap-1 text-xs font-semibold text-[#5B8C3E] hover:underline disabled:opacity-50"
                              >
                                <Lock size={12} /> {tOrders('actions.lock')}
                              </button>
                            )}
                            {o.status === 'LOCKED' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnlockOrder(o.id) }}
                                disabled={updating}
                                className="flex items-center gap-1 text-xs font-semibold text-[#F4A623] hover:underline disabled:opacity-50"
                              >
                                <Unlock size={12} /> {tOrders('actions.unlock')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* ── Reservations table (all / deposits) ────────── */
            !reservations.length ? (
              <div className="p-8 text-center text-[#8C8478] text-sm">{t('noResults')}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E8ECE4]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.guest')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.date')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.yurt')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.guests')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.status')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.deposit')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#E8ECE4] last:border-b-0 hover:bg-[#F8F7F4]/50 cursor-pointer ${selectedRes?.id === r.id ? 'bg-[#8B6914]/5' : ''}`}
                      onClick={() => setSelectedRes(r)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-brown">{r.user?.name || 'N/A'}</div>
                        <div className="text-xs text-[#8C8478]">{r.user?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-brown">{formatDateDisplay(r.date)}</td>
                      <td className="px-4 py-3 text-sm text-brown">{r.yurt?.name}</td>
                      <td className="px-4 py-3 text-sm text-brown">{r.guestCount}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          type="reservation"
                          status={r.status}
                          label={t(`status.${r.status}`)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          type="deposit"
                          status={r.depositStatus}
                          label={t(`depositStatus.${r.depositStatus}`)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {view === 'deposits' && r.status === 'PAYMENT_SUBMITTED' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); confirmDeposit(r.id) }}
                              disabled={updating}
                              className="text-xs font-semibold text-[#5B8C3E] hover:underline disabled:opacity-50"
                            >
                              {t('actions.confirm')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelReservation(r.id) }}
                              disabled={updating}
                              className="text-xs font-semibold text-[#DC3545] hover:underline disabled:opacity-50"
                            >
                              {t('actions.reject')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedRes(r) }}
                            className="text-xs font-semibold text-[#8B6914] hover:underline flex items-center gap-0.5"
                          >
                            {t('actions.view')} <ChevronRight size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Detail Side Drawer (400px right panel) */}
      {selectedRes && view !== 'orders' && (
        <div className="w-[400px] border-l border-[#E8ECE4] bg-white flex flex-col overflow-hidden shrink-0">
          <ReservationDetail
            reservation={detailRes || selectedRes}
            activityLogs={activityLogs}
            onClose={() => setSelectedRes(null)}
            onAction={{ confirmDeposit, cancelReservation, completeReservation }}
            isUpdating={updating}
            onOrderChanged={() => { mutateReservations(); mutateOrders(); mutateDetail(); }}
          />
        </div>
      )}
    </div>
  )
}
