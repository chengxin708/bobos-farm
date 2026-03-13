"use client"

import Link from 'next/link'
import { Tent, Users, CircleDollarSign, CircleCheck, ClipboardList, Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ReservationCard {
  dow: string
  day: string
  month: string
  yurt: string
  guestCount: number
  depositLine: string
  depositColor: string
  depositIcon: 'confirmed' | 'pending'
  actionLine?: { text: string; link: string; linkLabel: string }
  timerLine?: { text: string }
  status: 'confirmed' | 'pendingPayment' | 'completed'
  statusColor: string
  borderLeft?: boolean
  bgColor: string
  actions?: ('reschedule' | 'payNow' | 'cancel')[]
}

const reservations: ReservationCard[] = [
  {
    dow: 'SAT',
    day: '15',
    month: 'MAR 2026',
    yurt: 'Golden Meadow',
    guestCount: 12,
    depositLine: '$300 deposit confirmed',
    depositColor: '#5B8C3E',
    depositIcon: 'confirmed',
    actionLine: { text: 'notOrderedYet', link: '/pre-order', linkLabel: 'preOrderNow' },
    status: 'confirmed',
    statusColor: '#3B82F6',
    bgColor: '#FFFFFF',
    actions: ['reschedule', 'cancel'],
  },
  {
    dow: 'SAT',
    day: '22',
    month: 'MAR 2026',
    yurt: 'Sunset Ridge',
    guestCount: 8,
    depositLine: '$300 — awaiting payment',
    depositColor: '#F4A623',
    depositIcon: 'pending',
    timerLine: { text: '11h 23m remaining' },
    status: 'pendingPayment',
    statusColor: '#F4A623',
    borderLeft: true,
    bgColor: '#FFFFFF',
    actions: ['payNow', 'cancel'],
  },
  {
    dow: 'SAT',
    day: '8',
    month: 'FEB 2026',
    yurt: 'Willow Creek',
    guestCount: 6,
    depositLine: '$200 deposit paid',
    depositColor: '#5B8C3E',
    depositIcon: 'confirmed',
    actionLine: { text: '10 items ordered', link: '#', linkLabel: 'viewOrder' },
    status: 'completed',
    statusColor: '#5B8C3E',
    bgColor: '#FAFAF8',
  },
]

export default function ReservationsPage() {
  const t = useTranslations('reservations')

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <div className="flex-1 flex flex-col items-center py-[60px] px-20 gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-playfair text-[32px] font-bold text-brown">{t('title')}</h1>
          <p className="text-base text-[#8E8E93]">{t('subtitle')}</p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4 w-[800px]">
          {reservations.map((r) => (
            <div
              key={r.day + r.month}
              className="flex gap-6 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              style={{
                backgroundColor: r.bgColor,
                borderLeft: r.borderLeft ? '4px solid #8B6914' : undefined,
              }}
            >
              {/* Date Column */}
              <div className="flex flex-col items-center gap-0.5 w-[72px] shrink-0">
                <span className="text-[11px] font-bold text-[#8E8E93] tracking-[1.5px]">{r.dow}</span>
                <span className="font-playfair text-[40px] font-bold text-brown leading-none">{r.day}</span>
                <span className="text-[11px] text-[#8E8E93]">{r.month}</span>
              </div>

              {/* Divider */}
              <div className="w-px bg-beige self-stretch" />

              {/* Info Column */}
              <div className="flex flex-col gap-2.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <Tent size={18} className="text-amber" />
                  <span className="text-base font-semibold text-brown">{r.yurt}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Users size={18} className="text-amber" />
                  <span className="text-sm text-[#8E8E93]">{t('guests', { count: r.guestCount })}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CircleDollarSign size={18} style={{ color: r.depositColor }} />
                  <span className="text-sm" style={{ color: r.depositColor }}>{r.depositLine}</span>
                  {r.depositIcon === 'confirmed' && r.status !== 'completed' && (
                    <CircleCheck size={16} className="text-green" />
                  )}
                </div>
                {r.actionLine && (
                  <div className="flex items-center gap-2.5">
                    {r.status === 'completed' ? (
                      <CircleCheck size={18} className="text-green" />
                    ) : (
                      <ClipboardList size={18} className="text-amber" />
                    )}
                    <span className="text-sm text-[#8E8E93]">{r.status === 'completed' ? r.actionLine.text : t(r.actionLine.text as 'notOrderedYet')}</span>
                    <Link href={r.actionLine.link} className="text-sm font-semibold text-amber no-underline">
                      {t(r.actionLine.linkLabel as 'preOrderNow' | 'viewOrder')}
                    </Link>
                  </div>
                )}
                {r.timerLine && (
                  <div className="flex items-center gap-2.5">
                    <Timer size={18} style={{ color: '#F4A623' }} />
                    <span className="text-sm font-semibold" style={{ color: '#F4A623' }}>{r.timerLine.text}</span>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col items-end gap-3">
                <span
                  className="text-xs font-semibold text-white px-3.5 py-1 rounded-xl"
                  style={{ backgroundColor: r.statusColor }}
                >
                  {t(`status.${r.status}`)}
                </span>
                <div className="flex-1" />
                {r.actions?.includes('reschedule') && (
                  <button className="text-[13px] font-medium text-brown px-5 py-2 rounded-lg border border-beige bg-white cursor-pointer">
                    {t('actions.reschedule')}
                  </button>
                )}
                {r.actions?.includes('payNow') && (
                  <Link
                    href="/booking/confirm"
                    className="no-underline text-[13px] font-semibold text-white px-5 py-2 rounded-lg bg-gradient-to-r from-[#8B6914] to-[#A67C2E]"
                  >
                    {t('actions.payNow')}
                  </Link>
                )}
                {r.actions?.includes('cancel') && (
                  <span className="text-[13px] font-medium text-[#EF4444] cursor-pointer">{t('actions.cancel')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
