'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Menu, X } from 'lucide-react'
import { setLocale } from '@/lib/locale-actions'

export default function Navbar() {
  const t = useTranslations('nav')
  const tLang = useTranslations('language')
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const user = session?.user
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  async function handleSetLocale(newLocale: 'en' | 'zh') {
    await setLocale(newLocale)
    router.refresh()
  }

  return (
    <nav className="glass-nav h-20 w-full flex items-center justify-between px-6 sm:px-12 lg:px-20 sticky top-0 z-50">
      <Link href="/" className="flex flex-col no-underline">
        <span className="font-playfair text-[22px] font-bold italic text-brown">Bobo&apos;s Farm</span>
        <span className="text-[10px] text-brown/40 tracking-[0.12em]">{'\u6CE2\u59D0\u519C\u5BB6\u4E50'}</span>
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-8">
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

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden border-none bg-transparent cursor-pointer p-1 text-brown"
        aria-label="Toggle navigation menu"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-20 bg-white z-40 flex flex-col p-6 gap-4">
          <Link href="/menu" onClick={() => setMobileOpen(false)} className="text-lg font-medium text-brown no-underline py-2 border-b border-beige">{t('menu')}</Link>
          <a href="/#about" onClick={() => setMobileOpen(false)} className="text-lg font-medium text-brown no-underline py-2 border-b border-beige">{t('about')}</a>
          <a href="/#gallery" onClick={() => setMobileOpen(false)} className="text-lg font-medium text-brown no-underline py-2 border-b border-beige">{t('gallery')}</a>
          <Link href="/booking/date" onClick={() => setMobileOpen(false)} className="no-underline px-6 py-3 rounded-xl bg-gradient-to-b from-[#A07818] to-amber text-white text-base font-semibold text-center mt-2">
            {t('bookNow')}
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => { handleSetLocale('en'); setMobileOpen(false) }}
              className={`text-sm font-semibold cursor-pointer bg-transparent border-0 p-0 ${locale === 'en' ? 'text-amber' : 'text-[#8E8E93]'}`}
            >
              {tLang('en')}
            </button>
            <span className="text-sm text-beige">|</span>
            <button
              onClick={() => { handleSetLocale('zh'); setMobileOpen(false) }}
              className={`text-sm font-semibold cursor-pointer bg-transparent border-0 p-0 ${locale === 'zh' ? 'text-amber' : 'text-[#8E8E93]'}`}
            >
              {tLang('zh')}
            </button>
          </div>
          {user ? (
            <Link href="/settings" onClick={() => setMobileOpen(false)} className="text-lg font-medium text-brown no-underline py-2">
              Settings
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)} className="text-lg font-medium text-brown no-underline py-2">{t('login')}</Link>
          )}
        </div>
      )}
    </nav>
  )
}
