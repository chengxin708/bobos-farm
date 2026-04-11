"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, EyeOff, Eye, ChevronDown, ChevronLeft, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'

// ── Types ──────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  preferredLanguage: 'EN' | 'ZH'
  image: string | null
  createdAt: string
  updatedAt: string
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function getPasswordStrength(pw: string): { level: string; percent: number; color: string } {
  if (pw.length === 0) return { level: '', percent: 0, color: '' }
  if (pw.length < 6) return { level: 'weak', percent: 25, color: 'bg-[#C4453A]' }
  const hasUpper = /[A-Z]/.test(pw)
  const hasNumber = /\d/.test(pw)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
  const score = [pw.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
  if (score <= 1) return { level: 'weak', percent: 25, color: 'bg-[#C4453A]' }
  if (score === 2) return { level: 'medium', percent: 50, color: 'bg-[#C47D52]' }
  if (score === 3) return { level: 'good', percent: 75, color: 'bg-[#6B7F5E]' }
  return { level: 'strong', percent: 100, color: 'bg-[#6B7F5E]' }
}

// ── Component ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('customerSettings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const profileSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (profileSuccessTimerRef.current) clearTimeout(profileSuccessTimerRef.current)
    }
  }, [])

  const { data: user, mutate } = useSWR<UserProfile>('/api/users/me', fetcher)

  // Profile form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState<'EN' | 'ZH'>('EN')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password form — collapsible
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Notification toggles
  const notificationKeys = [
    'reservationConfirmations',
    'orderReminders',
    'dayBeforeReminders',
    'promotionalOffers',
  ] as const
  const [toggles, setToggles] = useState([true, true, true, false])

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Initialize from fetched user
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      setLanguage(user.preferredLanguage || 'EN')
    }
  }, [user])

  const handleSaveProfile = useCallback(async () => {
    if (profileSaving) return
    setProfileSaving(true)
    setProfileSuccess(false)
    setProfileError(null)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          phone: phone || undefined,
          preferredLanguage: language,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      mutate()
      setProfileSuccess(true)
      if (profileSuccessTimerRef.current) clearTimeout(profileSuccessTimerRef.current)
      profileSuccessTimerRef.current = setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      console.error('Save profile error:', err)
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }, [name, phone, language, mutate, profileSaving])

  const pwStrength = getPasswordStrength(newPassword)
  const initials = user ? getInitials(user.name, user.email) : '--'

  const [langOpen, setLangOpen] = useState(false)

  return (
    <div className="flex flex-col pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-2 max-w-[560px] mx-auto w-full">
        <button
          onClick={() => router.push('/reservations')}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon('back')}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <h1 className="text-2xl font-serif text-[#1A1208]">{t('title')}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 pb-4 pt-4">
        <div className="w-full max-w-[560px] flex flex-col gap-5">

          {/* ── Profile Card ── */}
          <div className="bg-white rounded-2xl p-6 border border-[#E8ECE4] flex flex-col gap-5">
            {/* Avatar Row */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#6B7F5E] flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
              <span className="text-sm text-[#8C8478] cursor-default opacity-60" title="Coming soon">{t('profile.changePhoto')}</span>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1208]">{t('profile.fullName')}</label>
                <div className="flex items-center h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20 transition-colors">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-base text-[#1A1208] placeholder:text-[#8C8478]"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Email (locked) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1208]">{t('profile.email')}</label>
                <div className="flex items-center gap-3 h-[52px] px-4 rounded-xl border border-[#E8ECE4] bg-[#F8F7F4]">
                  <Lock size={16} className="text-[#8C8478]" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="flex-1 bg-transparent border-none outline-none text-base text-[#8C8478]"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1208]">{t('profile.phone')}</label>
                <div className="flex items-center h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20 transition-colors">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-base text-[#1A1208] placeholder:text-[#8C8478]"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              {/* Language */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A1208]">{t('profile.language')}</label>
                <div className="relative">
                  <button
                    onClick={() => setLangOpen(!langOpen)}
                    className="flex items-center justify-between h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] cursor-pointer w-full bg-transparent transition-colors"
                  >
                    <span className="text-base text-[#1A1208]">{language === 'EN' ? 'English' : '\u4e2d\u6587'}</span>
                    <ChevronDown size={16} className="text-[#8C8478]" />
                  </button>
                  {langOpen && (
                    <div className="absolute top-14 left-0 right-0 bg-white rounded-xl border border-[#E8ECE4] shadow-lg z-10 overflow-hidden">
                      <button
                        className="w-full text-left px-4 py-3 text-base hover:bg-[#F8F7F4] transition-colors border-none bg-transparent cursor-pointer"
                        onClick={() => { setLanguage('EN'); setLangOpen(false) }}
                      >
                        English
                      </button>
                      <button
                        className="w-full text-left px-4 py-3 text-base hover:bg-[#F8F7F4] transition-colors border-none bg-transparent cursor-pointer"
                        onClick={() => { setLanguage('ZH'); setLangOpen(false) }}
                      >
                        {'\u4e2d\u6587'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {profileError && (
              <div className="bg-[#C4453A]/10 text-[#C4453A] text-sm rounded-xl px-4 py-3">
                {profileError}
              </div>
            )}

            <div className="flex items-center justify-between">
              {profileSuccess && (
                <span className="text-sm text-[#6B7F5E] font-medium">{t('profile.saved')}</span>
              )}
              <div className="flex-1" />
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="px-6 py-3 rounded-full bg-[#6B7F5E] text-white text-sm font-medium border-none cursor-pointer disabled:opacity-50 hover:brightness-90 active:scale-[0.97] transition-all"
              >
                {profileSaving ? 'Saving...' : tCommon('saveChanges')}
              </button>
            </div>
          </div>

          {/* ── Password Card (collapsible) ── */}
          <div className="bg-white rounded-2xl border border-[#E8ECE4] overflow-hidden">
            <button
              onClick={() => setPasswordOpen(!passwordOpen)}
              className="w-full flex items-center justify-between p-6 bg-transparent border-none cursor-pointer"
            >
              <h3 className="font-serif text-lg text-[#1A1208]">{t('password.title')}</h3>
              <ChevronDown
                size={18}
                className={`text-[#8C8478] transition-transform duration-200 ${passwordOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {passwordOpen && (
              <div className="px-6 pb-6 flex flex-col gap-4">
                {/* Current Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#1A1208]">{t('password.currentPassword')}</label>
                  <div className="flex items-center h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20 transition-colors">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-base text-[#1A1208]"
                    />
                    <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="bg-transparent border-none cursor-pointer p-1">
                      {showCurrentPw ? <Eye size={18} className="text-[#8C8478]" /> : <EyeOff size={18} className="text-[#8C8478]" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#1A1208]">{t('password.newPassword')}</label>
                  <div className="flex items-center h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20 transition-colors">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-base text-[#1A1208]"
                    />
                    <button onClick={() => setShowNewPw(!showNewPw)} className="bg-transparent border-none cursor-pointer p-1">
                      {showNewPw ? <Eye size={18} className="text-[#8C8478]" /> : <EyeOff size={18} className="text-[#8C8478]" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-[#E8ECE4] rounded-full overflow-hidden">
                        <div className={`h-full ${pwStrength.color} rounded-full transition-all`} style={{ width: `${pwStrength.percent}%` }} />
                      </div>
                      <span className={`text-xs ${pwStrength.level === 'weak' ? 'text-[#C4453A]' : pwStrength.level === 'medium' ? 'text-[#C47D52]' : 'text-[#6B7F5E]'}`}>
                        {t(`password.strength.${pwStrength.level}`)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#1A1208]">{t('password.confirmNewPassword')}</label>
                  <div className="flex items-center h-[52px] px-4 rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] focus-within:ring-1 focus-within:ring-[#6B7F5E]/20 transition-colors">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-base text-[#1A1208]"
                    />
                    <button onClick={() => setShowConfirmPw(!showConfirmPw)} className="bg-transparent border-none cursor-pointer p-1">
                      {showConfirmPw ? <Eye size={18} className="text-[#8C8478]" /> : <EyeOff size={18} className="text-[#8C8478]" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <span className="text-xs text-[#C4453A] mt-0.5">Passwords do not match</span>
                  )}
                </div>

                {passwordError && (
                  <div className="bg-[#C4453A]/10 text-[#C4453A] text-sm rounded-xl px-4 py-3">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-[#6B7F5E]/10 text-[#6B7F5E] text-sm rounded-xl px-4 py-3">
                    {t('password.updateSuccess')}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || passwordSaving}
                    onClick={async () => {
                      if (passwordSaving) return
                      setPasswordSaving(true)
                      setPasswordError(null)
                      setPasswordSuccess(false)
                      try {
                        const res = await fetch('/api/users/me/password', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ currentPassword, newPassword }),
                        })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}))
                          throw new Error(data.error || 'Failed to update password')
                        }
                        setPasswordSuccess(true)
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmPassword('')
                      } catch (err) {
                        setPasswordError(err instanceof Error ? err.message : 'Failed to update password')
                      } finally {
                        setPasswordSaving(false)
                      }
                    }}
                    className="px-6 py-3 rounded-full border-[1.5px] border-[#6B7F5E] bg-transparent text-[#6B7F5E] text-sm font-medium cursor-pointer disabled:opacity-40 hover:bg-[#E8ECE4] active:scale-[0.97] transition-all"
                  >
                    {passwordSaving ? 'Updating...' : t('password.updatePassword')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Notifications Card ── */}
          <div className="bg-white rounded-2xl p-6 border border-[#E8ECE4] flex flex-col gap-5">
            <h3 className="font-serif text-lg text-[#1A1208]">{t('notifications.title')}</h3>

            <div className="flex flex-col">
              {notificationKeys.map((key, i) => (
                <div
                  key={key}
                  className={`flex items-center justify-between py-4 ${
                    i < notificationKeys.length - 1 ? 'border-b border-[#E8ECE4]' : ''
                  }`}
                >
                  <span className="text-[15px] text-[#1A1208]">{t(`notifications.${key}`)}</span>
                  <button
                    onClick={() => setToggles((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                    className={`w-12 h-7 rounded-full border-none cursor-pointer relative transition-colors duration-200 ${
                      toggles[i] ? 'bg-[#6B7F5E]' : 'bg-[#D5D0C8]'
                    }`}
                    aria-checked={toggles[i]}
                    role="switch"
                  >
                    <div
                      className="w-[22px] h-[22px] bg-white rounded-full absolute top-[3px] transition-all duration-200 shadow-sm"
                      style={{ left: toggles[i] ? '24px' : '3px' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delete Account ── */}
          <div className="pt-2 pb-4">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="flex items-center gap-2 bg-transparent border-none cursor-pointer py-2"
            >
              <Trash2 size={15} className="text-[#C4453A]" />
              <span className="text-sm text-[#C4453A]">{t('danger.deleteAccount')}</span>
            </button>
            <p className="text-[13px] text-[#8C8478] leading-relaxed mt-1 ml-[23px]">
              {t('danger.deleteWarning')}
            </p>
            {showDeleteConfirm && (
              <div className="flex items-center gap-3 mt-3 ml-[23px]">
                <button
                  className="px-4 py-2 text-sm text-[#8C8478] border border-[#E8ECE4] rounded-full font-medium bg-transparent cursor-pointer hover:bg-[#F8F7F4] transition-colors"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  className="px-4 py-2 text-sm bg-[#C4453A] text-white rounded-full font-medium cursor-pointer border-none hover:brightness-90 transition-all"
                  onClick={() => alert('Account deletion is not yet available. Please contact support.')}
                >
                  {t('danger.confirmDelete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
