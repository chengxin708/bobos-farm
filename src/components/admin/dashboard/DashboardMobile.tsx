'use client'

import Link from 'next/link'
import {
  Clock4,
  TriangleAlert,
  Activity,
  Users,
  ChevronRight,
} from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import {
  useDashboardData,
  getGreeting,
  formatTodayDate,
  hoursUntil,
} from './useDashboardData'

export default function DashboardMobile() {
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
    remindingSoon,
    handleRemind,
  } = useDashboardData()

  const greeting = getGreeting()

  return (
    <div className="flex flex-col min-h-full">
      <AdminTopBar title={`${greeting}${userName ? `，${userName}` : ''}`} />

      <div className="flex-1 overflow-auto px-4 pb-24">
        {/* Date subtitle */}
        <p className="text-[13px] mt-2 mb-4" style={{ color: '#8A7E6B' }}>
          {formatTodayDate()}
        </p>

        {/* Error Banner */}
        {hasError && (
          <div className="rounded-lg px-3 py-2.5 text-[13px] mb-4" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
            部分数据加载失败，请下拉刷新重试。
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
                      <span>{row.yurt.name}</span>
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
                      {remindingSoon === row.id ? '已发送' : t('expiringSoon.remind')}
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
                待处理事项
              </span>
              <Link href="/admin/reservations?status=PAYMENT_SUBMITTED" className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: '#6B7F5E' }}>
                查看全部 <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {pendingDeposits?.slice(0, 5).map((res) => (
                <Link
                  key={res.id}
                  href={`/admin/reservations/${res.id}`}
                  className="rounded-xl p-4 flex items-center gap-3 no-underline"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFF8E1' }}>
                    <Clock4 size={16} style={{ color: '#8B6914' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold block truncate" style={{ color: '#2C2416' }}>
                      {res.user.name || res.user.email}
                    </span>
                    <span className="text-[11px]" style={{ color: '#8A7E6B' }}>
                      {res.yurt.name} · {new Date(res.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <StatusBadge type="deposit" status="PENDING" label="待审核" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ─── 今日预订 ─── */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-bold" style={{ color: '#2C2416' }}>
              今日预订
            </span>
            <Link href="/admin/calendar" className="text-[12px] font-medium flex items-center gap-0.5" style={{ color: '#6B7F5E' }}>
              日历视图 <ChevronRight size={14} />
            </Link>
          </div>
          {todayCount === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <span className="text-sm" style={{ color: '#8A7E6B' }}>今日暂无预订</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todayRes?.map((res) => (
                <Link
                  key={res.id}
                  href={`/admin/reservations/${res.id}`}
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
                      {res.yurt.name} · {res.guestCount}位
                    </span>
                  </div>
                  <StatusBadge
                    type="reservation"
                    status={res.status}
                    label={
                      res.status === 'CONFIRMED' ? '已确认' :
                      res.status === 'PENDING_PAYMENT' ? '待付款' :
                      res.status === 'PAYMENT_SUBMITTED' ? '待审核' :
                      res.status === 'COMPLETED' ? '已完成' :
                      res.status === 'CANCELLED' ? '已取消' : res.status
                    }
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── 最近动态 ─── */}
        <section className="mb-5">
          <span className="text-[14px] font-bold block mb-3" style={{ color: '#2C2416' }}>
            最近动态
          </span>
          {activities.length === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-2"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <Activity size={20} style={{ color: '#8A7E6B' }} />
              <span className="text-sm" style={{ color: '#8A7E6B' }}>暂无最近活动</span>
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
    </div>
  )
}
