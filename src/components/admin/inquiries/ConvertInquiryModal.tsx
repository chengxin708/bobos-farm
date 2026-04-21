'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { X, Loader2 } from 'lucide-react'

interface Yurt {
  id: string
  name: string
  alias?: string | null
  capacity: number
  status: string
}

interface ConvertInquiryModalProps {
  inquiryId: string
  defaultDate: string
  defaultGuestCount: number
  onCancel: () => void
  onConverted: (reservationId: string) => void
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('fetch failed')
  return r.json()
})

export default function ConvertInquiryModal({
  inquiryId,
  defaultDate,
  defaultGuestCount,
  onCancel,
  onConverted,
}: ConvertInquiryModalProps) {
  const t = useTranslations('adminInquiries.convertModal')
  const [date, setDate] = useState(defaultDate.slice(0, 10))
  const [guestCount, setGuestCount] = useState(defaultGuestCount)
  const [yurtIds, setYurtIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { data: yurts } = useSWR<Yurt[]>('/api/yurts', fetcher)
  const activeYurts = (yurts || []).filter((y) => y.status === 'ACTIVE')

  // Occupied-on-date check refetches when date changes, matching the
  // admin create-reservation modal behavior.
  interface DateReservation { id: string; yurtId: string | null; status: string }
  const { data: dateReservations } = useSWR<DateReservation[]>(
    date ? `/api/reservations?date=${date}` : null,
    (url: string) => fetch(url).then((r) => r.json()).then((d) => d.reservations ?? d),
    { revalidateOnFocus: false },
  )
  const occupied = new Set(
    (dateReservations || [])
      .filter((r) => r.yurtId && !['CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED'].includes(r.status))
      .map((r) => r.yurtId),
  )

  const combinedCapacity = activeYurts
    .filter((y) => yurtIds.includes(y.id))
    .reduce((s, y) => s + y.capacity, 0)
  const capacityExceeded = yurtIds.length > 0 && guestCount > combinedCapacity

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onCancel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (yurtIds.length === 0) {
      setError(t('selectAtLeastOne'))
      return
    }
    if (capacityExceeded) {
      setError(t('capacityExceeded', { guests: guestCount, capacity: combinedCapacity }))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yurtIds, guestCount, date }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || t('failed'))
        setSubmitting(false)
        return
      }
      const body = await res.json()
      onConverted(body.reservation.id)
    } catch {
      setError(t('networkError'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif font-semibold text-[#2C2416]">{t('title')}</h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-[#F2EDE6]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
            {t('date')}
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#E8ECE4] focus:outline-none focus:border-[#6B7F5E]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
            {t('guestCount')}
            <input
              type="number"
              required
              min={1}
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
              className="h-10 px-3 rounded-lg border border-[#E8ECE4] focus:outline-none focus:border-[#6B7F5E]"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-[#2C2416]">{t('selectYurts')}</span>
            <div className={`flex flex-col gap-1 pl-2 border-l-2 transition-colors ${
              error === t('selectAtLeastOne') ? 'border-[#DC3545]' : 'border-[#E8E2D9]'
            }`}>
              {activeYurts.map((y) => {
                const isOccupied = occupied.has(y.id)
                return (
                  <label
                    key={y.id}
                    className={`flex items-center gap-2 text-sm py-0.5 ${
                      isOccupied ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={yurtIds.includes(y.id)}
                      disabled={isOccupied}
                      onChange={(e) =>
                        setYurtIds((prev) =>
                          e.target.checked ? [...prev, y.id] : prev.filter((id) => id !== y.id),
                        )
                      }
                    />
                    <span className="flex-1">
                      {y.name}{y.alias ? ` (${y.alias})` : ''} · {y.capacity}{t('capacityUnit')}
                      {isOccupied && <span className="ml-2 text-[11px] text-[#DC3545]">{t('occupied')}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
            {yurtIds.length > 0 && (
              <p className="text-xs text-[#6B7F5E] font-medium">
                {t('depositPreview', { count: yurtIds.length, total: yurtIds.length * 300 })}
              </p>
            )}
            {capacityExceeded && (
              <p className="text-xs text-[#DC3545]">{t('capacityExceeded', { guests: guestCount, capacity: combinedCapacity })}</p>
            )}
          </div>

          {error && <div className="bg-[#DC3545]/10 text-[#DC3545] rounded-lg p-2.5 text-sm">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-full text-[#2C2416] hover:bg-[#F2EDE6]">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold rounded-full bg-[#6B7F5E] text-white hover:bg-[#5A6E4E] disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {t('convert')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
