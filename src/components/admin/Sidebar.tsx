'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard, Calendar, ClipboardList, Banknote, Utensils,
  Tent, CalendarCheck, Users, Settings, BarChart3,
} from 'lucide-react'

export default function Sidebar() {
  const t = useTranslations('admin.sidebar')
  const pathname = usePathname()

  const navItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { href: '/admin/calendar', icon: Calendar, label: t('calendar') },
    { href: '/admin/reservations', icon: ClipboardList, label: t('reservations') },
    { href: '/admin/deposits', icon: Banknote, label: t('deposits') },
    { href: '/admin/menu', icon: Utensils, label: t('menu') },
    { href: '/admin/yurts', icon: Tent, label: t('yurts') },
    { href: '/admin/availability', icon: CalendarCheck, label: t('availability') },
    { href: '/admin/customers', icon: Users, label: t('customers') },
    { href: '/admin/settings', icon: Settings, label: t('settings') },
    { href: '/admin/reports', icon: BarChart3, label: t('reports') },
  ]

  return (
    <aside className="w-60 bg-sidebar-bg flex flex-col shrink-0 min-h-screen">
      <div className="p-5 flex flex-col gap-2">
        <span className="font-playfair text-lg font-bold text-amber">{t('brandName')}</span>
        <span className="bg-cream-bg text-dark-brown text-xs font-semibold px-3 py-1 rounded-full self-start">{t('adminPanel')}</span>
      </div>
      <nav className="flex flex-col gap-0.5 px-0 py-4">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-2 mx-0 rounded-md text-sm font-medium transition-colors no-underline ${
                isActive ? 'bg-nav-active-bg text-white border-l-[3px] border-amber' : 'text-muted-beige hover:bg-nav-hover-bg'
              }`}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="flex-1" />
    </aside>
  )
}
