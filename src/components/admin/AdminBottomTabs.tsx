'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { LayoutDashboard, CalendarCheck, Calendar, MessageCircle, MoreHorizontal } from 'lucide-react'

const tabs = [
  { key: 'home' as const, href: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'bookings' as const, href: '/admin/reservations', icon: CalendarCheck },
  { key: 'calendar' as const, href: '/admin/calendar', icon: Calendar },
  { key: 'inquiries' as const, href: '/admin/inquiries', icon: MessageCircle },
  { key: 'more' as const, href: '/admin/more', icon: MoreHorizontal },
]

interface InquirySummary { id: string; status: string }
const PENDING_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'AWAITING_CUSTOMER'])
const tabsFetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : [])

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard' || pathname === '/admin'
  return pathname.startsWith(href)
}

export default function AdminBottomTabs() {
  const pathname = usePathname()
  const t = useTranslations('admin.nav')

  // Pending inquiry count for the badge on the Inquiries tab.
  // Same SWR key as AdminNavbar so the two share a single dedupe'd fetch.
  const { data: inquiries } = useSWR<InquirySummary[]>(
    '/api/inquiries',
    tabsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, refreshInterval: 60000 },
  )
  const pendingInquiryCount = Array.isArray(inquiries)
    ? inquiries.filter((i) => PENDING_STATUSES.has(i.status)).length
    : 0

  return (
    <nav
      className="h-16 bg-[#F8F7F4] border-t border-[#E8ECE4] safe-area-bottom md:hidden"
      aria-label="Admin bottom navigation"
    >
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-2">
        {tabs.map(({ key, href, icon: Icon }) => {
          const active = isActive(href, pathname)
          const showBadge = key === 'inquiries' && pendingInquiryCount > 0
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full no-underline transition-colors ${
                active ? 'text-[#6B7F5E]' : 'text-[#8C8478]'
              }`}
            >
              <span className="relative inline-flex">
                <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-[#DC3545] text-white text-[10px] font-bold px-1 leading-none">
                    {pendingInquiryCount > 9 ? '9+' : pendingInquiryCount}
                  </span>
                )}
              </span>
              <span className="text-[11px] leading-tight">{t(key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
