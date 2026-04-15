'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  TriangleAlert,
  Activity,
  CalendarPlus,
  Eye,
  Clock4,
} from 'lucide-react'
import CreateReservationModal from '@/components/admin/CreateReservationModal'
import UpcomingAssignments from './UpcomingAssignments'
import {
  useDashboardData,
  getGreeting,
  formatTodayDate,
  hoursUntil,
  toDateStr,
  DAY_LABEL_KEYS,
  CELL_STYLES,
  CellStatus,
} from './useDashboardData'

export default function DashboardDesktop() {
  const tc = useTranslations('admin.common')
  const {
    t,
    today,
    week,
    userName,
    hasError,
    activeYurts,
    weekGrid,
    activities,
    statCards,
    legendItems,
    expiringSoon,
    remindingSoon,
    showCreateModal,
    setShowCreateModal,
    mutateAll,
    handleRemind,
  } = useDashboardData()

  return (
    <>
      <div className="flex-1 overflow-auto">
        <div className="p-6 flex flex-col gap-4 max-w-[1400px] mx-auto">

          {/* Error Banner */}
          {hasError && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
              {t('dataError')}
            </div>
          )}

          {/* ─── Greeting Banner ─── */}
          <div
            className="rounded-xl p-6 flex items-center justify-between"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', borderLeft: '4px solid #6B7F5E' }}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold font-playfair" style={{ color: '#2C2416' }}>
                {getGreeting(t)}{userName ? `，${userName}` : ''}
              </h2>
              <span className="text-sm" style={{ color: '#8A7E6B' }}>
                {formatTodayDate(t)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 hover:bg-[#F5F0E8] cursor-pointer"
                style={{ color: '#2C2416', border: '1px solid #E8E2D9' }}
              >
                <CalendarPlus size={15} style={{ color: '#6B7F5E' }} />
                {t('actions.createReservation')}
              </button>
              <Link
                href="/admin/calendar"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 hover:bg-[#F5F0E8]"
                style={{ color: '#2C2416', border: '1px solid #E8E2D9' }}
              >
                <Eye size={15} style={{ color: '#6B7F5E' }} />
                {t('actions.openCalendar')}
              </Link>
            </div>
          </div>

          {/* ─── Stats Grid ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl p-6 flex flex-col gap-4"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <span className="text-xs font-medium tracking-wide uppercase" style={{ color: '#8A7E6B' }}>
                  {card.label}
                </span>
                <span className="text-[32px] font-bold leading-none" style={{ color: '#2C2416' }}>
                  {card.value}
                </span>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.iconBg.replace('bg-[', '').replace(']', '') }}>
                    <card.icon size={20} className={card.iconColor} />
                  </div>
                  {card.pulse && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#D4A017' }} />
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: '#8B6914' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ─── Two Column: Week Overview + Activity Feed ─── */}
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Week Overview (60%) */}
            <div
              className="lg:w-[60%] rounded-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: '#2C2416' }}>
                  {t('weekOverview.title')}
                </span>
                <Link href="/admin/calendar" className="text-[13px] font-medium" style={{ color: '#6B7F5E' }}>
                  {t('weekOverview.viewCalendar')}
                </Link>
              </div>

              {/* Grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-3 w-[110px]" />
                      {DAY_LABEL_KEYS.map((di) => {
                        const isToday = toDateStr(week.dates[di]) === today
                        return (
                          <th key={di} className="text-center py-2 px-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[11px] font-semibold" style={{ color: isToday ? '#6B7F5E' : '#8A7E6B' }}>
                                {t(`dayLabels.${di}`)}
                              </span>
                              <span
                                className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'text-white' : ''}`}
                                style={isToday ? { backgroundColor: '#6B7F5E', color: '#fff' } : { color: '#2C2416' }}
                              >
                                {week.dates[di]?.getDate()}
                              </span>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeYurts.map((yurt, ri) => (
                      <tr key={yurt.id} style={ri < activeYurts.length - 1 ? { borderBottom: '1px solid #F0EBE4' } : {}}>
                        <td className="py-2.5 pr-3">
                          <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: '#2C2416' }}>
                            {yurt.name}{yurt.alias ? ` (${yurt.alias})` : ''}
                          </span>
                        </td>
                        {DAY_LABEL_KEYS.map((di) => {
                          const cellStatus: CellStatus = weekGrid ? weekGrid[ri][di] : 'available'
                          const isLoading = !weekGrid
                          return (
                            <td key={di} className="text-center py-2.5 px-1">
                              {isLoading ? (
                                <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-200 animate-pulse" />
                              ) : (
                                <span
                                  className={`inline-block w-3.5 h-3.5 rounded-full ${CELL_STYLES[cellStatus].bg}`}
                                  title={legendItems.find(l => l.status === cellStatus)?.label}
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {activeYurts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-sm" style={{ color: '#8A7E6B' }}>
                          {t('noYurtData')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 pt-1">
                {legendItems.map((l) => (
                  <div key={l.status} className="flex items-center gap-1.5">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${CELL_STYLES[l.status].bg}`} />
                    <span className="text-[11px]" style={{ color: '#8A7E6B' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Feed (40%) */}
            <div
              className="lg:w-[40%] rounded-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: '#2C2416' }}>
                  {t('activity.title')}
                </span>
                <span className="text-[13px] font-medium cursor-pointer" style={{ color: '#6B7F5E' }}>
                  {t('activity.viewAll')}
                </span>
              </div>

              {activities.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F5F2ED' }}>
                    <Activity size={22} style={{ color: '#8A7E6B' }} />
                  </div>
                  <span className="text-sm" style={{ color: '#8A7E6B' }}>{t('noActivity')}</span>
                </div>
              ) : (
                <div className="relative flex flex-col">
                  {/* Vertical timeline line */}
                  <div
                    className="absolute left-[5px] top-2 bottom-2 w-px"
                    style={{ backgroundColor: '#E8E2D9' }}
                  />
                  {activities.map((a, i) => (
                    <div
                      key={i}
                      className="relative flex items-start gap-3.5 py-3"
                    >
                      {/* Timeline dot */}
                      <span className={`relative z-10 mt-1 shrink-0 w-[11px] h-[11px] rounded-full ring-2 ring-white ${a.color}`} />
                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium leading-snug" style={{ color: '#2C2416' }}>
                          {a.text}
                        </span>
                        <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                          {a.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ─── Expiring Soon Alerts ─── */}
          {expiringSoon.length > 0 && (
            <div
              className="rounded-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', borderLeft: '4px solid #C4533A', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                  <TriangleAlert size={16} style={{ color: '#C4533A' }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold" style={{ color: '#C4533A' }}>
                    {t('expiringSoon.title')}
                  </span>
                  <span className="text-[12px]" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.description')}
                  </span>
                </div>
              </div>

              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E8E2D9' }}>
                {/* Table Head */}
                <div className="flex items-center px-5 py-2.5" style={{ backgroundColor: '#FAF8F5' }}>
                  <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colCustomer')}
                  </span>
                  <span className="w-[100px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colDate')}
                  </span>
                  <span className="w-[130px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colYurt')}
                  </span>
                  <span className="w-[110px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colExpiresIn')}
                  </span>
                  <span className="w-[80px] text-[11px] font-semibold uppercase tracking-wide text-right" style={{ color: '#8A7E6B' }}>
                    {t('expiringSoon.colAction')}
                  </span>
                </div>
                {/* Table Rows */}
                {expiringSoon.map((row) => {
                  const hrs = row.paymentDeadline ? Math.max(0, Math.round(hoursUntil(row.paymentDeadline))) : 0
                  const isUrgent = hrs <= 6
                  return (
                    <div
                      key={row.id}
                      className="flex items-center px-5 py-3"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderTop: '1px solid #F0EBE4',
                      }}
                    >
                      <span className="flex-1 text-[13px] font-medium" style={{ color: '#2C2416' }}>
                        {row.user.name || row.user.email}
                      </span>
                      <span className="w-[100px] text-[13px]" style={{ color: '#2C2416' }}>
                        {new Date(row.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="w-[130px] text-[13px]" style={{ color: '#2C2416' }}>
                        {row.yurt?.name ? `${row.yurt.name}${row.yurt.alias ? ` (${row.yurt.alias})` : ''}` : tc('pendingYurt')}
                      </span>
                      <div className="w-[110px]">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={
                            isUrgent
                              ? { backgroundColor: '#FEF2F2', color: '#C4533A' }
                              : { backgroundColor: '#FFF8E1', color: '#8B6914' }
                          }
                        >
                          <Clock4 size={11} />
                          {hrs} {t('hours')}
                        </span>
                      </div>
                      <div className="w-[80px] text-right">
                        <button
                          onClick={() => handleRemind(row.id)}
                          disabled={remindingSoon === row.id}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-md transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                          style={
                            remindingSoon === row.id
                              ? { backgroundColor: '#E8E2D9', color: '#8A7E6B' }
                              : { backgroundColor: '#C4533A', color: '#FFFFFF' }
                          }
                        >
                          {remindingSoon === row.id ? t('sent') : t('expiringSoon.remind')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Upcoming Assignments ─── */}
          <UpcomingAssignments />
        </div>
      </div>

      <CreateReservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={mutateAll}
      />
    </>
  )
}
