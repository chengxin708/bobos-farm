"use client"

import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import AdminTopBar from '@/components/admin/AdminTopBar'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSwUpdate } from '@/components/admin/ServiceWorkerRegistrar'
import {
  Settings as SettingsIcon,
  CreditCard,
  ListOrdered,
  MessageSquare,
  Bell,
  ShieldAlert,
  Wallet,
  UtensilsCrossed,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────

interface SystemSetting {
  id: string
  key: string
  value: string
  description: string | null
}

type TabIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

// Map of setting keys to their tab index
const KEY_TAB_MAP: Record<string, TabIndex> = {
  business_name: 0,
  business_email: 0,
  business_phone: 0,
  business_address: 0,
  deposit_amount: 1,
  payment_timeout_hours: 1,
  max_advance_booking_days: 1,
  min_advance_booking_days: 1,
  cancellation_window_days: 2,
  preorder_deadline_days: 3,
  guest_warning_threshold: 4,
  zelle_recipient: 5,
  zelle_recipient_name: 5,
  notification_email: 6,
  resend_api_key: 6,
  email_from_name: 6,
  email_booking_confirmation: 6,
  email_payment_reminder: 6,
  email_admin_new_booking: 6,
}

// ── Push Permission Button ─────────────────────────────────────────

function PushPermissionButton() {
  const [status, setStatus] = useState<'loading' | 'granted' | 'denied' | 'default' | 'unsupported'>('loading')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission as 'granted' | 'denied' | 'default')
  }, [])

  async function handleEnable() {
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission as 'granted' | 'denied' | 'default')

      if (permission === 'granted') {
        // Re-subscribe to push
        const reg = await navigator.serviceWorker.ready
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return

        const padding = '='.repeat((4 - vapidKey.length % 4) % 4)
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
            },
          }),
        })
      }
    } catch (err) {
      console.error('[Push] Permission request failed:', err)
    }
  }

  if (status === 'loading') return null

  if (status === 'unsupported') {
    return <p className="text-sm text-[#8C8478]">This browser does not support push notifications.</p>
  }

  if (status === 'granted') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[#5B8C3E]" />
        <span className="text-sm text-[#5B8C3E] font-medium">Push notifications enabled</span>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#DC3545]" />
          <span className="text-sm text-[#DC3545] font-medium">Push notifications blocked</span>
        </div>
        <p className="text-xs text-[#8C8478]">
          To re-enable, click the lock icon in your browser address bar → Site settings → Notifications → Allow
        </p>
      </div>
    )
  }

  // default — not yet asked
  return (
    <button
      onClick={handleEnable}
      className="px-4 py-2 bg-[#6B7F5E] text-white text-sm font-medium rounded-lg border-0 cursor-pointer hover:bg-[#5A6E4F] transition-colors"
    >
      Enable Push Notifications
    </button>
  )
}

// ── Manual Refresh Button ──────────────────────────────────────────

