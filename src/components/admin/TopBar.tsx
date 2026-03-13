'use client'

import { Bell, ChevronDown } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/lib/locale-actions'

interface TopBarProps {
  title: string
}

export default function TopBar({ title }: TopBarProps) {
  const tLang = useTranslations('language')
  const locale = useLocale()
  const router = useRouter()

  async function handleSetLocale(newLocale: 'en' | 'zh') {
    await setLocale(newLocale)
    router.refresh()
  }

  return (
    <header className="h-16 bg-white flex items-center justify-between px-6 border-b border-topbar-border shrink-0">
      <h1 className="text-lg font-bold text-dark-brown font-lato">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 border border-beige rounded-lg px-3 py-1.5">
          <button
            onClick={() => handleSetLocale('en')}
            className={`text-xs font-semibold cursor-pointer bg-transparent border-0 p-0 ${locale === 'en' ? 'text-amber' : 'text-[#8E8E93]'}`}
            aria-label={tLang('switchTo')}
          >
            {tLang('en')}
          </button>
          <span className="text-xs text-beige">|</span>
          <button
            onClick={() => handleSetLocale('zh')}
            className={`text-xs font-semibold cursor-pointer bg-transparent border-0 p-0 ${locale === 'zh' ? 'text-amber' : 'text-[#8E8E93]'}`}
            aria-label={tLang('switchTo')}
          >
            {tLang('zh')}
          </button>
        </div>
        <div className="relative w-10 h-10 flex items-center justify-center cursor-pointer">
          <Bell size={20} className="text-dark-brown" />
          <span className="absolute top-1 right-1.5 w-[18px] h-[18px] bg-red-badge rounded-full text-white text-[10px] font-bold flex items-center justify-center">3</span>
        </div>
        <div className="w-8 h-8 bg-amber rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-semibold">J</span>
        </div>
        <ChevronDown size={16} className="text-dark-brown" />
      </div>
    </header>
  )
}
