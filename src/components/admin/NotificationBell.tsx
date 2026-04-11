'use client'

import { Bell } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : [])

export default function NotificationBell() {
  const { data: pending } = useSWR('/api/reservations?status=PAYMENT_SUBMITTED', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
  const count = Array.isArray(pending) ? pending.length : 0

  return (
    <button className="relative flex items-center justify-center w-9 h-9 rounded-full bg-transparent border-0 cursor-pointer transition-colors hover:bg-[#E8ECE4]">
      <Bell size={20} className="text-[#1A1208]" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#DC3545] text-white text-[10px] font-bold px-1">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