function ManualRefreshButton() {
  const { hasUpdate, forceRefresh } = useSwUpdate()
  const [refreshing, setRefreshing] = useState(false)

  function handleRefresh() {
    setRefreshing(true)
    forceRefresh()
    // If forceRefresh doesn't cause a reload within 3 seconds, force one
    setTimeout(() => window.location.reload(), 3000)
  }

  return (
    <div className="flex flex-col gap-3">
      {hasUpdate && (
        <div className="flex items-center gap-2 text-sm text-[#E67E22] font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-[#E67E22]" />
          New version available
        </div>
      )}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 px-4 py-2 bg-[#1A1208] text-white text-sm font-medium rounded-lg border-0 cursor-pointer hover:bg-[#1A1208]/80 transition-colors disabled:opacity-50 w-fit"
      >
        {refreshing ? 'Refreshing...' : hasUpdate ? 'Update & Refresh' : 'Force Refresh'}
      </button>
    </div>
  )
}

// ── Payment Methods Editor ─────────────────────────────────────────

function PaymentMethodsEditor() {
  const [methods, setMethods] = useState<string[]>([])
  const [newMethod, setNewMethod] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/settings/payment-methods')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: string[]) => { if (Array.isArray(data)) setMethods(data) })
      .catch(() => setMethods(['Zelle', 'Cash']))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return () => { if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current) }
  }, [])

  const handleAdd = () => {
    const trimmed = newMethod.trim()
    if (!trimmed || methods.includes(trimmed)) return
    const updated = [...methods, trimmed]
    setMethods(updated)
    setNewMethod('')
    saveToServer(updated)
  }

  const handleRemove = (index: number) => {
    if (methods.length <= 1) return
    const updated = methods.filter((_, i) => i !== index)
    setMethods(updated)
    saveToServer(updated)
  }

  const saveToServer = async (data: string[]) => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/settings/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveMsg('Saved!')
      if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current)
      saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 2000)
    } catch {
      setSaveMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <div className="flex items-center gap-2 text-sm text-[#8C8478]">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
      <h2 className="text-base font-semibold text-[#1A1208] font-serif">Custom Payment Methods</h2>
      <p className="text-sm text-[#8C8478] mt-1 mb-6">
        Manage available payment methods shown during checkout.
      </p>

      {/* Current methods list */}
      <div className="space-y-2 mb-4">
        {methods.map((method, index) => (
          <div
            key={`${method}-${index}`}
            className="flex items-center justify-between bg-[#F8F7F4] rounded-lg px-4 py-2.5"
          >
            <span className="text-sm text-[#1A1208] font-medium">{method}</span>
            <button
              onClick={() => handleRemove(index)}
              disabled={methods.length <= 1}
              className="p-1 text-[#8C8478] hover:text-[#DC3545] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={methods.length <= 1 ? 'At least one payment method is required' : 'Remove'}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new method */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newMethod}
          onChange={e => setNewMethod(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="New payment method name"
          className="flex-1 border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors max-w-xs"
        />
        <button
          onClick={handleAdd}
          disabled={!newMethod.trim() || methods.includes(newMethod.trim())}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6B7F5E] text-white hover:bg-[#5A6E4F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Status message */}
      {(saving || saveMsg) && (
        <p className={`text-xs mt-3 font-medium ${saveMsg === 'Saved!' ? 'text-[#6B7F5E]' : saving ? 'text-[#8C8478]' : 'text-[#DC3545]'}`}>
          {saving ? 'Saving...' : saveMsg}
        </p>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────

export default function Settings() {
  const t = useTranslations('admin.settings')
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<TabIndex>(1)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const pwSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current)
      if (pwSuccessTimerRef.current) clearTimeout(pwSuccessTimerRef.current)
    }
  }, [])

  const handlePasswordChange = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }

    setPwSaving(true)
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update password')
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess(true)
      if (pwSuccessTimerRef.current) clearTimeout(pwSuccessTimerRef.current)
      pwSuccessTimerRef.current = setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setPwSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  const { data: settings, mutate } = useSWR<SystemSetting[]>('/api/settings', fetcher)

  // Initialize form values from fetched settings
  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {}
      settings.forEach(s => { vals[s.key] = s.value })
      setFormValues(vals)
      setOriginalValues(vals)
    }
  }, [settings])

  const hasChanges = useMemo(() => {
    return Object.keys(formValues).some(key => formValues[key] !== originalValues[key])
  }, [formValues, originalValues])

  const updateField = useCallback((key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
  }, [])

  const handleDiscard = useCallback(() => {
    setFormValues({ ...originalValues })
    setSaveSuccess(false)
  }, [originalValues])

  const handleSave = useCallback(async () => {
    if (saving) return
    const changed: Record<string, string> = {}
    Object.keys(formValues).forEach(key => {
      if (formValues[key] !== originalValues[key]) {
        changed[key] = formValues[key]
      }
    })
    if (Object.keys(changed).length === 0) return

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      setOriginalValues({ ...formValues })
      setSaveSuccess(true)
      mutate()
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current)
      saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Save settings error:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [formValues, originalValues, mutate, saving])

  const settingsTabs: { icon: typeof SettingsIcon; label: string }[] = [
    { icon: SettingsIcon, label: t('tabs.general') },
    { icon: CreditCard, label: t('tabs.booking') },
    { icon: ListOrdered, label: t('tabs.classification') },
    { icon: MessageSquare, label: t('tabs.ordering') },
    { icon: ShieldAlert, label: t('tabs.guestPolicies') },
    { icon: Wallet, label: t('tabs.payment') },
    { icon: Bell, label: t('tabs.notifications') },
    { icon: UtensilsCrossed, label: t('tabs.menu') },
  ]

  // ── Shared input style helper ──────────────────────────────────

  const inputClass = (key: string) =>
    `border ${formValues[key] !== originalValues[key] ? 'border-[#6B7F5E] border-2' : 'border-[#E8ECE4]'} rounded-lg px-3 py-2 text-sm w-full max-w-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors`

  const smallInputClass = (key: string) =>
    `border ${formValues[key] !== originalValues[key] ? 'border-[#6B7F5E] border-2' : 'border-[#E8ECE4]'} rounded-lg px-3 py-2 text-sm w-20 text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors`

  // ── Tab content renderers ──────────────────────────────────────

  function renderGeneralTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">General Settings</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">Business information and general configuration.</p>

        {/* Business Name */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Business Name</label>
          <input
            type="text"
            value={formValues.business_name ?? ''}
            onChange={e => updateField('business_name', e.target.value)}
            className={inputClass('business_name')}
            placeholder="Bobo's Farm"
          />
          <p className="text-xs text-[#8C8478] mt-1">Your business name as shown to customers.</p>
        </div>

        {/* Business Email */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Business Email</label>
          <input
            type="email"
            value={formValues.business_email ?? ''}
            onChange={e => updateField('business_email', e.target.value)}
            className={inputClass('business_email')}
            placeholder="info@bobosfarm.com"
          />
          <p className="text-xs text-[#8C8478] mt-1">Primary contact email for your business.</p>
        </div>

        {/* Business Phone */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Business Phone</label>
          <input
            type="text"
            value={formValues.business_phone ?? ''}
            onChange={e => updateField('business_phone', e.target.value)}
            className={inputClass('business_phone')}
            placeholder="(555) 000-0000"
          />
          <p className="text-xs text-[#8C8478] mt-1">Business phone number shown to customers.</p>
        </div>

        {/* Business Address */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Business Address</label>
          <input
            type="text"
            value={formValues.business_address ?? ''}
            onChange={e => updateField('business_address', e.target.value)}
            className={inputClass('business_address')}
            placeholder="123 Farm Road, Hudson Valley, NY"
          />
          <p className="text-xs text-[#8C8478] mt-1">Physical address of your business.</p>
        </div>

        {/* Password Change Section */}
        <div className="border-t border-[#E8ECE4] pt-8 mt-4">
          <h2 className="text-base font-semibold text-[#1A1208] font-serif">Change Password</h2>
          <p className="text-sm text-[#8C8478] mt-1 mb-6">Update your account password.</p>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-[#1A1208] block mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPwError(null) }}
                className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full max-w-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors"
                required
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1A1208] block mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(null) }}
                className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full max-w-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-[#8C8478] mt-1">Must be at least 8 characters.</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1A1208] block mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPwError(null) }}
                className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full max-w-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {pwError && (
              <p className="text-sm text-[#DC3545] font-medium">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-sm text-[#6B7F5E] font-medium">Password updated successfully!</p>
            )}

            <button
              type="submit"
              disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
              className={`bg-[#6B7F5E] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                pwSaving || !currentPassword || !newPassword || !confirmPassword
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-[#5A6E4F]'
              }`}
            >
              {pwSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  function renderBookingTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('booking.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('booking.subtitle')}</p>

        {/* Deposit Amount */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('booking.depositAmount')}</label>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-[#1A1208]">$</span>
            <input
              type="number"
              value={formValues.deposit_amount ?? ''}
              onChange={e => updateField('deposit_amount', e.target.value)}
              className={`border-2 ${formValues.deposit_amount !== originalValues.deposit_amount ? 'border-[#6B7F5E]' : 'border-[#E8ECE4]'} rounded-lg px-3 py-2 text-sm w-32 font-semibold text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors`}
            />
          </div>
          <p className="text-xs text-[#8C8478]">{t('booking.depositAmountHelp')}</p>
        </div>

        {/* Payment Timeout */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('booking.paymentTimeout')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.payment_timeout_hours ?? ''}
              onChange={e => updateField('payment_timeout_hours', e.target.value)}
              className={smallInputClass('payment_timeout_hours')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">{t('booking.paymentTimeoutUnit')}</span>
          </div>
          <p className="text-xs text-[#8C8478]">{t('booking.paymentTimeoutHelp')}</p>
        </div>

        {/* Max Advance Booking */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('booking.maxAdvanceBooking')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.max_advance_booking_days ?? ''}
              onChange={e => updateField('max_advance_booking_days', e.target.value)}
              className={smallInputClass('max_advance_booking_days')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">{t('booking.maxAdvanceBookingUnit')}</span>
          </div>
          <p className="text-xs text-[#8C8478]">{t('booking.maxAdvanceBookingHelp')}</p>
        </div>

        {/* Min Advance Booking */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('booking.minAdvanceBooking')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.min_advance_booking_days ?? '1'}
              onChange={e => updateField('min_advance_booking_days', e.target.value)}
              className={smallInputClass('min_advance_booking_days')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">{t('booking.minAdvanceBookingUnit')}</span>
          </div>
          <p className="text-xs text-[#8C8478]">{t('booking.minAdvanceBookingHelp')}</p>
        </div>
      </div>
    )
  }

  function renderCancellationTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">Cancellation Settings</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">Configure cancellation policies and refund windows.</p>

        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Cancellation Window</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.cancellation_window_days ?? ''}
              onChange={e => updateField('cancellation_window_days', e.target.value)}
              className={smallInputClass('cancellation_window_days')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">days</span>
          </div>
          <p className="text-xs text-[#8C8478]">Number of days before reservation date that cancellation is allowed with full refund.</p>
        </div>
      </div>
    )
  }

  function renderOrderingTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">Ordering Settings</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">Configure pre-ordering and menu settings.</p>

        {/* Pre-order Deadline */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Pre-order Deadline</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.preorder_deadline_days ?? ''}
              onChange={e => updateField('preorder_deadline_days', e.target.value)}
              className={smallInputClass('preorder_deadline_days')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">days before reservation</span>
          </div>
          <p className="text-xs text-[#8C8478]">Number of days before the reservation date that pre-orders must be placed.</p>
        </div>
      </div>
    )
  }

  function renderGuestPoliciesTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">Guest Policies</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">Configure guest warning thresholds and policies.</p>

        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Guest Warning Threshold</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.guest_warning_threshold ?? ''}
              onChange={e => updateField('guest_warning_threshold', e.target.value)}
              className={smallInputClass('guest_warning_threshold')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">guests</span>
          </div>
          <p className="text-xs text-[#8C8478]">Minimum number of guests below which a warning is shown during booking.</p>
        </div>
      </div>
    )
  }

  function renderPaymentTab() {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
          <h2 className="text-base font-semibold text-[#1A1208] font-serif">Payment Settings</h2>
          <p className="text-sm text-[#8C8478] mt-1 mb-8">Configure Zelle payment recipient information.</p>

          <div className="mb-8">
            <label className="text-sm font-semibold text-[#1A1208] block mb-1">Zelle Recipient Name</label>
            <input
              type="text"
              value={formValues.zelle_recipient_name ?? ''}
              onChange={e => updateField('zelle_recipient_name', e.target.value)}
              className={`${inputClass('zelle_recipient_name')} mb-1`}
              placeholder="Enter recipient name"
            />
            <p className="text-xs text-[#8C8478]">Name displayed to customers during payment.</p>
          </div>

          <div className="mb-8">
            <label className="text-sm font-semibold text-[#1A1208] block mb-1">Zelle Recipient Email</label>
            <input
              type="email"
              value={formValues.zelle_recipient ?? ''}
              onChange={e => updateField('zelle_recipient', e.target.value)}
              className={`${inputClass('zelle_recipient')} mb-1`}
              placeholder="Enter Zelle email"
            />
            <p className="text-xs text-[#8C8478]">Zelle email address where customers send deposit payments.</p>
          </div>
        </div>

        <PaymentMethodsEditor />
      </div>
    )
  }

  function renderNotificationsTab() {
    const toggleField = (key: string) => {
      const current = formValues[key] ?? 'true'
      updateField(key, current === 'true' ? 'false' : 'true')
    }

    const isEnabled = (key: string) => (formValues[key] ?? 'true') === 'true'

    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">Notification Settings</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">Configure email notification preferences.</p>

        {/* Resend API Key */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Resend API Key</label>
          <input
            type="password"
            value={formValues.resend_api_key ?? ''}
            onChange={e => updateField('resend_api_key', e.target.value)}
            className={`${inputClass('resend_api_key')} font-mono`}
            placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <p className="text-xs text-[#8C8478] mt-1">
            从 <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-[#6B7F5E] underline">resend.com</a> 获取 API Key。保存后邮件通知即可生效。
          </p>
        </div>

        {/* Admin Notification Email */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Admin Notification Email</label>
          <input
            type="email"
            value={formValues.notification_email ?? ''}
            onChange={e => updateField('notification_email', e.target.value)}
            className={inputClass('notification_email')}
            placeholder="admin@bobosfarm.com"
          />
          <p className="text-xs text-[#8C8478] mt-1">Admin alerts (new bookings, deposit submissions) will be sent to this address.</p>
        </div>

        {/* Email Sender Name */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">Email Sender Name</label>
          <input
            type="text"
            value={formValues.email_from_name ?? ''}
            onChange={e => updateField('email_from_name', e.target.value)}
            className={inputClass('email_from_name')}
            placeholder="Bobo's Farm"
          />
          <p className="text-xs text-[#8C8478] mt-1">Display name shown in the email &ldquo;From&rdquo; field.</p>
        </div>

        {/* Toggle: Booking Confirmation */}
        <div className="mb-6 flex items-center justify-between max-w-sm">
          <div>
            <p className="text-sm font-semibold text-[#1A1208]">Booking Confirmation Email</p>
            <p className="text-xs text-[#8C8478] mt-0.5">Send confirmation email when a booking is created.</p>
          </div>
          <button
            type="button"
            onClick={() => toggleField('email_booking_confirmation')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              isEnabled('email_booking_confirmation') ? 'bg-[#6B7F5E]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                isEnabled('email_booking_confirmation') ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Toggle: Payment Reminder */}
        <div className="mb-6 flex items-center justify-between max-w-sm">
          <div>
            <p className="text-sm font-semibold text-[#1A1208]">Payment Reminder Email</p>
            <p className="text-xs text-[#8C8478] mt-0.5">Allow sending payment reminder emails to customers.</p>
          </div>
          <button
            type="button"
            onClick={() => toggleField('email_payment_reminder')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              isEnabled('email_payment_reminder') ? 'bg-[#6B7F5E]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                isEnabled('email_payment_reminder') ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Toggle: Admin New Booking Alert */}
        <div className="mb-6 flex items-center justify-between max-w-sm">
          <div>
            <p className="text-sm font-semibold text-[#1A1208]">Admin New Booking Alert</p>
            <p className="text-xs text-[#8C8478] mt-0.5">Send notification to admin when a new booking is created.</p>
          </div>
          <button
            type="button"
            onClick={() => toggleField('email_admin_new_booking')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
              isEnabled('email_admin_new_booking') ? 'bg-[#6B7F5E]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                isEnabled('email_admin_new_booking') ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Push Notifications */}
        <div className="border-t border-[#E8ECE4] pt-6 mt-6">
          <h3 className="text-base font-semibold text-[#1A1208] font-serif mb-2">Push Notifications</h3>
          <p className="text-xs text-[#8C8478] mb-4">Receive instant push notifications on this device for new bookings and deposit submissions.</p>
          <PushPermissionButton />
        </div>

        {/* App Version & Manual Refresh */}
        <div className="border-t border-[#E8ECE4] pt-6 mt-6">
          <h3 className="text-base font-semibold text-[#1A1208] font-serif mb-2">App Version</h3>
          <p className="text-xs text-[#8C8478] mb-4">Clear all cached data and reload the latest version of the app.</p>
          <ManualRefreshButton />
        </div>
      </div>
    )
  }

  function renderMenuTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('menuTab.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-6">{t('menuTab.description')}</p>
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6B7F5E] text-white text-sm font-semibold rounded-lg hover:bg-[#5A6E4F] transition-colors no-underline"
        >
          <UtensilsCrossed size={16} />
          {t('menuTab.manage')}
          <ChevronRight size={14} />
        </Link>
      </div>
    )
  }

  const TAB_RENDERERS = [
    renderGeneralTab,
    renderBookingTab,
    renderCancellationTab,
    renderOrderingTab,
    renderGuestPoliciesTab,
    renderPaymentTab,
    renderNotificationsTab,
    renderMenuTab,
  ]

  return (
    <>
      {isMobile && <AdminTopBar title={t('title')} />}
      <div className="flex-1 flex overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-[220px] bg-white border-r border-[#E8ECE4] p-4 flex flex-col gap-1 shrink-0 hidden md:flex">
          <div className="text-lg font-semibold text-[#1A1208] font-serif mb-2">{t('sidebarTitle')}</div>
          <div className="text-xs text-[#8C8478] mb-4">{t('sidebarSubtitle')}</div>
          {settingsTabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i as TabIndex)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === i
                  ? 'bg-[#6B7F5E] text-white font-semibold'
                  : 'text-[#1A1208] hover:bg-[#F8F7F4]'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile tab selector */}
        <div className="md:hidden w-full">
          <div className="flex overflow-x-auto gap-1 p-3 border-b border-[#E8ECE4] bg-white">
            {settingsTabs.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i as TabIndex)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  activeTab === i
                    ? 'bg-[#6B7F5E] text-white font-semibold'
                    : 'text-[#1A1208] bg-[#F8F7F4]'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile content */}
          <div className="flex-1 p-4 overflow-auto flex flex-col">
            <div className="flex-1">
              {!settings ? (
                <div className="flex items-center justify-center py-12">
                  <span className="text-sm text-[#8C8478]">Loading settings...</span>
                </div>
              ) : (
                TAB_RENDERERS[activeTab]()
              )}
            </div>

            {/* Mobile Footer */}
            {settings && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#E8ECE4]">
                <span className={`text-xs font-medium ${saveError ? 'text-[#DC3545]' : hasChanges ? 'text-[#6B7F5E]' : saveSuccess ? 'text-[#6B7F5E]' : 'text-transparent'}`}>
                  {saveError || (hasChanges ? t('footer.unsavedChanges') : saveSuccess ? 'Saved successfully!' : '.')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleDiscard}
                    disabled={!hasChanges}
                    className={`px-3 py-1.5 text-sm border border-[#E8ECE4] rounded-lg transition-colors ${hasChanges ? 'text-[#1A1208]' : 'text-[#8C8478] opacity-50'}`}
                  >
                    {t('footer.discard')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                      hasChanges && !saving ? 'bg-[#6B7F5E] text-white hover:bg-[#5A6E4F]' : 'bg-gray-200 text-[#8C8478]'
                    }`}
                  >
                    {saving ? 'Saving...' : t('footer.saveChanges')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Content */}
        <div className="flex-1 p-8 overflow-auto flex-col hidden md:flex">
          <div className="max-w-2xl mx-auto flex-1 w-full">
            {!settings ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-[#8C8478]">Loading settings...</span>
              </div>
            ) : (
              TAB_RENDERERS[activeTab]()
            )}
          </div>

          {/* Footer */}
          {settings && (
            <div className="max-w-2xl mx-auto w-full flex items-center justify-between pt-6 border-t border-[#E8ECE4]">
              <span className={`text-xs font-medium ${saveError ? 'text-[#DC3545]' : hasChanges ? 'text-[#6B7F5E]' : saveSuccess ? 'text-[#6B7F5E]' : 'text-transparent'}`}>
                {saveError || (hasChanges ? t('footer.unsavedChanges') : saveSuccess ? 'Saved successfully!' : '.')}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleDiscard}
                  disabled={!hasChanges}
                  className={`px-4 py-2 text-sm border border-[#E8ECE4] rounded-lg transition-colors ${hasChanges ? 'text-[#1A1208] hover:bg-[#F8F7F4]' : 'text-[#8C8478] opacity-50'}`}
                >
                  {t('footer.discard')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    hasChanges && !saving ? 'bg-[#6B7F5E] text-white hover:bg-[#5A6E4F]' : 'bg-gray-200 text-[#8C8478]'
                  }`}
                >
                  {saving ? 'Saving...' : t('footer.saveChanges')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
