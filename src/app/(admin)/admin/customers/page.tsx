"use client"

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import AdminTopBar from '@/components/admin/AdminTopBar'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Search, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface ReservationUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

interface ReservationYurt {
  id: string
  name: string
  alias?: string | null
  capacity: number
}

interface Reservation {
  id: string
  userId: string
  yurtId: string | null
  date: string
  guestCount: number
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_PENDING_REFUND' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  createdAt: string
  user: ReservationUser
  yurt: ReservationYurt | null
}

interface CustomerData {
  id: string
  name: string
  initials: string
  initialsColor: string
  email: string
  phone: string
  totalVisits: number
  lastVisit: string
  totalSpent: number
  cancelRate: number
  cancelCount: number
  tag: string
  tagColor: string
  memberSince: string
  reservations: { date: string; status: string; yurtName: string }[]
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const AVATAR_COLORS = [
  'bg-[#C4724B]', 'bg-[#6B7F5E]', 'bg-[#2980B9]', 'bg-[#8C8478]', 'bg-[#DC3545]',
  'bg-[#C47D52]', 'bg-[#5B8C3E]', 'bg-[#3B82F6]', 'bg-[#9333EA]', 'bg-[#EC4899]',
]

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function getAvatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function computeTag(totalVisits: number): { tag: string; tagColor: string } {
  if (totalVisits >= 10) return { tag: 'VIP', tagColor: 'bg-[#F0EDE4] text-[#6B7F5E]' }
  if (totalVisits >= 1) return { tag: 'Regular', tagColor: 'bg-[#EBF0E8] text-[#6B7F5E]' }
  return { tag: '', tagColor: '' }
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type FilterType = 'all' | 'vip' | 'regular' | 'blocked'

// ── Component ──────────────────────────────────────────────────────

function CustomerCard({
  customer,
  onClick,
  t,
}: {
  customer: CustomerData
  onClick: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, values?: any) => string
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex items-center gap-3 active:bg-[#F8F7F4]/80 cursor-pointer"
    >
      <div className={`w-10 h-10 ${customer.initialsColor} rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
        {customer.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1A1208] truncate">{customer.name}</span>
          {customer.tag && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${customer.tagColor} shrink-0 ml-2`}>
              {customer.tag}
            </span>
          )}
        </div>
        <div className="text-xs text-[#8C8478] truncate">
          {customer.email.endsWith('@placeholder.local') ? t('noEmail') : customer.email}
        </div>
        <div className="text-xs text-[#8C8478] mt-0.5">
          {t('card.visits', { count: customer.totalVisits })} · {customer.lastVisit !== '--' ? t('card.lastVisit', { date: customer.lastVisit }) : '--'}
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const t = useTranslations('admin.customers')
  const tc = useTranslations('admin.common')
  const isMobile = useIsMobile()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const { data: allReservations, isLoading } = useSWR<Reservation[]>('/api/reservations', fetcher)

  // Build customer data from reservations
  const customers: CustomerData[] = useMemo(() => {
    if (!allReservations) return []

    const userMap = new Map<string, {
      user: ReservationUser
      reservations: Reservation[]
    }>()

    for (const res of allReservations) {
      const existing = userMap.get(res.userId)
      if (existing) {
        existing.reservations.push(res)
      } else {
        userMap.set(res.userId, { user: res.user, reservations: [res] })
      }
    }

    return Array.from(userMap.values()).map(({ user, reservations }) => {
      const completedOrConfirmed = reservations.filter(
        r => r.status === 'COMPLETED' || r.status === 'CONFIRMED'
      )
      const cancelled = reservations.filter(r => r.status === 'CANCELLED')
      const totalVisits = completedOrConfirmed.length
      const totalSpent = reservations
        .filter(r => r.depositStatus === 'CONFIRMED')
        .reduce((sum, r) => sum + r.depositAmount, 0)
      const cancelRate = reservations.length > 0
        ? Math.round((cancelled.length / reservations.length) * 100)
        : 0

      const sorted = [...reservations].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      const lastVisit = completedOrConfirmed.length > 0
        ? formatDateShort(
            completedOrConfirmed.sort((a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0].date
          )
        : '--'

      const earliest = sorted[sorted.length - 1]
      const { tag, tagColor } = computeTag(totalVisits)

      return {
        id: user.id,
        name: user.name || user.email.split('@')[0],
        initials: getInitials(user.name, user.email),
        initialsColor: getAvatarColor(user.id),
        email: user.email,
        phone: user.phone || '--',
        totalVisits,
        lastVisit,
        totalSpent,
        cancelRate,
        cancelCount: cancelled.length,
        tag,
        tagColor,
        memberSince: earliest ? formatDateShort(earliest.createdAt) : '--',
        reservations: sorted.map(r => ({
          date: formatDateShort(r.date),
          status: r.status === 'CONFIRMED' ? 'Confirmed'
            : r.status === 'COMPLETED' ? 'Completed'
            : r.status === 'CANCELLED' ? 'Cancelled'
            : r.status === 'CANCELLED_PENDING_REFUND' ? 'Pending Refund'
            : r.status === 'PENDING_PAYMENT' ? 'Pending'
            : r.status === 'PAYMENT_SUBMITTED' ? 'Submitted'
            : r.status,
          yurtName: r.yurt?.name ? `${r.yurt.name}${r.yurt.alias ? ` (${r.yurt.alias})` : ''}` : 'Pending',
        })),
      }
    }).sort((a, b) => b.totalVisits - a.totalVisits)
  }, [allReservations])

  // Filter
  const filtered = useMemo(() => {
    let list = customers
    if (activeFilter === 'vip') list = list.filter(c => c.tag === 'VIP')
    else if (activeFilter === 'regular') list = list.filter(c => c.tag === 'Regular')
    else if (activeFilter === 'blocked') list = list.filter(c => c.tag === 'Blocked')

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
      )
    }
    return list
  }, [customers, activeFilter, searchQuery])

