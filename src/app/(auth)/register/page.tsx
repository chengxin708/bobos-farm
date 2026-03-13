"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { User, Mail, Phone, EyeOff, Lock } from 'lucide-react'

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', '#E05252', '#E8B730', '#5B8C3E', '#5B8C3E']
  return { score, label: labels[score] || 'Weak', color: colors[score] || '#E05252' }
}

export default function RegisterPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
        body: JSON.stringify({ name, email, phone: phone || undefined, password, confirmPassword }),
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

  return (
    <div className="flex h-screen">
      {/* Left Image Panel */}
      <div className="flex-1 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1763771056927-557d39cb5e02?w=800&q=80"
          alt="Farm animals"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-16">
          <h2 className="font-playfair text-[44px] font-bold text-white text-center leading-tight">
            Join Our Table
          </h2>
          <p className="text-white/70 text-base mt-4 text-center">
            Fresh from the pastures, straight to your plate
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-cream flex items-center justify-center overflow-auto py-8">
        <div className="w-[420px] bg-white rounded-[20px] px-10 py-9 shadow-[0_4px_40px_rgba(0,0,0,0.03)] flex flex-col gap-6">
          {/* Logo */}
          <div className="flex flex-col items-center">
            <span className="font-playfair text-[22px] font-bold text-amber">Bobo&apos;s Farm</span>
            <span className="text-[11px] text-brown/40 tracking-wide">波姐农家乐</span>
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-1.5">
            <h1 className="font-playfair text-[28px] font-bold text-brown">Create Account</h1>
            <p className="text-sm text-brown/53">Reserve your spot at our table.</p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Fields */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">Full Name</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <User size={18} className="text-brown/33" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-brown/27"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">Email</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <Mail size={18} className="text-brown/33" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-brown/27"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[13px] font-semibold text-brown">Phone</label>
                <span className="text-[11px] text-brown/33 italic">Optional — for reservation reminders</span>
              </div>
              <div className="flex items-center gap-3 h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <Phone size={18} className="text-brown/33" />
                <input
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-brown/27"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">Password</label>
              <div className="flex items-center justify-between h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <div className="flex items-center gap-3">
                  <Lock size={18} className="text-brown/33" />
                  <input
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="text-sm bg-transparent outline-none placeholder:text-brown/27"
                  />
                </div>
                <EyeOff size={18} className="text-brown/27 cursor-pointer" />
              </div>
              {/* Strength bar */}
              {password && (
                <>
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-1 rounded"
                        style={{ backgroundColor: i <= strength.score ? strength.color : '#e5e1d8' }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px]" style={{ color: strength.color }}>
                    Password strength: {strength.label}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">Confirm Password</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-white rounded-xl border-[1.5px] border-beige">
                <Lock size={18} className="text-brown/33" />
                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-brown/27"
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex gap-2.5">
              <div className="w-[18px] h-[18px] rounded border-[1.5px] border-beige bg-white shrink-0 mt-0.5" />
              <span className="text-xs text-brown/53 leading-relaxed">
                I agree to the Terms of Service and Privacy Policy
              </span>
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="h-[50px] rounded-2xl bg-gradient-to-r from-amber to-[#A67C2E] text-white text-base font-semibold shadow-[0_4px_16px_rgba(139,105,20,0.2)] cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-beige" />
            <span className="text-xs text-brown/33">or</span>
            <div className="flex-1 h-px bg-beige" />
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={() => signIn('google')}
            className="h-12 rounded-xl bg-white border-[1.5px] border-beige flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span className="text-[#4285F4] text-lg font-bold">G</span>
            <span className="text-sm font-medium text-brown">Continue with Google</span>
          </button>

          {/* Sign In Link */}
          <div className="flex justify-center gap-1">
            <span className="text-[13px] text-brown/53">Already have an account?</span>
            <Link href="/login" className="text-[13px] font-semibold text-amber no-underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
