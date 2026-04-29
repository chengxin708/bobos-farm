'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Users, UtensilsCrossed, Tent, BarChart3, Settings, ChevronRight } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'

const links = [
  { href: '/admin/customers', icon: Users, labelKey: 'customers' as const, descKey: 'customersDesc' as const },
  { href: '/admin/menu', icon: UtensilsCrossed, labelKey: 'menu' as const, descKey: 'menuDesc' as const },
  { href: '/admin/venues', icon: Tent, labelKey: 'venues' as const, descKey: 'venuesDesc' as const },
  { href: '/admin/reports', icon: BarChart3, labelKey: 'reports' as const, descKey: 'reportsDesc' as const },
  { href: '/admin/settings', icon: Settings, labelKey: 'settings' as const, descKey: 'settingsDesc' as const },
]

export default function MorePage() {
  const t = useTranslations('admin.more')

  return (
    <>
      <AdminTopBar title={t('title')} />
      <div className="p-4 flex flex-col gap-2">
        {links.map(({ href, icon: Icon, labelKey, descKey }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 p-4 bg-white rounded-xl no-underline transition-colors hover:bg-[#F2EDE6]"
          >
            <div className="w-10 h-10 rounded-full bg-[#E8ECE4] flex items-center justify-center shrink-0">
              <Icon size={20} className="text-[#6B7F5E]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1A1208]">{t(labelKey)}</div>
              <div className="text-xs text-[#8C8478]">{t(descKey)}</div>
            </div>
            <ChevronRight size={18} className="text-[#8C8478] shrink-0" />
          </Link>
        ))}
      </div>
    </>
  )
}
