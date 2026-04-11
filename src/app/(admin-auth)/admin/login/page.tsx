"use client"

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        setIsLoading(false)
      } else {
        // Cookie is set. Use full page navigation.
        window.location.assign('/admin/dashboard')
      }
    } catch {
      setError('Something went wrong')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-[400px] w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-logo)] text-3xl text-[#2A1F14] mb-1">
            Bobo&apos;s Farm
          </h1>
          <p className="font-serif text-sm text-[#8C857A] mb-2">
            波姐农家乐
          </p>
          <span className="text-xs text-[#6B7F5E] font-medium tracking-wide">
            管理后台
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#DC3545]/10 text-[#DC3545] rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C857A] pointer-events-none" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-[52px] rounded-xl pl-11 pr-4 text-sm bg-white placeholder:text-[#8C857A] text-[#2A1F14] border border-[#E8ECE4] outline-none focus:border-[#6B7F5E] transition-colors"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C857A] pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-[52px] rounded-xl pl-11 pr-12 text-sm bg-white placeholder:text-[#8C857A] text-[#2A1F14] border border-[#E8ECE4] outline-none focus:border-[#6B7F5E] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 cursor-pointer"
            >
              {showPassword
                ? <Eye size={18} className="text-[#8C857A]" />
                : <EyeOff size={18} className="text-[#8C857A]" />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#6B7F5E] text-white rounded-full py-3 w-full text-base font-medium cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed transition-colors hover:bg-[#5A6E4F]"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-xs text-[#8C857A]/60 mt-6">
        &copy; 2026 Bobo&apos;s Farm
      </p>
    </div>
  )
}
