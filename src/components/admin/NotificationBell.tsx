'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, CreditCard, Calendar, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'

interface PendingReservation {
  id: string
  date: string
  guestCount: number
  depositAmount: number
  createdAt: string
  user: { name: string | null; email: string }
  yurt: { name: string }
}

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : [])

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const mins = Math.floor((now - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
  const router = useRouter()
  const t = useTranslations('admin.common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: pending } = useSWR<PendingReservation[]>(
    '/api/reservations?status=PAYMENT_SUBMITTED',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, refreshInterval: 60000 }
  )
  const items = Array.isArray(pending) ? pending : []
  const count = items.length

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-transparent border-0 cursor-pointer transition-colors hover:bg-[#E8ECE4]"
      >
        <Bell size={20} className="text-[#1A1208]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#DC3545] text-white text-[10px] font-bold px-1">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-[#E8ECE4] z-50 w-[340px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8ECE4]">
            <span className="text-sm font-semibold text-[#1A1208]">
              {t('notifications')}
            </span>
            {count > 0 && (
              <span className="text-xs font-medium text-[#DC3545] bg-[#DC3545]/10 px-2 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </div>

          {/* Items */}
          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Bell size={24} className="text-[#8C8478]" />
                <span className="text-sm text-[#8C8478]">{t('noNotifications')}</span>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false)
                    router.push('/admin/reservations')
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left bg-transparent border-0 cursor-pointer transition-colors hover:bg-[#F8F7F4] border-b border-[#E8ECE4] last:border-b-0"
                >
                  <div className="w-8 h-8 rounded-full bg-[#E67E22]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <CreditCard size={14} className="text-[#E67E22]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1208] truncate">
                      {item.user.name || item.user.email}
                    </p>
                    <p className="text-xs text-[#8C8478] mt-0.5">
                      ${item.depositAmount} · {item.yurt.name} · {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-[#8C8478] mt-1">
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-[#8C8478] shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <button
              onClick={() => {
                setOpen(false)
                router.push('/admin/reservations')
              }}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[#6B7F5E] bg-[#F8F7F4] border-0 border-t border-[#E8ECE4] cursor-pointer hover:bg-[#E8ECE4] transition-colors"
            >
              <Calendar size={12} />
              {t('viewAll')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