  const handleRowClick = useCallback((id: string) => {
    router.push(`/admin/customers/${id}`)
  }, [router])

  const filterKeys: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    { key: 'vip', label: t('filters.vip') },
    { key: 'regular', label: t('filters.regular') },
    { key: 'blocked', label: t('filters.blocked') },
  ]

  return (
    <>
      {isMobile && <AdminTopBar title={t('title')} />}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Table */}
        <div className="flex-1 p-4 md:p-6 overflow-auto flex flex-col gap-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center bg-white border border-[#E8ECE4] rounded-lg px-3 py-2 gap-2 flex-1 w-full sm:max-w-md">
              <Search size={16} className="text-[#8C8478]" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-sm bg-transparent outline-none flex-1 text-[#1A1208] placeholder:text-[#8C8478]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={14} className="text-[#8C8478]" />
                </button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {filterKeys.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    activeFilter === f.key
                      ? 'bg-[#6B7F5E] text-white border-[#6B7F5E]'
                      : 'bg-white text-[#1A1208] border-[#E8ECE4] hover:bg-[#F8F7F4]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content: Cards on mobile, Table on desktop */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-[#8C8478]">{tc('loadingCustomers')}</div>
            </div>
          ) : isMobile ? (
            <div className="flex flex-col gap-2">
              {filtered.length === 0 ? (
                <div className="text-center text-sm text-[#8C8478] py-8">No customers found</div>
              ) : (
                filtered.map((c) => (
                  <CustomerCard
                    key={c.id}
                    customer={c}
                    onClick={() => handleRowClick(c.id)}
                    t={t}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[#E8ECE4]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.name')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.email')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.phone')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.visits')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.lastVisit')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.tag')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#8C8478] uppercase">{t('table.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8C8478]">
                          No customers found
                        </td>
                      </tr>
                    )}
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-[#E8ECE4] last:border-b-0 hover:bg-[#F8F7F4] cursor-pointer transition-colors"
                        onClick={() => handleRowClick(c.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 ${c.initialsColor} rounded-full flex items-center justify-center text-white text-xs font-semibold`}>
                              {c.initials}
                            </div>
                            <span className="text-sm font-medium text-[#1A1208]">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#8C8478]">
                          {c.email.endsWith('@placeholder.local') ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F4A623]/15 text-[#F4A623]">{t('noEmail')}</span>
                          ) : c.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#1A1208]">{c.phone}</td>
                        <td className="px-4 py-3 text-sm text-[#1A1208]">{c.totalVisits}</td>
                        <td className="px-4 py-3 text-sm text-[#1A1208]">{c.lastVisit}</td>
                        <td className="px-4 py-3">
                          {c.tag && (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.tagColor}`}>
                              {c.tag}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-xs font-semibold text-[#6B7F5E] hover:underline">{t('actions.view')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
