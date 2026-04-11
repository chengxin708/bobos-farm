'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarCheck, UtensilsCrossed, Calendar, MoreHorizontal } from 'lucide-react'

const tabs = [
  { key: 'home', href: '/admin/dashboard', icon: LayoutDashboard, label: '首页' },
  { key: 'bookings', href: '/admin/reservations', icon: CalendarCheck, label: '预订' },
  { key: 'menu', href: '/admin/menu', icon: UtensilsCrossed, label: '菜单' },
  { key: 'calendar', href: '/admin/calendar', icon: Calendar, label: '日历' },
  { key: 'more', href: '/admin/more', icon: MoreHorizontal, label: '更多' },
]

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin/dashboard') return pathname === '/admin/dashboard' || pathname === '/admin'
  return pathname.startsWith(href)
}

export default function AdminBottomTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="h-16 bg-[#F8F7F4] border-t border-[#E8ECE4] safe-area-bottom md:hidden"
      aria-label="Admin bottom navigation"
    >
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-2">
        {tabs.map(({ key, href, icon: Icon, label }) => {
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
              <span className="text-[11px] leading-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
