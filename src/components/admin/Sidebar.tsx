'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  CreditCard,
  UtensilsCrossed,
  Tent,
  CalendarCheck,
  Users,
  Settings,
  BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

/* ------------------------------------------------------------------ */
/*  Navigation structure                                               */
/* ------------------------------------------------------------------ */

const navGroups: NavGroup[] = [
  {
    title: '概览',
    items: [
      { href: '/admin/dashboard', icon: LayoutDashboard, label: '仪表盘' },
    ],
  },
  {
    title: '预订管理',
    items: [
      { href: '/admin/calendar', icon: Calendar, label: '日历' },
      { href: '/admin/reservations', icon: BookOpen, label: '预订管理' },
      { href: '/admin/deposits', icon: CreditCard, label: '定金管理' },
    ],
  },
  {
    title: '运营管理',
    items: [
      { href: '/admin/menu', icon: UtensilsCrossed, label: '菜单管理' },
      { href: '/admin/yurts', icon: Tent, label: '营地管理' },
      { href: '/admin/availability', icon: CalendarCheck, label: '可用性管理' },
      { href: '/admin/customers', icon: Users, label: '客户管理' },
    ],
  },
  {
    title: '系统',
    items: [
      { href: '/admin/settings', icon: Settings, label: '系统设置' },
      { href: '/admin/reports', icon: BarChart3, label: '数据报告' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const userName = session?.user?.name ?? '管理员'
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <aside
      className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, #1B2021 0%, #252D2F 100%)',
      }}
    >
      {/* ---- Logo area ---- */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-playfair text-lg font-bold italic text-[#C8A55A]">
          Bobo&apos;s Farm
        </h1>
        <p className="mt-1 text-[11px] tracking-wide text-[#9AACB0]">
          管理后台
        </p>
        <div className="mt-3 h-px w-10 bg-[#C8A55A]/30" />
      </div>

      {/* ---- Navigation groups ---- */}
      <nav className="flex-1 px-2 py-2">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className={groupIdx > 0 ? 'mt-4' : ''}>
            {/* Section divider line (except first group) */}
            {groupIdx > 0 && (
              <div className="mx-3 mb-3 h-px bg-[#2A3538]" />
            )}

            {/* Section label */}
            <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-widest text-[#4E5C5F]">
              {group.title}
            </p>

            {/* Nav items */}
            {group.items.map(({ href, icon: Icon, label }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + '/')

              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'group relative my-0.5 flex items-center gap-3 rounded-md px-5 py-3 text-[13px] font-medium no-underline transition-all duration-200',
                    isActive
                      ? 'bg-[#2A3538] text-white'
                      : 'text-[#8A9A9D] hover:bg-[#2A3538] hover:text-white',
                  ].join(' ')}
                >
                  {/* Active left border accent */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-[#C8A55A]" />
                  )}

                  <Icon
                    size={18}
                    className={
                      isActive
                        ? 'text-[#C8A55A]'
                        : 'text-[#8A9A9D] transition-colors duration-200 group-hover:text-white'
                    }
                  />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ---- Bottom user card ---- */}
      <div className="border-t border-[#2A3538] px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Avatar with initials */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2A3538] text-[11px] font-bold text-[#C8A55A]">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[#C5CDD0]">
              {userName}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-[#5E6B6E]">在线</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
