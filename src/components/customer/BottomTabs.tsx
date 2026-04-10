'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Home, UtensilsCrossed, CalendarDays, User } from 'lucide-react'

const tabs = [
  { key: 'home' as const, href: '/', icon: Home },
  { key: 'menu' as const, href: '/menu', icon: UtensilsCrossed },
  { key: 'book' as const, href: '/booking/date', icon: CalendarDays },
  { key: 'my' as const, href: '/reservations', icon: User },
]

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export default function BottomTabs() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  // Hide on booking flow routes
  if (pathname.startsWith('/booking/')) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden h-16 bg-[#F8F7F4] border-t border-[#E8ECE4] safe-area-bottom"
      aria-label="Bottom navigation"
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
