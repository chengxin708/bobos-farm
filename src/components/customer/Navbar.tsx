'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { setLocale } from '@/lib/locale-actions'

export default function Navbar() {
  const t = useTranslations('nav')
  const tLang = useTranslations('language')
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()

  const user = session?.user
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  async function handleSetLocale(newLocale: 'en' | 'zh') {
    await setLocale(newLocale)
    router.refresh()
  }

  return (
    <nav className="h-20 w-full flex items-center justify-between px-20 bg-white/93 sticky top-0 z-50">
      <Link href="/" className="flex flex-col no-underline">
        <span className="font-playfair text-2xl font-bold text-amber">Bobo&apos;s Farm</span>
        <span className="text-[11px] text-amber tracking-wide">波姐农家乐</span>
      </Link>
      <div className="flex items-center gap-8">
        <Link href="/menu" className="text-[15px] font-medium text-brown no-underline hover:text-amber transition-colors">{t('menu')}</Link>
        <a href="/#about" className="text-[15px] font-medium text-brown no-underline hover:text-amber transition-colors">{t('about')}</a>
        <a href="/#gallery" className="text-[15px] font-medium text-brown no-underline hover:text-amber transition-colors">{t('gallery')}</a>
        <Link href="/booking/date" className="no-underline px-6 py-2.5 rounded-xl bg-gradient-to-b from-[#A07818] to-amber text-white text-sm font-semibold">
          {t('bookNow')}
        </Link>
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
        {user ? (
          <Link href="/settings" className="w-9 h-9 bg-amber-light rounded-full flex items-center justify-center no-underline">
            <span className="text-amber text-sm font-bold">{initials}</span>
          </Link>
        ) : (
          <Link href="/login" className="text-[15px] font-medium text-brown no-underline hover:text-amber transition-colors">{t('login')}</Link>
        )}
      </div>
    </nav>
  )
}
