'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ChevronLeft } from 'lucide-react'
import { setLocale } from '@/lib/locale-actions'
import NotificationBell from './NotificationBell'

interface AdminTopBarProps {
  title: string
  showBack?: boolean
  backHref?: string
}

export default function AdminTopBar({ title, showBack, backHref }: AdminTopBarProps) {
  const router = useRouter()
  const locale = useLocale()

  async function toggleLocale() {
    const newLocale = locale === 'en' ? 'zh' : 'en'
    await setLocale(newLocale)
    router.refresh()
  }

  return (
    <header className="h-11 bg-[#F8F7F4] flex items-center justify-between px-4 shrink-0 md:hidden">
      {/* Left: back button or spacer */}
      <div className="w-9">
        {showBack && (
          <button
            onClick={() => backHref ? router.push(backHref) : router.back()}
            className="flex items-center justify-center w-9 h-9 -ml-2 rounded-full bg-transparent border-0 cursor-pointer"
          >
            <ChevronLeft size={22} className="text-[#1A1208]" />
          </button>
        )}
      </div>

      {/* Center: title */}
      <h1 className="text-base font-semibold text-[#1A1208] font-serif truncate">
        {title}
      </h1>

      {/* Right: language toggle + notification bell */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLocale}
          className="text-xs font-semibold text-[#6B7F5E] px-2 py-1 rounded-full border border-[#E8ECE4] bg-transparent cursor-pointer"
        >
          {locale === 'en' ? '中文' : 'EN'}
        </button>
        <NotificationBell />
      </div>
    </header>
  )
}
