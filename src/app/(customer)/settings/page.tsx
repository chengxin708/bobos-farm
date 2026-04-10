"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Lock, EyeOff, Eye, ChevronDown, Trash2 } from 'lucide-react'
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
  if (pw.length < 6) return { level: 'weak', percent: 25, color: 'bg-[#DC3545]' }
  const hasUpper = /[A-Z]/.test(pw)
  const hasNumber = /\d/.test(pw)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
  const score = [pw.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
  if (score <= 1) return { level: 'weak', percent: 25, color: 'bg-[#DC3545]' }
  if (score === 2) return { level: 'medium', percent: 50, color: 'bg-amber' }
  if (score === 3) return { level: 'good', percent: 75, color: 'bg-green' }
  return { level: 'strong', percent: 100, color: 'bg-green' }
}

// ── Component ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('customerSettings')
  const tCommon = useTranslations('common')
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

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

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
    setProfileSaving(true)
    setProfileSuccess(false)
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
    } finally {
      setProfileSaving(false)
    }
  }, [name, phone, language, mutate])

  const pwStrength = getPasswordStrength(newPassword)
  const initials = user ? getInitials(user.name, user.email) : '--'

  const [langOpen, setLangOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <div className="flex-1 flex flex-col items-center py-12 px-4 gap-6">
        <h1 className="font-playfair text-[32px] font-bold text-brown">{t('title')}</h1>

        <div className="w-[560px] flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-beige flex flex-col gap-5">
            {/* Avatar Row */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
              <span className="text-sm text-amber cursor-pointer">{t('profile.changePhoto')}</span>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.fullName')}</label>
                <div className="flex items-center h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-brown"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.email')}</label>
                <div className="flex items-center gap-2 h-11 px-3 bg-[#F0EDE8] rounded-lg border border-beige">
                  <Lock size={16} className="text-[#8A8A8A]" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.phone')}</label>
                <div className="flex items-center h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-brown"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.language')}</label>
                <div className="relative">
                  <button
                    onClick={() => setLangOpen(!langOpen)}
                    className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige cursor-pointer w-full"
                  >
                    <span className="text-sm text-brown">{language === 'EN' ? 'English' : '\u4e2d\u6587'}</span>
                    <ChevronDown size={16} className="text-[#8A8A8A]" />
                  </button>
                  {langOpen && (
                    <div className="absolute top-12 left-0 right-0 bg-white rounded-lg border border-beige shadow-md z-10">
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-cream-bg"
                        onClick={() => { setLanguage('EN'); setLangOpen(false) }}
                      >
                        English
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-cream-bg"
                        onClick={() => { setLanguage('ZH'); setLangOpen(false) }}
                      >
                        {'\u4e2d\u6587'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              {profileSuccess && (
                <span className="text-xs text-green font-medium">Profile saved!</span>
              )}
              <div className="flex-1" />
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="px-6 py-2.5 rounded-3xl bg-amber text-white text-sm font-medium border-none cursor-pointer disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : tCommon('saveChanges')}
              </button>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl p-6 border border-beige flex flex-col gap-5">
            <h3 className="font-playfair text-lg font-bold text-brown">{t('password.title')}</h3>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('password.currentPassword')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-brown"
                  />
                  <button onClick={() => setShowCurrentPw(!showCurrentPw)}>
                    {showCurrentPw ? <Eye size={16} className="text-[#8A8A8A]" /> : <EyeOff size={16} className="text-[#8A8A8A]" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('password.newPassword')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-brown"
                  />
                  <button onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? <Eye size={16} className="text-[#8A8A8A]" /> : <EyeOff size={16} className="text-[#8A8A8A]" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-[#F0EDE8] rounded-sm overflow-hidden">
                      <div className={`h-full ${pwStrength.color} rounded-sm`} style={{ width: `${pwStrength.percent}%` }} />
                    </div>
                    <span className={`text-xs ${pwStrength.level === 'weak' ? 'text-[#DC3545]' : pwStrength.level === 'medium' ? 'text-amber' : 'text-green'}`}>
                      {t(`password.strength.${pwStrength.level}`)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('password.confirmNewPassword')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-brown"
                  />
                  <button onClick={() => setShowConfirmPw(!showConfirmPw)}>
                    {showConfirmPw ? <Eye size={16} className="text-[#8A8A8A]" /> : <EyeOff size={16} className="text-[#8A8A8A]" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <span className="text-xs text-[#DC3545]">Passwords do not match</span>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                className="px-6 py-2.5 rounded-3xl bg-white text-amber text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ border: '1.5px solid #8B6914' }}
              >
                {t('password.updatePassword')}
              </button>
            </div>
          </div>

          {/* Email Notifications Card */}
          <div className="bg-white rounded-2xl p-6 border border-beige flex flex-col gap-5">
            <h3 className="font-playfair text-lg font-bold text-brown">{t('notifications.title')}</h3>

            <div className="flex flex-col">
              {notificationKeys.map((key, i) => (
                <div
                  key={key}
                  className={`flex items-center justify-between py-3.5 ${
                    i < notificationKeys.length - 1 ? 'border-b border-[#F0EDE8]' : ''
                  }`}
                >
                  <span className="text-sm text-brown">{t(`notifications.${key}`)}</span>
                  <button
                    onClick={() => setToggles((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                    className={`w-11 h-6 rounded-xl border-none cursor-pointer relative transition-colors ${
                      toggles[i] ? 'bg-amber' : 'bg-[#D9D1C7]'
                    }`}
                  >
                    <div
                      className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all"
                      style={{ left: toggles[i] ? '22px' : '2px' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-white rounded-2xl p-6 flex flex-col gap-3" style={{ borderLeft: '4px solid #DC3545', border: '1px solid #E8DFD0', borderLeftWidth: 4, borderLeftColor: '#DC3545' }}>
            <div
              className="flex items-center gap-2 py-2 cursor-pointer"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            >
              <Trash2 size={16} className="text-[#DC3545]" />
              <span className="text-sm font-medium text-[#DC3545]">{t('danger.deleteAccount')}</span>
            </div>
            <p className="text-[13px] text-[#8A8A8A] leading-relaxed">
              {t('danger.deleteWarning')}
            </p>
            {showDeleteConfirm && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  className="px-4 py-2 text-sm text-[#DC3545] border border-[#DC3545] rounded-md font-semibold"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm bg-[#DC3545] text-white rounded-md font-semibold"
                >
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
