'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  CalendarPlus,
  Clock4,
  TriangleAlert,
  Activity,
  Users,
  ChevronRight,
  Check,
  XCircle,
  MessageCircle,
} from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import CreateReservationModal from '@/components/admin/CreateReservationModal'
import UpcomingAssignments from './UpcomingAssignments'
import {
  useDashboardData,
  getGreeting,
  formatTodayDate,
  hoursUntil,
} from './useDashboardData'

export default function DashboardMobile() {
  const tc = useTranslations('admin.common')
  const {
    t,
    userName,
    hasError,
    todayRes,
    todayCount,
    pendingDeposits,
    pendingDepositCount,
    activities,
    statCards,
    expiringSoon,
    pendingRefunds,
    pendingRefundCount,
    pendingInquiries,
    pendingInquiryCount,
    remindingSoon,
    showCreateModal,
    setShowCreateModal,
    mutateAll,
    handleRemind,
  } = useDashboardData()

  const greeting = getGreeting(t)

  const handleConfirmDeposit = useCallback(async (id: string) => {
    if (!confirm(t('confirmDeposit'))) return
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONFIRMED', depositStatus: 'CONFIRMED', depositConfirmedAt: new Date().toISOString() }),
    })
    mutateAll()
  }, [mutateAll])

  const handleRejectDeposit = useCallback(async (id: string) => {
    if (!confirm(t('rejectDeposit'))) return
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', depositStatus: 'REFUNDED' }),
    })
    mutateAll()
  }, [mutateAll])

  return (
    <div className="flex flex-col min-h-full">
      <AdminTopBar title={`${greeting}${userName ? `，${userName}` : ''}`} />

      <div className="flex-1 overflow-auto px-4 pb-24">
        {/* Date subtitle + Create button */}
        <div className="flex items-center justify-between mt-2 mb-4">
          <p className="text-[13px]" style={{ color: '#8A7E6B' }}>
            {formatTodayDate(t)}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#6B7F5E] text-white rounded-full text-sm font-medium cursor-pointer"
          >
            <CalendarPlus size={16} />
            {t('createReservation')}
          </button>
        </div>

        {/* Error Banner */}
        {hasError && (
          <div className="rounded-lg px-3 py-2.5 text-[13px] mb-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
            {t('dataError')}
          </div>
        )}

        {/* ─── 2x2 Stat Cards ─── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {statCards.map((card) => (
            <Link
              key={card.label}
              href={card.href || '#'}
              className="rounded-xl p-4 flex flex-col gap-2 no-underline"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.iconBg.replace('bg-[', '').replace(']', '') }}>
                  <card.icon size={16} className={card.iconColor} />
                </div>
                {card.pulse && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#D4A017' }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#8B6914' }} />
                  </span>
                )}
              </div>
              <span className="text-[22px] font-bold leading-none" style={{ color: '#2C2416' }}>
                {card.value}
              </span>
              <span className="text-[11px] font-medium" style={{ color: '#8A7E6B' }}>
                {card.label}
              </span>
            </Link>
          ))}
        </div>

        {/* ─── Expiring Soon (mobile) ─── */}
        {expiringSoon.length > 0 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <TriangleAlert size={15} style={{ color: '#C4533A' }} />
              <span className="text-[14px] font-bold" style={{ color: '#C4533A' }}>
                {t('expiringSoon.title')}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {expiringSoon.map((row) => {
                const hrs = row.paymentDeadline ? Math.max(0, Math.round(hoursUntil(row.paymentDeadline))) : 0
                const isUrgent = hrs <= 6
                return (
                  <div
                    key={row.id}
                    className="rounded-xl p-4 flex flex-col gap-2"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9', borderLeft: `3px solid ${isUrgent ? '#C4533A' : '#D4A017'}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold" style={{ color: '#2C2416' }}>
                        {row.user.name || row.user.email}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={
                          isUrgent
                            ? { backgroundColor: '#FEF2F2', color: '#C4533A' }
                            : { backgroundColor: '#FFF8E1', color: '#8B6914' }
                        }
                      >
                        <Clock4 size={10} />
                        {hrs}h
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px]" style={{ color: '#8A7E6B' }}>
                      <span>{row.yurt?.name ? `${row.yurt.name}${row.yurt.alias ? ` (${row.yurt.alias})` : ''}` : tc('pendingYurt')}</span>
                      <span>{new Date(row.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <button
                      onClick={() => handleRemind(row.id)}
                      disabled={remindingSoon === row.id}
                      className="self-end text-[12px] font-semibold px-3 py-1.5 rounded-md transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                      style={
                        remindingSoon === row.id
                          ? { backgroundColor: '#E8E2D9', color: '#8A7E6B' }
                          : { backgroundColor: '#C4533A', color: '#FFFFFF' }
                      }
                    >
                      {remindingSoon === row.id ? t('sent') : t('expiringSoon.remind')}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ─── 待处理事项: Pending Deposits ─── */}
        {pendingDepositCount > 0 && (
          <section className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold" style={{ color: '#2C2416' }}>
                {t('pendingItems')}
              </span>
              <Link href="/admin/reservations?status=PAYMENT_SUBMITTED" className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: '#6B7F5E' }}>
                {t('viewAll')} <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {pendingDeposits?.slice(0, 5).map((res) => (
                <div
                  key={res.id}
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
                >
                  <Link
                    href="/admin/reservations"
                    className="flex items-center gap-3 no-underline"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFF8E1' }}>
                      <Clock4 size={16} style={{ color: '#8B6914' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-semibold block truncate" style={{ color: '#2C2416' }}>
                        {res.user.name || res.user.email}
                      </span>
                      <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                        {res.yurt?.name ? `${res.yurt.name}${res.yurt.alias ? ` (${res.yurt.alias})` : ''}` : tc('pendingYurt')} · {new Date(res.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <StatusBadge type="deposit" status="PENDING" label={t('pendingReview')} />
                  </Link>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleRejectDeposit(res.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-colors"
                      style={{ backgroundColor: '#FEF2F2', color: '#C4533A' }}
                    >
                      <XCircle size={13} />
                      {t('reject')}
                    </button>
                    <button
                      onClick={() => handleConfirmDeposit(res.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-semibold cursor-pointer transition-colors"
                      style={{ backgroundColor: '#E8F5E9', color: '#4A7C59' }}
                    >
                      <Check size={13} />
                      {t('confirmBtn')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── 待处理咨询 ─── */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-bold" style={{ color: '#2C2416' }}>
              {t('pendingInquiriesTitle')}
            </span>
            <Link href="/admin/inquiries" className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: '#6B7F5E' }}>
              {t('inquiriesView')} <ChevronRight size={14} />
            </Link>
          </div>
          {pendingInquiryCount === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <span className="text-sm" style={{ color: '#8A7E6B' }}>{t('noPendingInquiries')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingInquiries.slice(0, 5).map((inq) => (
                <Link
                  key={inq.id}
                  href={`/admin/inquiries/${inq.id}`}
                  className="rounded-xl p-4 flex items-center gap-3 no-underline"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0E7FF' }}>
                    <MessageCircle size={16} style={{ color: '#7C3AED' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold block truncate" style={{ color: '#2C2416' }}>
                      {inq.user.name || inq.user.email}
                    </span>
                    <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                      {new Date(inq.preferredDate).toLocaleDateString('zh-CN')} · {inq.guestCountMin}–{inq.guestCountMax} {t('guestSuffix')}
                    </span>
                  </div>
                  {inq.priority !== 'NORMAL' && (
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      inq.priority === 'URGENT' ? 'bg-[#DC3545]/15 text-[#DC3545]' : 'bg-[#F4A623]/20 text-[#8B6914]'
                    }`}>
                      {inq.priority}
                    </span>
                  )}
                </Link>
              ))}
              {pendingInquiries.length > 5 && (
                <Link
                  href="/admin/inquiries"
                  className="text-center text-[12px] font-medium py-2 no-underline"
                  style={{ color: '#6B7F5E' }}
                >
                  {t('viewAllInquiries', { count: pendingInquiries.length })}
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ─── 今日预订 ─── */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-bold" style={{ color: '#2C2416' }}>
              {t('todayBookings')}
            </span>
            <Link href="/admin/calendar" className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: '#6B7F5E' }}>
              {t('calendarView')} <ChevronRight size={14} />
            </Link>
          </div>
          {todayCount === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <span className="text-sm" style={{ color: '#8A7E6B' }}>{t('noBookingsToday')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todayRes?.map((res) => (
                <Link
                  key={res.id}
                  href="/admin/reservations"
                  className="rounded-xl p-4 flex items-center gap-3 no-underline"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#EBF4FF' }}>
                    <Users size={16} style={{ color: '#3B82F6' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold block truncate" style={{ color: '#2C2416' }}>
                      {res.user.name || res.user.email}
                    </span>
                    <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                      {res.yurt?.name ? `${res.yurt.name}${res.yurt.alias ? ` (${res.yurt.alias})` : ''}` : tc('pendingYurt')} · {res.guestCount} {t('guestSuffix')}
                    </span>
                  </div>
                  <StatusBadge
                    type="reservation"
                    status={res.status}
                    label={
                      res.status === 'CONFIRMED' ? t('status.confirmed') :
                      res.status === 'PENDING_PAYMENT' ? t('status.pendingPayment') :
                      res.status === 'PAYMENT_SUBMITTED' ? t('status.paymentSubmitted') :
                      res.status === 'COMPLETED' ? t('status.completed') :
                      res.status === 'CANCELLED' ? t('status.cancelled') : res.status
                    }
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── Pending Refunds ─── */}
        {pendingRefundCount > 0 && (
          <section className="mb-5">
            <div className="rounded-xl p-4 bg-white border border-[#E8ECE4]">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-[#DC3545] animate-pulse" />
                <span className="text-sm font-bold text-[#DC3545]">
                  {t('pendingRefunds', { count: pendingRefundCount })}
                </span>
              </div>
              <div className="space-y-2">
                {pendingRefunds.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm px-3 py-2 bg-[#FDE8E8]/50 rounded-lg">
                    <span className="text-[#2C2416]">{r.user?.name || r.user?.email} — ${r.depositAmount}</span>
                    <button
                      onClick={() => window.location.href = '/admin/reservations'}
                      className="text-xs font-semibold text-[#DC3545] hover:underline cursor-pointer bg-transparent border-none"
                    >
                      {t('processRefund')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ─── Upcoming Assignments ─── */}
        <section className="mb-5">
          <UpcomingAssignments />
        </section>

        {/* ─── 最近动态 ─── */}
        <section className="mb-5">
          <span className="text-[14px] font-bold block mb-3" style={{ color: '#2C2416' }}>
            {t('recentActivity')}
          </span>
          {activities.length === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <Activity size={20} style={{ color: '#8A7E6B' }} />
              <span className="text-sm" style={{ color: '#8A7E6B' }}>{t('noActivity')}</span>
            </div>
          ) : (
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <div className="relative flex flex-col">
                {/* Vertical timeline line */}
                <div
                  className="absolute left-[5px] top-2 bottom-2 w-px"
                  style={{ backgroundColor: '#E8E2D9' }}
                />
                {activities.map((a, i) => (
                  <div
                    key={i}
                    className="relative flex items-start gap-3 py-2.5"
                  >
                    <span className={`relative z-10 mt-1 shrink-0 w-[10px] h-[10px] rounded-full ring-2 ring-white ${a.color}`} />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-[12px] font-medium leading-snug" style={{ color: '#2C2416' }}>
                        {a.text}
                      </span>
                      <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                        {a.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <CreateReservationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          mutateAll()
        }}
      />
    </div>
  )
}
