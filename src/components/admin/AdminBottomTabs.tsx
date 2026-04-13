'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, CalendarCheck, Calendar, MoreHorizontal } from 'lucide-react'

const tabs = [
  { key: 'home' as const, href: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'bookings' as const, href: '/admin/reservations', icon: CalendarCheck },
  { key: 'calendar' as const, href: '/admin/calendar', icon: Calendar },
  { key: 'more' as const, href: '/admin/more', icon: MoreHorizontal },
]

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard' || pathname === '/admin'
  return pathname.startsWith(href)
}

export default function AdminBottomTabs() {
  const pathname = usePathname()
  const t = useTranslations('admin.nav')

  return (
    <nav
      className="h-16 bg-[#F8F7F4] border-t border-[#E8ECE4] safe-area-bottom md:hidden"
      aria-label="Admin bottom navigation"
    >
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-2">
        {tabs.map(({ key, href, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full no-underline transition-colors ${
                active ? 'text-[#6B7F5E]' : 'text-[#8C8478]'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[11px] leading-tight">{t(key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
