'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { setLocale } from '@/lib/locale-actions'
import { ChevronDown, Check, User, Settings, LogOut } from 'lucide-react'

export default function Navbar() {
  const t = useTranslations('nav')
  const tLang = useTranslations('language')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const langMobileRef = useRef<HTMLDivElement>(null)
  const langDesktopRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  const user = session?.user
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  useEffect(() => {
    const scrollEl = document.getElementById('main-scroll')
    if (!scrollEl) return
    function handleScroll() {
      setScrolled(scrollEl!.scrollTop > 10)
    }
    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [])

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (!langMobileRef.current?.contains(target) && !langDesktopRef.current?.contains(target)) {
        setLangOpen(false)
      }
      if (!avatarRef.current?.contains(target)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
      className={`w-full transition-all duration-300 ${bgClass}`}
    >
      {/* ── Mobile top bar (below md) ── */}
      <div className="flex md:hidden items-center justify-between h-14 px-4">
        {/* Spacer for symmetry */}
        <div className="w-16" />

        {/* Centered logo */}
        <Link href="/" className="no-underline flex flex-col items-center leading-none">
          <span className="font-[family-name:var(--font-logo)] text-lg font-semibold text-off-black tracking-[0.01em]">
            Bobo&apos;s Farm
          </span>
          <span className="font-serif text-[10px] text-off-black/50 tracking-[0.05em]">
            波姐农家乐
          </span>
        </Link>

        {/* Language dropdown */}
        <div className="relative w-16 flex justify-end" ref={langMobileRef}>
          <button
            onClick={() => setLangOpen(prev => !prev)}
            className="text-sm text-[#1A1208] flex items-center gap-1 cursor-pointer border-0 bg-transparent"
            aria-label={tLang('switchTo')}
          >
            {locale === 'en' ? 'EN' : '中文'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <div className="absolute right-0 mt-8 bg-white rounded-xl shadow-lg border border-[#E8ECE4] py-1 min-w-[140px] z-50">
              <button
                onClick={() => { handleSetLocale('en'); setLangOpen(false) }}
                className={`w-full px-4 py-2 text-sm hover:bg-[#E8ECE4] transition-colors cursor-pointer flex items-center justify-between border-0 bg-transparent ${
                  locale === 'en' ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208]'
                }`}
              >
                English
                {locale === 'en' && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { handleSetLocale('zh'); setLangOpen(false) }}
                className={`w-full px-4 py-2 text-sm hover:bg-[#E8ECE4] transition-colors cursor-pointer flex items-center justify-between border-0 bg-transparent ${
                  locale === 'zh' ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208]'
                }`}
              >
                中文
                {locale === 'zh' && <Check className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop top bar (md and above) ── */}
      <div className="hidden md:flex items-center justify-between h-16 px-8 lg:px-16">
        {/* Logo */}
        <Link href="/" className="no-underline shrink-0 flex flex-col leading-none">
          <span className="font-[family-name:var(--font-logo)] text-xl font-semibold text-off-black tracking-[0.01em]">
            Bobo&apos;s Farm
          </span>
          <span className="font-serif text-xs text-off-black/50 tracking-[0.05em]">
            波姐农家乐
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
          {/* Language dropdown */}
          <div className="relative" ref={langDesktopRef}>
            <button
              onClick={() => setLangOpen(prev => !prev)}
              className="text-sm text-[#1A1208] flex items-center gap-1 cursor-pointer border-0 bg-transparent"
              aria-label={tLang('switchTo')}
            >
              {locale === 'en' ? 'EN' : '中文'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-[#E8ECE4] py-1 min-w-[140px] z-50">
                <button
                  onClick={() => { handleSetLocale('en'); setLangOpen(false) }}
                  className={`w-full px-4 py-2 text-sm hover:bg-[#E8ECE4] transition-colors cursor-pointer flex items-center justify-between border-0 bg-transparent ${
                    locale === 'en' ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208]'
                  }`}
                >
                  English
                  {locale === 'en' && <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { handleSetLocale('zh'); setLangOpen(false) }}
                  className={`w-full px-4 py-2 text-sm hover:bg-[#E8ECE4] transition-colors cursor-pointer flex items-center justify-between border-0 bg-transparent ${
                    locale === 'zh' ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208]'
                  }`}
                >
                  中文
                  {locale === 'zh' && <Check className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Auth: avatar dropdown or login link */}
          {user ? (
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(prev => !prev)}
                className="w-9 h-9 bg-[#6B7F5E] rounded-full flex items-center justify-center cursor-pointer border-none transition-opacity hover:opacity-90"
              >
                <span className="text-white text-sm font-bold">{initials}</span>
              </button>
              {avatarOpen && (
                <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-[#E8ECE4] py-1 min-w-[180px] z-50">
                  <div className="px-4 py-2.5 border-b border-[#E8ECE4]">
                    <p className="text-sm font-medium text-[#1A1208] truncate">{user.name || user.email}</p>
                    <p className="text-xs text-[#8C8478] truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/reservations"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#1A1208] no-underline hover:bg-[#E8ECE4] transition-colors"
                  >
                    <User size={16} className="text-[#8C8478]" />
                    {t('my')}
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#1A1208] no-underline hover:bg-[#E8ECE4] transition-colors"
                  >
                    <Settings size={16} className="text-[#8C8478]" />
                    Settings
                  </Link>
                  <div className="border-t border-[#E8ECE4] mt-1 pt-1">
                    <button
                      onClick={async () => {
                        setAvatarOpen(false)
                        const { signOut } = await import('next-auth/react')
                        await signOut({ redirect: false })
                        window.location.href = '/'
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#C4453A] bg-transparent border-none cursor-pointer hover:bg-[#C4453A]/5 transition-colors"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
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
