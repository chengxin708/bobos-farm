"use client"

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { safeCallbackUrl } from '@/lib/safe-callback'

function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const searchParams = useSearchParams()
  // Narrow an arbitrary ?callbackUrl= to a known-safe path before using it for
  // redirects. Prevents phishing via off-origin or admin-path redirects.
  const rawCallback = searchParams.get('callbackUrl')
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bobos.farm'
  const callbackUrl = safeCallbackUrl(rawCallback, origin)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // If the user bailed out of the Google OAuth consent screen, NextAuth
  // bounces back here with ?error=OAuthCallback or access_denied.
  // Surface a friendly message instead of a dead-silent form and keep
  // callbackUrl so they can retry with email/password.
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'access_denied' || err === 'OAuthCallback' || err === 'OAuthSignin') {
      setError(t('oauthCancelled'))
    }
  }, [searchParams, t])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const target = callbackUrl

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
        setIsLoading(false)
      } else {
        window.location.assign(target)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }

  const formContent = (
    <div className="w-full max-w-[400px] px-6 md:px-8">
      {/* Logo */}
      <h1 className="font-serif text-2xl font-bold text-[#1A1208] text-center md:text-left">
        Bobo&apos;s Farm
      </h1>
      <p className="text-sm text-[#1A1208]/50 text-center md:text-left mt-1 mb-10">
        {t('subtitle')}
      </p>

      {/* Heading */}
      <h2 className="font-serif text-2xl font-semibold text-[#1A1208] mb-6">
        {t('title')}
      </h2>

      {/* Error banner */}
      {error && (
        <div className="bg-[#C4453A]/10 text-[#C4453A] rounded-xl p-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email */}
        <div className="relative">
          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1208]/30 pointer-events-none" />
          <input
            type="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ border: '1px solid #E8ECE4', outline: 'none' }}
            className="w-full h-[52px] rounded-xl pl-11 pr-4 text-sm bg-white placeholder:text-[#1A1208]/30 text-[#1A1208] focus:!border-[#6B7F5E] transition-colors"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1208]/30 pointer-events-none" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ border: '1px solid #E8ECE4', outline: 'none' }}
            className="w-full h-[52px] rounded-xl pl-11 pr-12 text-sm bg-white placeholder:text-[#1A1208]/30 text-[#1A1208] focus:!border-[#6B7F5E] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer"
          >
            {showPassword
              ? <Eye size={18} className="text-[#1A1208]/30" />
              : <EyeOff size={18} className="text-[#1A1208]/30" />}
          </button>
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setRememberMe(!rememberMe)}
          >
            <div
              className={`w-[18px] h-[18px] rounded border-[1.5px] flex items-center justify-center transition-colors ${
                rememberMe
                  ? 'bg-[#6B7F5E] border-[#6B7F5E]'
                  : 'bg-white border-[#E8ECE4]'
              }`}
            >
              {rememberMe && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-[#1A1208]">{t('rememberMe')}</span>
          </label>
          <a href="#" className="text-sm text-[#6B7F5E] no-underline hover:underline">
            {t('forgotPassword')}
          </a>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#6B7F5E] text-white rounded-full py-3 w-full text-base font-medium cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
        >
          {isLoading ? t('signingIn') : t('signIn')}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-[#E8ECE4]" />
        <span className="text-xs text-[#1A1208]/40">{t('orContinueWith')}</span>
        <div className="flex-1 h-px bg-[#E8ECE4]" />
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl })}
        className="border border-[#E8ECE4] rounded-full py-3 w-full flex items-center justify-center gap-2.5 cursor-pointer bg-white hover:bg-[#F9FAF8] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        <span className="text-sm font-medium text-[#1A1208]">{t('continueWithGoogle')}</span>
      </button>

      {/* Bottom link */}
      <p className="text-center mt-6 text-sm text-[#1A1208]/50">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-[#6B7F5E] font-medium no-underline hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </div>
  )

  return (
    <>
      {/* Mobile layout */}
      <div className="md:hidden h-full bg-[#FAFAF7] flex items-center justify-center pt-16 pb-10 overflow-y-auto">
        {formContent}
      </div>

      {/* Desktop split layout */}
      <div className="hidden md:flex h-full">
        {/* Left: farm photo */}
        <div className="w-1/2 relative">
          <Image
            src="https://images.unsplash.com/photo-1767447612225-a281f76abdb7?w=1200&q=80"
            alt="Bobo's Farm"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Right: form */}
        <div className="w-1/2 bg-[#FAFAF7] flex items-center justify-center">
          {formContent}
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
