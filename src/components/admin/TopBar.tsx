'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { setLocale } from '@/lib/locale-actions'

interface TopBarProps {
  title: string
}

function getInitials(name?: string | null): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export default function TopBar({ title }: TopBarProps) {
  const tLang = useTranslations('language')
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initials = getInitials(session?.user?.name)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

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
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0"
          >
            <div className="w-8 h-8 bg-amber rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">{initials}</span>
            </div>
            <ChevronDown size={16} className="text-dark-brown" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-10 bg-white rounded-lg border border-beige shadow-md z-50 min-w-[160px]">
              {session?.user?.name && (
                <div className="px-4 py-2.5 text-sm text-brown border-b border-beige truncate">
                  {session.user.name}
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full text-left px-4 py-2.5 text-sm text-[#DC3545] hover:bg-cream-bg cursor-pointer bg-transparent border-none"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
