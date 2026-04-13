'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSession, signOut } from 'next-auth/react'
import { ChevronDown, Settings, LogOut } from 'lucide-react'
import { setLocale } from '@/lib/locale-actions'
import NotificationBell from './NotificationBell'

/* ── helpers ── */

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

/* ── dropdown hook ── */

function useHoverDropdown(delay = 150) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enter = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }, [])

  const leave = useCallback(() => {
    timer.current = setTimeout(() => setOpen(false), delay)
  }, [delay])

  // close on outside click (fallback)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return { open, ref, enter, leave, setOpen }
}

/* ── link style helper ── */

const linkBase = 'text-sm no-underline transition-colors whitespace-nowrap'

function linkClass(active: boolean) {
  return `${linkBase} ${active ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208] hover:text-[#6B7F5E]'}`
}

/* ── dropdown menu item ── */

function DropdownLink({
  href,
  children,
  active,
  onClick,
}: {
  href: string
  children: React.ReactNode
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-4 py-2.5 text-sm no-underline transition-colors hover:bg-[#E8ECE4] ${
        active ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208]'
      }`}
    >
      {children}
    </Link>
  )
}

/* ── main component ── */

export default function AdminNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const { data: session } = useSession()
  const t = useTranslations('admin.nav')

  const userName = session?.user?.name || ''
  const userEmail = session?.user?.email || ''
  const initials = getInitials(userName, userEmail)

  // Hover dropdowns for nav menus
  const reservations = useHoverDropdown()
  const operations = useHoverDropdown()

  // Click dropdown for avatar
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false)
      }
    }
    if (avatarOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [avatarOpen])

  // Locale switcher
  async function handleSetLocale(newLocale: 'en' | 'zh') {
    if (newLocale === locale) return
    await setLocale(newLocale)
    router.refresh()
  }

  // Active-link helpers
  function isActive(href: string) {
    return pathname === href
  }
  const reservationsActive = pathname.startsWith('/admin/reservations')
  const operationsActive =
    pathname.startsWith('/admin/venues') ||
    pathname.startsWith('/admin/customers') ||
    pathname.startsWith('/admin/reports')

  return (
    <nav className="hidden md:flex items-center h-16 bg-white border-b-2 border-[#6B7F5E] px-6 lg:px-10 shrink-0">
      {/* ── Logo ── */}
      <Link href="/admin/dashboard" className="no-underline shrink-0 flex items-baseline gap-2 mr-8">
        <span className="font-[family-name:var(--font-logo)] text-xl font-semibold text-[#1A1208] tracking-[0.01em]">
          Bobo&apos;s Farm
        </span>
        <span className="text-xs text-[#6B7F5E] font-medium">{t('admin')}</span>
      </Link>

      {/* ── Nav links ── */}
      <div className="flex items-center gap-6 flex-1">
        {/* 首页 */}
        <Link href="/admin/dashboard" className={linkClass(isActive('/admin/dashboard'))}>
          {t('home')}
        </Link>

        {/* 预订管理 */}
        <Link href="/admin/reservations" className={linkClass(reservationsActive)}>
          {t('bookingsMenu')}
        </Link>

        {/* 日历 */}
        <Link href="/admin/calendar" className={linkClass(isActive('/admin/calendar'))}>
          {t('calendar')}
        </Link>

        {/* 运营 dropdown */}
        <div
          ref={operations.ref}
          className="relative"
          onMouseEnter={operations.enter}
          onMouseLeave={operations.leave}
        >
          <button
            className={`${linkBase} flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 ${
              operationsActive ? 'text-[#6B7F5E] font-medium' : 'text-[#1A1208] hover:text-[#6B7F5E]'
            }`}
          >
            {t('operations')}
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${operations.open ? 'rotate-180' : ''}`}
            />
          </button>
          {operations.open && (
            <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E8ECE4] py-1 min-w-[140px] z-50">
              <DropdownLink
                href="/admin/venues"
                active={isActive('/admin/venues')}
                onClick={() => operations.setOpen(false)}
              >
                {t('venues')}
              </DropdownLink>
              <DropdownLink
                href="/admin/customers"
                active={isActive('/admin/customers')}
                onClick={() => operations.setOpen(false)}
              >
                {t('customers')}
              </DropdownLink>
              <DropdownLink
                href="/admin/reports"
                active={isActive('/admin/reports')}
                onClick={() => operations.setOpen(false)}
              >
                {t('reports')}
              </DropdownLink>
            </div>
          )}
        </div>
      </div>

      {/* ── Right side controls ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Settings (store settings) */}
        <Link
          href="/admin/settings"
          className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors no-underline ${
            pathname.startsWith('/admin/settings') ? 'bg-[#E8ECE4] text-[#6B7F5E]' : 'text-[#1A1208] hover:bg-[#E8ECE4]'
          }`}
          title={t('settings')}
        >
          <Settings size={20} />
        </Link>

        {/* Notification bell */}
        <NotificationBell />

        {/* Language toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleSetLocale('en')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 transition-colors duration-150 ${
              locale === 'en'
                ? 'bg-[#6B7F5E] text-white'
                : 'bg-transparent text-[#1A1208] hover:bg-[#E8ECE4]'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => handleSetLocale('zh')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 transition-colors duration-150 ${
              locale === 'zh'
                ? 'bg-[#6B7F5E] text-white'
                : 'bg-transparent text-[#1A1208] hover:bg-[#E8ECE4]'
            }`}
          >
            中文
          </button>
        </div>

        {/* Avatar dropdown */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen(v => !v)}
            className="flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0 transition-opacity hover:opacity-80"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#6B7F5E]">
              <span className="text-white text-sm font-bold leading-none">{initials}</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-[#1A1208] transition-transform duration-200 ${avatarOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {avatarOpen && (
            <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-[#E8ECE4] z-50 min-w-[180px] py-1">
              {/* User info header */}
              {(userName || userEmail) && (
                <div className="px-4 py-2.5 border-b border-[#E8ECE4]">
                  {userName && (
                    <p className="text-sm font-medium text-[#1A1208] truncate">{userName}</p>
                  )}
                  {userEmail && (
                    <p className="text-xs text-[#8C8478] truncate mt-0.5">{userEmail}</p>
                  )}
                </div>
              )}

              {/* Logout */}
              <div className="pt-1">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#DC3545] bg-transparent border-0 cursor-pointer transition-colors hover:bg-red-50"
                >
                  <LogOut size={15} className="text-[#DC3545]" />
                  {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
