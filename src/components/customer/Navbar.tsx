'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { setLocale } from '@/lib/locale-actions'

export default function Navbar() {
  const t = useTranslations('nav')
  const tLang = useTranslations('language')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)

  const user = session?.user
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  async function handleSetLocale(newLocale: 'en' | 'zh') {
    await setLocale(newLocale)
    router.refresh()
  }

  function isActiveLink(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const bgClass = scrolled
    ? 'bg-[#F8F7F4]/95 backdrop-blur-md shadow-sm'
    : 'bg-transparent'

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${bgClass}`}
    >
      {/* ── Mobile top bar (below md) ── */}
      <div className="flex md:hidden items-center justify-between h-14 px-4">
        {/* Spacer for symmetry */}
        <div className="w-16" />

        {/* Centered logo */}
        <Link href="/" className="no-underline">
          <span className="font-serif text-lg font-bold text-off-black">
            Bobo&apos;s Farm
          </span>
        </Link>

        {/* Language toggle */}
        <div className="flex items-center gap-1 w-16 justify-end">
          <button
            onClick={() => handleSetLocale('en')}
            className={`text-[11px] font-semibold cursor-pointer border-0 px-2 py-0.5 rounded-full transition-colors ${
              locale === 'en'
                ? 'bg-[#6B7F5E] text-white'
                : 'bg-transparent text-[#8C8478]'
            }`}
            aria-label={tLang('switchTo')}
          >
            {tLang('en')}
          </button>
          <button
            onClick={() => handleSetLocale('zh')}
            className={`text-[11px] font-semibold cursor-pointer border-0 px-2 py-0.5 rounded-full transition-colors ${
              locale === 'zh'
                ? 'bg-[#6B7F5E] text-white'
                : 'bg-transparent text-[#8C8478]'
            }`}
            aria-label={tLang('switchTo')}
          >
            {tLang('zh')}
          </button>
        </div>
      </div>

      {/* ── Desktop top bar (md and above) ── */}
      <div className="hidden md:flex items-center justify-between h-16 px-8 lg:px-16">
        {/* Logo */}
        <Link href="/" className="no-underline shrink-0">
          <span className="font-serif text-xl font-bold text-off-black">
            Bobo&apos;s Farm
          </span>
        </Link>

        {/* Centered nav links */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className={`text-sm font-medium no-underline transition-colors hover:text-[#6B7F5E] ${
              isActiveLink('/') ? 'text-[#6B7F5E]' : 'text-off-black'
            }`}
          >
            {t('home')}
          </Link>
          <Link
            href="/menu"
            className={`text-sm font-medium no-underline transition-colors hover:text-[#6B7F5E] ${
              isActiveLink('/menu') ? 'text-[#6B7F5E]' : 'text-off-black'
            }`}
          >
            {t('menu')}
          </Link>
          <Link
            href="/booking/date"
            className="no-underline px-5 py-2 rounded-full bg-[#6B7F5E] text-white text-sm font-medium transition-all hover:bg-[#5A6E4F] active:scale-[0.97]"
          >
            {t('bookVisit')}
          </Link>
        </div>

        {/* Right side: language toggle + auth */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Language toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSetLocale('en')}
              className={`text-xs font-semibold cursor-pointer border-0 px-2.5 py-1 rounded-full transition-colors ${
                locale === 'en'
                  ? 'bg-[#6B7F5E] text-white'
                  : 'bg-transparent text-[#8C8478]'
              }`}
              aria-label={tLang('switchTo')}
            >
              {tLang('en')}
            </button>
            <button
              onClick={() => handleSetLocale('zh')}
              className={`text-xs font-semibold cursor-pointer border-0 px-2.5 py-1 rounded-full transition-colors ${
                locale === 'zh'
                  ? 'bg-[#6B7F5E] text-white'
                  : 'bg-transparent text-[#8C8478]'
              }`}
              aria-label={tLang('switchTo')}
            >
              {tLang('zh')}
            </button>
          </div>

          {/* Auth: avatar or login link */}
          {user ? (
            <Link
              href="/settings"
              className="w-9 h-9 bg-[#6B7F5E] rounded-full flex items-center justify-center no-underline transition-opacity hover:opacity-90"
            >
              <span className="text-white text-sm font-bold">{initials}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium text-off-black no-underline transition-colors hover:text-[#6B7F5E]"
            >
              {t('login')}
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
