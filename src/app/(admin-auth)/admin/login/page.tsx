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
    <div className="h-screen bg-[#1E1A14] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-[420px] shadow-2xl">
        {/* Title */}
        <h1 className="font-serif text-2xl text-[#2A1F14] text-center mb-1">
          Admin Portal
        </h1>
        <p className="text-sm text-[#8C857A] text-center mb-8">
          Bobo&apos;s Farm Management
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-[#C4453A] rounded-xl p-3 text-sm mb-4">
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
              style={{ border: '1px solid #E4DDD2', outline: 'none' }}
              className="w-full h-[52px] rounded-xl pl-11 pr-4 text-sm bg-white placeholder:text-[#8C857A] text-[#2A1F14] focus:!border-[#B8860B] transition-colors"
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
              style={{ border: '1px solid #E4DDD2', outline: 'none' }}
              className="w-full h-[52px] rounded-xl pl-11 pr-12 text-sm bg-white placeholder:text-[#8C857A] text-[#2A1F14] focus:!border-[#B8860B] transition-colors"
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
            className="bg-[#B8860B] text-white rounded-xl py-3 w-full text-base font-medium cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:bg-[#A0750A]"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
