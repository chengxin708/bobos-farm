'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, Settings, LogOut } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { setLocale } from '@/lib/locale-actions'

interface TopBarProps {
  title: string
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return '??'
}

export default function TopBar({ title }: TopBarProps) {
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const userName = session?.user?.name || ''
  const userEmail = session?.user?.email || ''
  const initials = getInitials(userName, userEmail)

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
    if (newLocale === locale) return
    await setLocale(newLocale)
    router.refresh()
  }

  return (
    <header className="h-16 bg-white flex items-center justify-between px-6 border-b border-[#E8E2D9] shrink-0">
      {/* Page title */}
      <h1 className="text-[20px] font-semibold text-[#2C2416] font-playfair">
        {title}
      </h1>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleSetLocale('en')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 transition-colors duration-150 ${
              locale === 'en'
                ? 'bg-[#8B6914] text-white'
                : 'bg-transparent text-[#6B5D4E] hover:bg-[#F5F0E8]'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => handleSetLocale('zh')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 transition-colors duration-150 ${
              locale === 'zh'
                ? 'bg-[#8B6914] text-white'
                : 'bg-transparent text-[#6B5D4E] hover:bg-[#F5F0E8]'
            }`}
          >
            中文
          </button>
        </div>

        {/* Notification bell */}
        <button className="flex items-center justify-center w-9 h-9 rounded-full bg-transparent border-0 cursor-pointer transition-colors duration-150 hover:bg-[#F5F0E8]">
          <Bell size={20} className="text-[#6B5D4E]" />
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0 transition-opacity duration-150 hover:opacity-80"
          >
            {/* Avatar circle with gradient */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-[#8B6914] to-[#A67C2E]">
              <span className="text-white text-sm font-semibold leading-none">
                {initials}
              </span>
            </div>
            {/* User name */}
            {userName && (
              <span className="text-[13px] text-[#2C2416] font-medium hidden sm:inline">
                {userName}
              </span>
            )}
            <ChevronDown
              size={14}
              className={`text-[#6B5D4E] transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 bg-white rounded-lg border border-[#E8E2D9] shadow-lg z-50 min-w-[180px] py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* User info header */}
              {(userName || userEmail) && (
                <div className="px-4 py-2.5 border-b border-[#E8E2D9]">
                  {userName && (
                    <p className="text-sm font-medium text-[#2C2416] truncate">
                      {userName}
                    </p>
                  )}
                  {userEmail && (
                    <p className="text-xs text-[#6B5D4E] truncate mt-0.5">
                      {userEmail}
                    </p>
                  )}
                </div>
              )}

              {/* Menu items */}
              <button
                onClick={() => {
                  setDropdownOpen(false)
                  router.push('/admin/settings')
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#2C2416] bg-transparent border-0 cursor-pointer transition-colors duration-150 hover:bg-[#F5F0E8]"
              >
                <Settings size={15} className="text-[#6B5D4E]" />
                个人设置
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#DC3545] bg-transparent border-0 cursor-pointer transition-colors duration-150 hover:bg-red-50"
              >
                <LogOut size={15} className="text-[#DC3545]" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
