"use client"

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

type StrengthKey = 'weak' | 'medium' | 'good' | 'strong'

function getPasswordStrength(password: string): { score: number; strengthKey: StrengthKey; color: string } {
  if (!password) return { score: 0, strengthKey: 'weak', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const keys: StrengthKey[] = ['weak', 'weak', 'medium', 'good', 'strong']
  const colors = ['', '#C4453A', '#E8B730', '#6B7F5E', '#6B7F5E']
  return { score, strengthKey: keys[score] || 'weak', color: colors[score] || '#C4453A' }
}

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const strength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      })

      const data = await res.json()

      if (res.status === 409) {
        setError('An account with this email already exists')
        return
      }
      if (res.status === 400) {
        const details = data.details?.fieldErrors
        const firstError = details ? Object.values(details).flat()[0] as string : data.error
        setError(firstError || 'Validation failed')
        return
      }
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
        return
      }

      // Auto-login after successful registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.ok) {
        router.refresh()
        router.push('/')
      } else {
        // Registration succeeded but auto-login failed — send to login page
        router.push('/login')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
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
        {/* Name */}
        <div>
          <div className="flex items-center h-[52px] rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] transition-colors px-4 gap-3 bg-white">
            <User size={18} className="text-[#1A1208]/30 shrink-0" />
            <input
              type="text"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#1A1208]/30 text-[#1A1208]"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <div className="flex items-center h-[52px] rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] transition-colors px-4 gap-3 bg-white">
            <Mail size={18} className="text-[#1A1208]/30 shrink-0" />
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#1A1208]/30 text-[#1A1208]"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center h-[52px] rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] transition-colors px-4 gap-3 bg-white">
            <Lock size={18} className="text-[#1A1208]/30 shrink-0" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#1A1208]/30 text-[#1A1208]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="bg-transparent border-none p-0 cursor-pointer shrink-0"
            >
              {showPassword
                ? <Eye size={18} className="text-[#1A1208]/30" />
                : <EyeOff size={18} className="text-[#1A1208]/30" />}
            </button>
          </div>
          {/* Strength bar */}
          {password && (
            <div className="mt-2">
              <div className="flex gap-1 h-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{ backgroundColor: i <= strength.score ? strength.color : '#E8ECE4' }}
                  />
                ))}
              </div>
              <span className="text-[11px] mt-1 block" style={{ color: strength.color }}>
                {t('passwordStrength', { strength: t(`strength.${strength.strengthKey}`) })}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <div className="flex items-center h-[52px] rounded-xl border border-[#E8ECE4] focus-within:border-[#6B7F5E] transition-colors px-4 gap-3 bg-white">
            <Lock size={18} className="text-[#1A1208]/30 shrink-0" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder={t('confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#1A1208]/30 text-[#1A1208]"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="bg-transparent border-none p-0 cursor-pointer shrink-0"
            >
              {showConfirmPassword
                ? <Eye size={18} className="text-[#1A1208]/30" />
                : <EyeOff size={18} className="text-[#1A1208]/30" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="bg-[#6B7F5E] text-white rounded-full py-3 w-full text-base font-medium cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed transition-opacity mt-2"
        >
          {isLoading ? t('creatingAccount') : t('createAccount')}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-[#E8ECE4]" />
        <span className="text-xs text-[#1A1208]/40">{tCommon('or')}</span>
        <div className="flex-1 h-px bg-[#E8ECE4]" />
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        onClick={() => signIn('google')}
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
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-[#6B7F5E] font-medium no-underline hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  )

  return (
    <>
      {/* Mobile layout */}
      <div className="md:hidden min-h-screen bg-[#FAFAF7] flex items-center justify-center pt-16 pb-10">
        {formContent}
      </div>

      {/* Desktop split layout */}
      <div className="hidden md:flex h-screen">
        {/* Left: farm photo */}
        <div className="w-1/2 relative">
          <Image
            src="https://images.unsplash.com/photo-1763771056927-557d39cb5e02?w=1200&q=80"
            alt="Bobo's Farm"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Right: form */}
        <div className="w-1/2 bg-[#FAFAF7] flex items-center justify-center overflow-auto py-8">
          {formContent}
        </div>
      </div>
    </>
  )
}
