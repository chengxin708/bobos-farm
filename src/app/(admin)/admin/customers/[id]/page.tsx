"use client"

import { useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { ArrowLeft, ChevronDown, ChevronUp, Save } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'
import StatusBadge from '@/components/admin/StatusBadge'
import ReservationDetail from '@/components/admin/reservations/ReservationDetail'
import { useIsMobile } from '@/hooks/useIsMobile'
import type {
  Reservation as FullReservation,
  ActivityLog,
} from '@/components/admin/reservations/useReservationsData'
import { INACTIVE_RESERVATION_STATUSES } from '@/lib/reservation-fsm'

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
  confirmationCode?: string
  userId: string
  yurtId: string | null
  date: string
  guestCount: number
  specialRequests?: string | null
  status: 'PENDING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'CANCELLED_PENDING_REFUND' | 'EXPIRED'
  depositAmount: number
  depositStatus: 'UNPAID' | 'PENDING' | 'CONFIRMED' | 'REFUNDED'
  depositConfirmedAt?: string | null
  paymentReference?: string | null
  paymentScreenshotUrl?: string | null
  paymentDeadline?: string | null
  holdByAdmin?: boolean
  cancelledAt?: string | null
  cancelReason?: string | null
  createdAt: string
  updatedAt?: string
  user: ReservationUser
  yurt: ReservationYurt | null
  orders?: Array<{ id: string; status: string; estimatedTotal?: number | null; finalTotal?: number | null }>
}

interface CustomerApiResponse {
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
    createdAt: string
  }
  reservations: Reservation[]
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

