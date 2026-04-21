'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react'

interface InlineAuthTabsProps {
  /** Reservation code to claim after auth (forwarded to /api/auth/register). */
  claimCode: string
  /** Claim token from the tokenized URL (required for the strict claim path). */
  claimToken: string | null
  /** Called with the final landing URL after successful auth + claim. */
  onSuccess: (destination: string) => void
}

type Tab = 'login' | 'register'

export default function InlineAuthTabs({ claimCode, claimToken, onSuccess }: InlineAuthTabsProps) {
  const t = useTranslations('claim.inlineAuth')
  const [tab, setTab] = useState<Tab>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)

  // register state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [showRegPw, setShowRegPw] = useState(false)
  const [regLang, setRegLang] = useState<'EN' | 'ZH'>('EN')
  const [regMarketing, setRegMarketing] = useState(true)

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      if (result?.error) {
        setError(t('invalidCredentials'))
        setBusy(false)
        return
      }
      // Session now established — call claim on behalf of the fresh session.
      const claimRes = await fetch('/api/reservations/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: claimCode,
          ...(claimToken ? { token: claimToken } : {}),
        }),
      })
      if (!claimRes.ok) {
        const data = await claimRes.json().catch(() => ({}))
        setError(data.error || t('claimFailed'))
        setBusy(false)
        return
      }
      const data = await claimRes.json()
      onSuccess(data.reservation?.id ? `/reservations/${data.reservation.id}` : '/reservations')
    } catch {
      setError(t('networkError'))
      setBusy(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (regPassword !== regConfirm) {
      setError(t('passwordsMismatch'))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
          confirmPassword: regConfirm,
          preferredLanguage: regLang,
          marketingOptIn: regMarketing,
          claimCode,
          ...(claimToken ? { claimToken } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('registerFailed'))
        setBusy(false)
        return
      }
      const body = await res.json()
      // Sign in so the session cookie is set for the redirect.
      const signInRes = await signIn('credentials', {
        email: regEmail,
        password: regPassword,
        redirect: false,
      })
      if (signInRes?.error) {
        setError(t('signInAfterRegisterFailed'))
        setBusy(false)
        return
      }
      const reservationId = body.claim?.reservation?.id
      onSuccess(reservationId ? `/reservations/${reservationId}` : '/reservations')
    } catch {
      setError(t('networkError'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 border-b border-[#E8ECE4]">
        <button
          type="button"
          onClick={() => { setTab('login'); setError('') }}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            tab === 'login' ? 'text-[#6B7F5E] border-b-2 border-[#6B7F5E]' : 'text-[#8C8478]'
          }`}
        >
          {t('loginTab')}
        </button>
        <button
          type="button"
          onClick={() => { setTab('register'); setError('') }}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            tab === 'register' ? 'text-[#6B7F5E] border-b-2 border-[#6B7F5E]' : 'text-[#8C8478]'
          }`}
        >
          {t('registerTab')}
        </button>
      </div>

      {error && (
        <div className="bg-[#C4453A]/10 text-[#C4453A] rounded-xl p-3 text-sm">{error}</div>
      )}

      {tab === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
          <FieldWithIcon icon={<Mail size={16} />}>
            <input
              type="email"
              required
              placeholder={t('emailPlaceholder')}
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={<Lock size={16} />}>
            <input
              type={showLoginPw ? 'text' : 'password'}
              required
              placeholder={t('passwordPlaceholder')}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowLoginPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8478]"
            >
              {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </FieldWithIcon>
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-full bg-[#6B7F5E] text-white font-semibold hover:bg-[#5A6E4E] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t('loginCta')}
          </button>
          <button
            type="button"
            onClick={() => {
              const qs = new URLSearchParams({ code: claimCode })
              if (claimToken) qs.set('t', claimToken)
              signIn('google', { callbackUrl: `/claim?${qs.toString()}` })
            }}
            className="h-11 rounded-full border border-[#E8ECE4] text-sm font-semibold text-[#2C2416] hover:bg-[#F2EDE6]"
          >
            {t('googleCta')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
          <FieldWithIcon icon={<User size={16} />}>
            <input
              type="text"
              required
              placeholder={t('namePlaceholder')}
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={<Mail size={16} />}>
            <input
              type="email"
              required
              placeholder={t('emailPlaceholder')}
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={<Phone size={16} />}>
            <input
              type="tel"
              required
              placeholder={t('phonePlaceholder')}
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={<Lock size={16} />}>
            <input
              type={showRegPw ? 'text' : 'password'}
              required
              placeholder={t('passwordPlaceholder')}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowRegPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8478]"
            >
              {showRegPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </FieldWithIcon>
          <FieldWithIcon icon={<Lock size={16} />}>
            <input
              type={showRegPw ? 'text' : 'password'}
              required
              placeholder={t('confirmPasswordPlaceholder')}
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] transition-all"
            />
          </FieldWithIcon>
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="lang"
                checked={regLang === 'EN'}
                onChange={() => setRegLang('EN')}
              />
              English
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="lang"
                checked={regLang === 'ZH'}
                onChange={() => setRegLang('ZH')}
              />
              中文
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs text-[#6B6157]">
            <input
              type="checkbox"
              checked={regMarketing}
              onChange={(e) => setRegMarketing(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t('marketingOptIn')}</span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-full bg-[#6B7F5E] text-white font-semibold hover:bg-[#5A6E4E] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t('registerCta')}
          </button>
        </form>
      )}
    </div>
  )
}

function FieldWithIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8478] pointer-events-none">{icon}</span>
      {children}
    </div>
  )
}
