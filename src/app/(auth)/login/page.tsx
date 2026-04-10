"use client"

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import { Mail, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

function LoginForm() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else if (result?.ok) {
        const session = await getSession()
        const role = (session?.user as { role?: string })?.role
        router.refresh()
        if (callbackUrl !== '/') {
          router.push(callbackUrl)
        } else if (role === 'ADMIN') {
          router.push('/admin/dashboard')
        } else {
          router.push('/')
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1767447612225-a281f76abdb7?w=800&q=80" alt="Farm" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-16">
          <h2 className="font-playfair text-[44px] font-bold text-white text-center leading-tight whitespace-pre-line">{t('heroTitle')}</h2>
          <p className="text-white/70 text-base mt-4 text-center">{t('heroSubtitle')}</p>
        </div>
      </div>
      <div className="flex-1 bg-cream flex items-center justify-center">
        <div className="w-[420px] bg-white rounded-[20px] p-10 shadow-[0_4px_40px_rgba(0,0,0,0.03)] flex flex-col gap-7">
          <div className="flex flex-col">
            <span className="font-playfair text-[22px] font-bold text-amber">Bobo&apos;s Farm</span>
            <span className="text-[11px] text-brown/40 tracking-wide">波姐农家乐</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="font-playfair text-[28px] font-bold text-brown">{t('title')}</h1>
            <p className="text-sm text-brown/53">{t('subtitle')}</p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('email')}</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <Mail size={18} className="text-brown/33" />
                <input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-brown/27"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('password')}</label>
              <div className="flex items-center justify-between h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <div className="flex items-center gap-3">
                  <span className="text-brown/33 text-sm">&#x1f512;</span>
                  <input
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-sm bg-transparent outline-none placeholder:text-brown/27"
                  />
                </div>
                <EyeOff size={18} className="text-brown/27 cursor-pointer" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`w-[18px] h-[18px] rounded border-[1.5px] ${rememberMe ? 'bg-amber border-amber' : 'bg-white border-beige'}`} />
                <span className="text-[13px] text-brown">{t('rememberMe')}</span>
              </label>
              <a href="#" className="text-[13px] font-medium text-amber no-underline">{t('forgotPassword')}</a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-[50px] rounded-2xl bg-gradient-to-r from-amber to-[#A67C2E] text-white text-base font-semibold shadow-[0_4px_16px_rgba(139,105,20,0.2)] cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-beige" />
            <span className="text-xs text-brown/33">{t('orContinueWith')}</span>
            <div className="flex-1 h-px bg-beige" />
          </div>
          <button
            type="button"
            onClick={() => signIn('google')}
            className="h-12 rounded-xl bg-white border-[1.5px] border-beige flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span className="text-[#4285F4] text-lg font-bold">G</span>
            <span className="text-sm font-medium text-brown">{t('continueWithGoogle')}</span>
          </button>
          <div className="flex justify-center gap-1">
            <span className="text-[13px] text-brown/53">{t('noAccount')}</span>
            <Link href="/register" className="text-[13px] font-semibold text-amber no-underline">{t('signUp')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
