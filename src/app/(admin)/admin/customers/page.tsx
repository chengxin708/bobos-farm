"use client"

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { Search, X, Save } from 'lucide-react'

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
  capacity: number
}

interface Reservation {
  id: string
  userId: string
  yurtId: string
  date: string
  guestCount: number
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  createdAt: string
  user: ReservationUser
  yurt: ReservationYurt
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
  'bg-[#C4724B]', 'bg-amber', 'bg-green', 'bg-blue', 'bg-[#DC3545]',
  'bg-[#8B6914]', 'bg-[#5B8C3E]', 'bg-[#3B82F6]', 'bg-[#9333EA]', 'bg-[#EC4899]',
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
  if (totalVisits >= 10) return { tag: 'VIP', tagColor: 'bg-[#FEF3CD] text-amber' }
  if (totalVisits >= 1) return { tag: 'Regular', tagColor: 'bg-light-blue-bg text-blue' }
  return { tag: '', tagColor: '' }
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type FilterType = 'all' | 'vip' | 'regular' | 'blocked'

// ── Component ──────────────────────────────────────────────────────

export default function Customers() {
  const t = useTranslations('admin.customers')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  // Load note when a customer is selected
  const loadNote = useCallback(async (customerId: string) => {
    // Skip if we already have a cached note (including empty string — only skip if key exists)
    if (customerId in notes) return
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`)
      if (res.ok) {
        const data = await res.json()
        setNotes(prev => ({ ...prev, [customerId]: data.note ?? '' }))
      }
    } catch {
      // ignore fetch errors for notes
    }
  }, [notes])

  const handleSaveNote = useCallback(async (customerId: string) => {
    setNoteSaving(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: notes[customerId] ?? '' }),
      })
      if (res.ok) {
        setNoteSaved(true)
        setTimeout(() => setNoteSaved(false), 2000)
      }
    } catch {
      // ignore save errors silently
    } finally {
      setNoteSaving(false)
    }
  }, [notes])

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
        reservations: sorted.slice(0, 10).map(r => ({
          date: formatDateShort(r.date),
          status: r.status === 'CONFIRMED' ? 'Confirmed'
            : r.status === 'COMPLETED' ? 'Completed'
            : r.status === 'CANCELLED' ? 'Cancelled'
            : r.status === 'PENDING_PAYMENT' ? 'Pending'
            : r.status === 'PAYMENT_SUBMITTED' ? 'Submitted'
            : r.status,
          yurtName: r.yurt.name,
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

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedId) || null,
    [customers, selectedId]
  )

  const handleRowClick = useCallback((id: string) => {
    setSelectedId(id)
    setDetailOpen(true)
    loadNote(id)
  }, [loadNote])

  const filterKeys: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('filters.all') },
    { key: 'vip', label: t('filters.vip') },
    { key: 'regular', label: t('filters.regular') },
    { key: 'blocked', label: t('filters.blocked') },
  ]

  const STATUS_COLORS: Record<string, string> = {
    Confirmed: 'text-green',
    Completed: 'text-[#4A4A4A]',
    Cancelled: 'text-[#DC3545]',
    Pending: 'text-[#D4A017]',
    Submitted: 'text-[#C4724B]',
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex bg-cream-bg overflow-hidden">
        {/* Left - Table */}
        <div className="flex-1 p-6 overflow-auto flex flex-col gap-5">
          {/* Search & Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-beige rounded-md px-3 py-2 gap-2 flex-1 max-w-md">
              <Search size={16} className="text-gray-text" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-sm bg-transparent outline-none flex-1"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={14} className="text-gray-text" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {filterKeys.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${
                    activeFilter === f.key ? 'bg-amber text-white border-amber' : 'bg-white text-brown border-beige'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-gray-text">Loading customers...</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-beige overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-beige">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.name')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.email')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.phone')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.visits')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.lastVisit')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.tag')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-text">{t('table.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-text">
                        No customers found
                      </td>
                    </tr>
                  )}
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-b border-beige last:border-b-0 hover:bg-cream-bg/50 cursor-pointer ${
                        selectedId === c.id && detailOpen ? 'bg-amber-light-bg' : ''
                      }`}
                      onClick={() => handleRowClick(c.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 ${c.initialsColor} rounded-full flex items-center justify-center text-white text-xs font-semibold`}>
                            {c.initials}
                          </div>
                          <span className="text-sm font-medium text-brown">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-text">{c.email}</td>
                      <td className="px-4 py-3 text-sm text-brown">{c.phone}</td>
                      <td className="px-4 py-3 text-sm text-brown">{c.totalVisits}</td>
                      <td className="px-4 py-3 text-sm text-brown">{c.lastVisit}</td>
                      <td className="px-4 py-3">
                        {c.tag && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.tagColor}`}>
                            {c.tag}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs font-semibold text-amber">{t('actions.view')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right - Customer Detail */}
        {detailOpen && selectedCustomer && (
          <div className="w-[380px] bg-white border-l border-beige p-5 flex flex-col gap-4 overflow-auto shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-brown">{t('detail.title')}</span>
              <button onClick={() => setDetailOpen(false)}>
                <X size={16} className="text-gray-text" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 ${selectedCustomer.initialsColor} rounded-full flex items-center justify-center text-white text-xl font-bold`}>
                {selectedCustomer.initials}
              </div>
              <span className="text-base font-bold text-brown">{selectedCustomer.name}</span>
              <span className="text-xs text-gray-text">{selectedCustomer.email}</span>
              <span className="text-xs text-gray-text">{selectedCustomer.phone}</span>
              <span className="text-xs text-gray-text">{t('detail.memberSince')} {selectedCustomer.memberSince}</span>
            </div>

            {selectedCustomer.tag && (
              <div className="flex gap-1 justify-center">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${selectedCustomer.tagColor}`}>
                  {selectedCustomer.tag}
                </span>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { value: String(selectedCustomer.totalVisits), label: t('detail.stats.totalVisits') },
                { value: `$${selectedCustomer.totalSpent.toLocaleString()}`, label: t('detail.stats.totalSpent') },
                { value: `${selectedCustomer.cancelRate}%`, label: t('detail.stats.cancelRate') },
                { value: String(selectedCustomer.cancelCount), label: t('detail.stats.noShows') },
              ].map((s) => (
                <div key={s.label} className="bg-cream-bg rounded-lg p-2">
                  <div className="text-base font-bold text-brown">{s.value}</div>
                  <div className="text-[10px] text-gray-text">{s.label}</div>
                </div>
              ))}
            </div>

            <div>
              <span className="text-xs font-bold text-brown">{t('detail.reservationHistory')}</span>
              <div className="mt-2 flex flex-col gap-2">
                {selectedCustomer.reservations.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-brown">{r.date}</span>
                    <span className="text-gray-text">{r.yurtName}</span>
                    <span className={`font-semibold ${STATUS_COLORS[r.status] || 'text-gray-text'}`}>{r.status}</span>
                  </div>
                ))}
                {selectedCustomer.reservations.length > 5 && (
                  <button className="text-xs text-amber font-semibold mt-1">
                    {t('detail.showMore', { count: selectedCustomer.reservations.length - 5 })}
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-brown">{t('detail.adminNotes')}</span>
              <textarea
                className="w-full border border-beige rounded-md p-2 text-xs h-20 resize-none mt-2"
                value={notes[selectedCustomer.id] ?? ''}
                onChange={e => setNotes(prev => ({ ...prev, [selectedCustomer.id]: e.target.value }))}
                placeholder="Add notes about this customer..."
              />
              <button
                onClick={() => handleSaveNote(selectedCustomer.id)}
                disabled={noteSaving}
                className={`flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-md mt-2 ${noteSaving ? 'bg-green/60 cursor-not-allowed' : 'bg-green'}`}
              >
                <Save size={12} /> {noteSaved ? 'Saved!' : noteSaving ? 'Saving...' : t('detail.saveNote')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
