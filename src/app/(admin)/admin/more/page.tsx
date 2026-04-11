'use client'

import Link from 'next/link'
import { Tent, Users, BarChart3, Settings, ChevronRight } from 'lucide-react'
import AdminTopBar from '@/components/admin/AdminTopBar'

const links = [
  { href: '/admin/venues', icon: Tent, label: '场地管理', desc: '蒙古包 + 可用性' },
  { href: '/admin/customers', icon: Users, label: '客户管理', desc: '客户列表与详情' },
  { href: '/admin/reports', icon: BarChart3, label: '数据报表', desc: '营收与预订统计' },
  { href: '/admin/settings', icon: Settings, label: '系统设置', desc: '全局配置' },
]

export default function MorePage() {
  return (
    <>
      <AdminTopBar title="更多" />
      <div className="p-4 flex flex-col gap-2">
        {links.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 p-4 bg-white rounded-xl no-underline transition-colors hover:bg-[#F2EDE6]"
          >
            <div className="w-10 h-10 rounded-full bg-[#E8ECE4] flex items-center justify-center shrink-0">
              <Icon size={20} className="text-[#6B7F5E]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1A1208]">{label}</div>
              <div className="text-xs text-[#8C8478]">{desc}</div>
            </div>
            <ChevronRight size={18} className="text-[#8C8478] shrink-0" />
          </Link>
        ))}
      </div>
    </>
  )
}