// ── Component ──────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('admin.customers')
  const tRes = useTranslations('admin.reservations')
  const tc = useTranslations('admin.common')
  const isMobile = useIsMobile()

  // ── State ──────────────────────────────────────────────────────
  const [noteText, setNoteText] = useState<string | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [updating, setUpdating] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────
  const { data, isLoading, mutate: mutateReservations } = useSWR<CustomerApiResponse>(
    `/api/customers/${id}/reservations`,
    fetcher
  )

  const { data: noteData } = useSWR<{ note: string }>(
    `/api/customers/${id}/notes`,
    fetcher,
    {
      onSuccess: (d) => {
        if (noteText === null) setNoteText(d.note ?? '')
      },
    }
  )

  // Contact history (email/phone/wechat with sources + timestamps)
  interface ContactEntry {
    id: string
    type: 'email' | 'phone' | 'wechat'
    value: string
    source: 'self' | 'admin'
    createdAt: string
    isPrimary: boolean
    recordedBy: { id: string; name: string | null; email: string; role: string } | null
  }
  interface ContactHistoryResponse {
    primary: { email: string | null; phone: string | null; wechat: string | null }
    history: { email: ContactEntry[]; phone: ContactEntry[]; wechat: ContactEntry[] }
  }
  const { data: contactHistory } = useSWR<ContactHistoryResponse>(
    `/api/customers/${id}/contact-history`,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Fetch full reservation detail for panel
  const { data: detailRes, mutate: mutateDetail } = useSWR<FullReservation>(
    selectedRes ? `/api/reservations/${selectedRes.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Fetch activity logs for selected reservation
  const { data: activityLogs, mutate: mutateActivityLogs } = useSWR<ActivityLog[]>(
    selectedRes ? `/api/activity-logs?targetId=${selectedRes.id}&targetType=Reservation` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // ── Profile computation ────────────────────────────────────────
  const customerProfile = useMemo(() => {
    if (!data) return null
    const { user, reservations } = data
    const completedOrConfirmed = reservations.filter(r => r.status === 'COMPLETED' || r.status === 'CONFIRMED')
    const cancelled = reservations.filter(r => r.status === 'CANCELLED' || r.status === 'CANCELLED_PENDING_REFUND')
    const totalVisits = completedOrConfirmed.length
    const totalSpent = reservations.filter(r => r.depositStatus === 'CONFIRMED').reduce((sum, r) => sum + r.depositAmount, 0)
    const cancelRate = reservations.length > 0 ? Math.round((cancelled.length / reservations.length) * 100) : 0
    const { tag, tagColor } = computeTag(totalVisits)
    return {
      id: user.id,
      name: user.name || user.email.split('@')[0],
      initials: getInitials(user.name, user.email),
      initialsColor: getAvatarColor(user.id),
      email: user.email,
      phone: user.phone || '--',
      memberSince: formatDateShort(user.createdAt),
      totalVisits,
      totalSpent,
      cancelRate,
      cancelCount: cancelled.length,
      tag,
      tagColor,
    }
  }, [data])

  // ── Reservation splitting ──────────────────────────────────────
  const { upcoming, history } = useMemo(() => {
    if (!data?.reservations) return { upcoming: [], history: [] }
    const todayStr = new Date().toISOString().slice(0, 10)
    const inactive: string[] = INACTIVE_RESERVATION_STATUSES
    return {
      upcoming: data.reservations
        .filter(r => r.date.slice(0, 10) >= todayStr && !inactive.includes(r.status))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      history: data.reservations
        .filter(r => r.date.slice(0, 10) < todayStr || inactive.includes(r.status))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }
  }, [data?.reservations])

  // ── Notes ──────────────────────────────────────────────────────
  const handleSaveNote = useCallback(async () => {
    setNoteSaving(true)
    try {
      const res = await fetch(`/api/customers/${id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText ?? '' }),
      })
      if (res.ok) {
        setNoteSaved(true)
        setTimeout(() => setNoteSaved(false), 2000)
      }
    } catch {
      // ignore
    } finally {
      setNoteSaving(false)
    }
  }, [id, noteText])

  // ── Reservation actions ────────────────────────────────────────
  async function handleResAction(resId: string, body: Record<string, unknown>) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/reservations/${resId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      mutateReservations()
      mutateDetail()
      mutateActivityLogs()
      if (selectedRes?.id === resId) {
        const updated = await res.json()
        setSelectedRes(updated)
      }
    } finally {
      setUpdating(false)
    }
  }

  const confirmDeposit = (resId: string) => handleResAction(resId, { status: 'CONFIRMED', depositStatus: 'CONFIRMED', depositConfirmedAt: new Date().toISOString() })
  const cancelReservation = (resId: string) => handleResAction(resId, { action: 'cancel' })
  const cancelAndRefund = (resId: string) => handleResAction(resId, { action: 'cancel_and_refund' })
  const markRefunded = (resId: string) => handleResAction(resId, { depositStatus: 'REFUNDED' })
  const completeReservation = (resId: string) => handleResAction(resId, { status: 'COMPLETED' })

  const handleOrderChanged = useCallback(() => {
    mutateReservations()
    mutateDetail()
    mutateActivityLogs()
  }, [mutateReservations, mutateDetail, mutateActivityLogs])

  // ── Reservation row ────────────────────────────────────────────
  function ReservationRow({ reservation }: { reservation: Reservation }) {
    const isSelected = selectedRes?.id === reservation.id
    return (
      <div
        onClick={() => setSelectedRes(reservation)}
        className={`flex items-center justify-between text-sm py-3 px-3 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-[#EBF0E8] border border-[#6B7F5E]/30' : 'hover:bg-[#F8F7F4]'
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-[#1A1208] font-medium whitespace-nowrap">{formatDateShort(reservation.date)}</span>
          <span className="text-[#8C8478] text-xs truncate">
            {reservation.yurt?.name
              ? `${reservation.yurt.name}${reservation.yurt.alias ? ` (${reservation.yurt.alias})` : ''}`
              : t('detailPage.pending')}
          </span>
          <span className="text-[#8C8478] text-xs whitespace-nowrap">
            {t('detailPage.guests', { count: reservation.guestCount })}
          </span>
        </div>
        <StatusBadge
          type="reservation"
          status={reservation.status}
          label={tRes(`status.${reservation.status}`)}
        />
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────────────
  if (isLoading || !data) {
    return (
      <>
        {isMobile && <AdminTopBar title={t('detailPage.title')} showBack backHref="/admin/customers" />}
        <div className="flex-1 flex items-center justify-center bg-[#F8F7F4]">
          <p className="text-sm text-[#8C8478]">{tc('loadingCustomers')}</p>
        </div>
      </>
    )
  }

  if (!customerProfile) return null

  // ── Scrollable content ─────────────────────────────────────────
  const content = (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-5">
      {/* Desktop back button */}
      {!isMobile && (
        <button
          onClick={() => router.push('/admin/customers')}
          className="flex items-center gap-1.5 text-sm text-[#6B7F5E] font-medium hover:text-[#5A6E4F] transition-colors w-fit"
        >
          <ArrowLeft size={16} />
          {t('detailPage.backToList')}
        </button>
      )}

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-5">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 ${customerProfile.initialsColor} rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0`}>
            {customerProfile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1A1208] truncate">{customerProfile.name}</h2>
              {customerProfile.tag && (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${customerProfile.tagColor} shrink-0`}>
                  {customerProfile.tag}
                </span>
              )}
            </div>
            {customerProfile.email.endsWith('@placeholder.local') ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F4A623]/15 text-[#F4A623]">{t('noEmail')}</span>
            ) : (
              <p className="text-sm text-[#8C8478] truncate">{customerProfile.email}</p>
            )}
            <p className="text-sm text-[#8C8478]">{customerProfile.phone}</p>
            <p className="text-xs text-[#8C8478] mt-0.5">{t('detail.memberSince')} {customerProfile.memberSince}</p>
          </div>
        </div>
      </div>

      {/* Contact methods + history */}
      {contactHistory && (
        <div className="bg-white rounded-xl border border-[#E8ECE4] p-4 space-y-3">
          <span className="text-xs font-bold text-[#1A1208] uppercase">{t('detailPage.contactSection')}</span>

          {(['email', 'phone', 'wechat'] as const).map(type => {
            const primary = contactHistory.primary[type]
            const allEntries = contactHistory.history[type]
            const others = allEntries.filter(e => !e.isPrimary)
            const label = type === 'email' ? t('detail.email') : type === 'phone' ? t('detail.phone') : t('detailPage.contactSection')
            const wechatLabel = type === 'wechat' ? '微信' : label
            const displayLabel = type === 'wechat' ? wechatLabel : label

            return (
              <div key={type} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-[#8C8478] uppercase w-14 shrink-0">{displayLabel}</span>
                  {primary ? (
                    <span className="text-sm font-bold text-[#1A1208]">{primary}</span>
                  ) : (
                    <span className="text-sm text-[#8C8478] italic">
                      {type === 'email' ? t('detailPage.contactPendingClaim') : t('detailPage.contactNotSet')}
                    </span>
                  )}
                  {primary && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#6B7F5E]/15 text-[#6B7F5E]">{t('detailPage.contactPrimary')}</span>}
                </div>
                {others.length > 0 && (
                  <div className="pl-16 space-y-0.5">
                    {others.map(e => (
                      <div key={e.id} className="text-xs text-[#8C8478] flex items-center gap-2">
                        <span className="text-[#1A1208]">{e.value}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${e.source === 'self' ? 'bg-[#5B8C3E]/15 text-[#5B8C3E]' : 'bg-[#8C8478]/15 text-[#8C8478]'}`}>
                          {e.source === 'self' ? t('detailPage.sourceSelf') : t('detailPage.sourceAdmin')}
                        </span>
                        {e.recordedBy?.name && <span className="text-[10px]">{t('detailPage.recordedBy', { name: e.recordedBy.name })}</span>}
                        <span className="text-[10px]">{t('detailPage.recordedOn', { date: new Date(e.createdAt).toLocaleDateString() })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Quick cross-links — lets admin jump to this customer's inquiry
          thread without scrolling through the global list. */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/admin/inquiries?userId=${customerProfile.id}`)}
          className="text-xs px-3 py-1.5 rounded-full border border-[#E8ECE4] text-[#6B7F5E] hover:bg-[#6B7F5E]/5 font-medium"
        >
          {t('detail.viewInquiries')}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { value: String(customerProfile.totalVisits), label: t('detail.stats.totalVisits') },
          { value: `$${customerProfile.totalSpent.toLocaleString()}`, label: t('detail.stats.totalSpent') },
          { value: `${customerProfile.cancelRate}%`, label: t('detail.stats.cancelRate') },
          { value: String(customerProfile.cancelCount), label: t('detail.stats.noShows') },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E8ECE4] p-3">
            <div className="text-lg font-bold text-[#1A1208]">{s.value}</div>
            <div className="text-[10px] text-[#8C8478] uppercase">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Admin notes */}
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-4">
        <span className="text-xs font-bold text-[#1A1208] uppercase">{t('detail.adminNotes')}</span>
        <textarea
          className="w-full border border-[#E8ECE4] rounded-lg p-2 text-sm h-20 resize-none mt-2 text-[#1A1208] placeholder:text-[#8C8478] focus:outline-none focus:border-[#6B7F5E] transition-colors"
          value={noteText ?? noteData?.note ?? ''}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Add notes about this customer..."
        />
        <button
          onClick={handleSaveNote}
          disabled={noteSaving}
          className={`flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg mt-2 transition-colors ${noteSaving ? 'bg-[#6B7F5E]/60 cursor-not-allowed' : 'bg-[#6B7F5E] hover:bg-[#5A6E4F]'}`}
        >
          <Save size={12} /> {noteSaved ? 'Saved!' : noteSaving ? 'Saving...' : t('detail.saveNote')}
        </button>
      </div>

      {/* Upcoming reservations */}
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[#1A1208] uppercase">{t('detailPage.upcoming')}</span>
          <span className="text-xs text-[#8C8478]">{upcoming.length} {t('detailPage.reservationCount').toLowerCase()}</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[#8C8478] py-2">{t('detailPage.noUpcoming')}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {upcoming.map(r => <ReservationRow key={r.id} reservation={r} />)}
          </div>
        )}
      </div>

      {/* History reservations */}
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full"
        >
          <span className="text-xs font-bold text-[#1A1208] uppercase">{t('detailPage.history')}</span>
          <div className="flex items-center gap-1.5 text-xs text-[#8C8478]">
            <span>
              {showHistory
                ? t('detailPage.hideHistory')
                : t('detailPage.showHistory', { count: history.length })}
            </span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>
        {showHistory && (
          <div className="mt-3">
            {history.length === 0 ? (
              <p className="text-sm text-[#8C8478] py-2">{t('detailPage.noHistory')}</p>
            ) : (
              <div className="flex flex-col gap-1">
                {history.map(r => <ReservationRow key={r.id} reservation={r} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // ── Desktop layout ─────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex-1 flex bg-[#F8F7F4] overflow-hidden">
        {content}

        {/* Side panel for reservation detail */}
        {selectedRes && (
          <div className="w-[400px] border-l border-[#E8ECE4] bg-white flex flex-col overflow-hidden shrink-0">
            <ReservationDetail
              reservation={(detailRes || selectedRes) as FullReservation}
              activityLogs={activityLogs || []}
              onClose={() => setSelectedRes(null)}
              onAction={{ confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation }}
              isUpdating={updating}
              onOrderChanged={handleOrderChanged}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Mobile layout ──────────────────────────────────────────────
  return (
    <>
      <AdminTopBar title={t('detailPage.title')} showBack backHref="/admin/customers" />
      <div className="flex-1 flex flex-col bg-[#F8F7F4] overflow-hidden">
        {content}
      </div>

      {/* Full-screen overlay for reservation detail on mobile */}
      {selectedRes && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <ReservationDetail
            reservation={(detailRes || selectedRes) as FullReservation}
            activityLogs={activityLogs || []}
            onClose={() => setSelectedRes(null)}
            onAction={{ confirmDeposit, cancelReservation, cancelAndRefund, markRefunded, completeReservation }}
            isUpdating={updating}
            onOrderChanged={handleOrderChanged}
          />
        </div>
      )}
    </>
  )
}
