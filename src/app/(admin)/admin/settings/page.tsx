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
  Tag as TagIcon,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { MenuManagementContent } from '@/app/(admin)/admin/menu/page'

// ── Types ──────────────────────────────────────────────────────────

interface SystemSetting {
  id: string
  key: string
  value: string
  description: string | null
}

type TabIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

interface TagItem {
  id: string
  key: string
  nameEn: string
  nameZh: string | null
  color: string | null
  sortOrder: number
  isActive: boolean
}

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
  cancellation_window_days: 7,
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
  const t = useTranslations('admin.settings')
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
    return <p className="text-sm text-[#8C8478]">{t('pushUnsupported')}</p>
  }

  if (status === 'granted') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[#5B8C3E]" />
        <span className="text-sm text-[#5B8C3E] font-medium">{t('pushEnabled')}</span>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#DC3545]" />
          <span className="text-sm text-[#DC3545] font-medium">{t('pushBlocked')}</span>
        </div>
        <p className="text-xs text-[#8C8478]">
          {t('pushBlockedHelp')}
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
      {t('pushEnable')}
    </button>
  )
}

// ── Manual Refresh Button ──────────────────────────────────────────

function ManualRefreshButton() {
  const t = useTranslations('admin.settings')
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
          {t('newVersionAvailable')}
        </div>
      )}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 px-4 py-2 bg-[#1A1208] text-white text-sm font-medium rounded-lg border-0 cursor-pointer hover:bg-[#1A1208]/80 transition-colors disabled:opacity-50 w-fit"
      >
        {refreshing ? t('refreshing') : hasUpdate ? t('updateRefresh') : t('forceRefresh')}
      </button>
    </div>
  )
}

// ── Payment Methods Editor ─────────────────────────────────────────

function PaymentMethodsEditor() {
  const t = useTranslations('admin.settings')
  const [methods, setMethods] = useState<string[]>([])
  const [newMethod, setNewMethod] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(false)
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
    setSaveSuccess(false)
    setSaveError(false)
    try {
      const res = await fetch('/api/settings/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaveSuccess(true)
      if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current)
      saveMsgTimer.current = setTimeout(() => setSaveSuccess(false), 2000)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <div className="flex items-center gap-2 text-sm text-[#8C8478]">
          <Loader2 size={16} className="animate-spin" /> {t('paymentMethods.loading')}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
      <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('paymentMethods.title')}</h2>
      <p className="text-sm text-[#8C8478] mt-1 mb-6">
        {t('paymentMethods.description')}
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
              title={methods.length <= 1 ? t('paymentMethods.minRequired') : t('paymentMethods.remove')}
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
          placeholder={t('paymentMethods.placeholder')}
          className="flex-1 border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors max-w-xs"
        />
        <button
          onClick={handleAdd}
          disabled={!newMethod.trim() || methods.includes(newMethod.trim())}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6B7F5E] text-white hover:bg-[#5A6E4F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          {t('paymentMethods.add')}
        </button>
      </div>

      {/* Status message */}
      {(saving || saveSuccess || saveError) && (
        <p className={`text-xs mt-3 font-medium ${saveSuccess ? 'text-[#6B7F5E]' : saving ? 'text-[#8C8478]' : 'text-[#DC3545]'}`}>
          {saving ? t('paymentMethods.saving') : saveSuccess ? t('paymentMethods.saved') : t('paymentMethods.saveFailed')}
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
      setPwError(t('general.passwordMismatch'))
      return
    }
    if (newPassword.length < 8) {
      setPwError(t('general.passwordTooShort'))
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
        throw new Error(data?.error || t('general.passwordFailed'))
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess(true)
      if (pwSuccessTimerRef.current) clearTimeout(pwSuccessTimerRef.current)
      pwSuccessTimerRef.current = setTimeout(() => setPwSuccess(false), 3000)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t('general.passwordFailed'))
    } finally {
      setPwSaving(false)
    }
  }, [currentPassword, newPassword, confirmPassword, t])

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
    { icon: TagIcon, label: t('tabs.tags') },
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
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('general.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('general.subtitle')}</p>

        {/* Business Name */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.businessName')}</label>
          <input
            type="text"
            value={formValues.business_name ?? ''}
            onChange={e => updateField('business_name', e.target.value)}
            className={inputClass('business_name')}
            placeholder="Bobo's Farm"
          />
          <p className="text-xs text-[#8C8478] mt-1">{t('general.businessNameHelp')}</p>
        </div>

        {/* Business Email */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.businessEmail')}</label>
          <input
            type="email"
            value={formValues.business_email ?? ''}
            onChange={e => updateField('business_email', e.target.value)}
            className={inputClass('business_email')}
            placeholder="info@bobosfarm.com"
          />
          <p className="text-xs text-[#8C8478] mt-1">{t('general.businessEmailHelp')}</p>
        </div>

        {/* Business Phone */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.businessPhone')}</label>
          <input
            type="text"
            value={formValues.business_phone ?? ''}
            onChange={e => updateField('business_phone', e.target.value)}
            className={inputClass('business_phone')}
            placeholder="(555) 000-0000"
          />
          <p className="text-xs text-[#8C8478] mt-1">{t('general.businessPhoneHelp')}</p>
        </div>

        {/* Business Address */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.businessAddress')}</label>
          <input
            type="text"
            value={formValues.business_address ?? ''}
            onChange={e => updateField('business_address', e.target.value)}
            className={inputClass('business_address')}
            placeholder="891 Albany Post Rd, New Paltz, NY 12561"
          />
          <p className="text-xs text-[#8C8478] mt-1">{t('general.businessAddressHelp')}</p>
        </div>

        {/* Password Change Section */}
        <div className="border-t border-[#E8ECE4] pt-8 mt-4">
          <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('general.changePassword')}</h2>
          <p className="text-sm text-[#8C8478] mt-1 mb-6">{t('general.changePasswordHelp')}</p>

          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.currentPassword')}</label>
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
              <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(null) }}
                className="border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm w-full max-w-sm text-[#1A1208] focus:outline-none focus:border-[#6B7F5E] transition-colors"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-[#8C8478] mt-1">{t('general.passwordMinLength')}</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.confirmPassword')}</label>
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
              <p className="text-sm text-[#6B7F5E] font-medium">{t('general.passwordSuccess')}</p>
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
              {pwSaving ? t('general.updating') : t('general.updatePassword')}
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
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('cancellation.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('cancellation.subtitle')}</p>

        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('cancellation.windowLabel')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.cancellation_window_days ?? '7'}
              onChange={e => updateField('cancellation_window_days', e.target.value)}
              className={smallInputClass('cancellation_window_days')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">{t('cancellation.windowUnit')}</span>
          </div>
          <p className="text-xs text-[#8C8478]">{t('cancellation.windowHelp')}</p>
        </div>
      </div>
    )
  }

  function renderOrderingTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('ordering.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('ordering.subtitle')}</p>

        {/* Pre-order Deadline */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('ordering.deadlineLabel')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.preorder_deadline_days ?? ''}
              onChange={e => updateField('preorder_deadline_days', e.target.value)}
              className={smallInputClass('preorder_deadline_days')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">{t('ordering.deadlineUnit')}</span>
          </div>
          <p className="text-xs text-[#8C8478]">{t('ordering.deadlineHelp')}</p>
        </div>

      </div>
    )
  }

  function renderGuestPoliciesTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('guestPolicies.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('guestPolicies.subtitle')}</p>

        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('guestPolicies.thresholdLabel')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.guest_warning_threshold ?? ''}
              onChange={e => updateField('guest_warning_threshold', e.target.value)}
              className={smallInputClass('guest_warning_threshold')}
            />
            <span className="text-xs font-semibold text-[#1A1208] bg-[#F8F7F4] px-3 py-2 rounded-lg">{t('guestPolicies.thresholdUnit')}</span>
          </div>
          <p className="text-xs text-[#8C8478]">{t('guestPolicies.thresholdHelp')}</p>
        </div>
      </div>
    )
  }

  function renderPaymentTab() {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
          <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('payment.title')}</h2>
          <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('payment.subtitle')}</p>

          <div className="mb-8">
            <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('payment.zelleRecipientName')}</label>
            <input
              type="text"
              value={formValues.zelle_recipient_name ?? ''}
              onChange={e => updateField('zelle_recipient_name', e.target.value)}
              className={`${inputClass('zelle_recipient_name')} mb-1`}
              placeholder="Enter recipient name"
            />
            <p className="text-xs text-[#8C8478]">{t('payment.zelleRecipientNameHelp')}</p>
          </div>

          <div className="mb-8">
            <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('payment.zelleRecipientEmail')}</label>
            <input
              type="email"
              value={formValues.zelle_recipient ?? ''}
              onChange={e => updateField('zelle_recipient', e.target.value)}
              className={`${inputClass('zelle_recipient')} mb-1`}
              placeholder="Enter Zelle email"
            />
            <p className="text-xs text-[#8C8478]">{t('payment.zelleRecipientEmailHelp')}</p>
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
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('notifications.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-8">{t('notifications.subtitle')}</p>

        {/* Resend API Key */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('notifications.resendApiKey')}</label>
          <input
            type="password"
            value={formValues.resend_api_key ?? ''}
            onChange={e => updateField('resend_api_key', e.target.value)}
            className={`${inputClass('resend_api_key')} font-mono`}
            placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <p className="text-xs text-[#8C8478] mt-1">
            {t.rich('notifications.resendApiKeyHelp', {
              link: (chunks) => <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-[#6B7F5E] underline">{chunks}</a>,
            })}
          </p>
        </div>

        {/* Admin Notification Email */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('notifications.adminEmail')}</label>
          <input
            type="email"
            value={formValues.notification_email ?? ''}
            onChange={e => updateField('notification_email', e.target.value)}
            className={inputClass('notification_email')}
            placeholder="admin@bobosfarm.com"
          />
          <p className="text-xs text-[#8C8478] mt-1">{t('notifications.adminEmailHelp')}</p>
        </div>

        {/* Email Sender Name */}
        <div className="mb-8">
          <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('notifications.senderName')}</label>
          <input
            type="text"
            value={formValues.email_from_name ?? ''}
            onChange={e => updateField('email_from_name', e.target.value)}
            className={inputClass('email_from_name')}
            placeholder="Bobo's Farm"
          />
          <p className="text-xs text-[#8C8478] mt-1">{t('notifications.senderNameHelp')}</p>
        </div>

        {/* Toggle: Booking Confirmation */}
        <div className="mb-6 flex items-center justify-between max-w-sm">
          <div>
            <p className="text-sm font-semibold text-[#1A1208]">{t('notifications.bookingConfirmation')}</p>
            <p className="text-xs text-[#8C8478] mt-0.5">{t('notifications.bookingConfirmationHelp')}</p>
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
            <p className="text-sm font-semibold text-[#1A1208]">{t('notifications.paymentReminder')}</p>
            <p className="text-xs text-[#8C8478] mt-0.5">{t('notifications.paymentReminderHelp')}</p>
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
            <p className="text-sm font-semibold text-[#1A1208]">{t('notifications.adminNewBooking')}</p>
            <p className="text-xs text-[#8C8478] mt-0.5">{t('notifications.adminNewBookingHelp')}</p>
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
          <h3 className="text-base font-semibold text-[#1A1208] font-serif mb-2">{t('notifications.pushTitle')}</h3>
          <p className="text-xs text-[#8C8478] mb-4">{t('notifications.pushDescription')}</p>
          <PushPermissionButton />
        </div>

        {/* App Version & Manual Refresh */}
        <div className="border-t border-[#E8ECE4] pt-6 mt-6">
          <h3 className="text-base font-semibold text-[#1A1208] font-serif mb-2">{t('notifications.appVersionTitle')}</h3>
          <p className="text-xs text-[#8C8478] mb-4">{t('notifications.appVersionDescription')}</p>
          <ManualRefreshButton />
        </div>
      </div>
    )
  }

  const [showMenuOverlay, setShowMenuOverlay] = useState(false)

  function renderMenuTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('menuTab.title')}</h2>
        <p className="text-sm text-[#8C8478] mt-1 mb-6">{t('menuTab.description')}</p>
        <button
          onClick={() => setShowMenuOverlay(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6B7F5E] text-white text-sm font-semibold rounded-lg hover:bg-[#5A6E4F] transition-colors"
        >
          <UtensilsCrossed size={16} />
          {t('menuTab.manage')}
          <ChevronRight size={14} />
        </button>
      </div>
    )
  }

  // ── Tags management tab ────────────────────────────────────────

  const { data: tagsData, mutate: mutateTags } = useSWR<TagItem[]>('/api/tags', fetcher, { revalidateOnFocus: false })
  const tagsList = tagsData || []
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [tagForm, setTagForm] = useState({ nameEn: '', nameZh: '', color: '', key: '' })
  const [addingTag, setAddingTag] = useState(false)
  const [savingTag, setSavingTag] = useState(false)

  const startEditTag = (tag: TagItem) => {
    setEditingTagId(tag.id)
    setTagForm({ nameEn: tag.nameEn, nameZh: tag.nameZh || '', color: tag.color || '', key: tag.key })
    setAddingTag(false)
  }

  const startAddTag = () => {
    setAddingTag(true)
    setEditingTagId(null)
    setTagForm({ nameEn: '', nameZh: '', color: 'bg-[#E8ECE4] text-[#6B7F5E]', key: '' })
  }

  const cancelEditTag = () => {
    setEditingTagId(null)
    setAddingTag(false)
  }

  const saveTag = async () => {
    if (!tagForm.nameEn.trim()) return
    setSavingTag(true)
    try {
      if (addingTag) {
        const key = tagForm.nameEn.trim().toLowerCase().replace(/\s+/g, '-')
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, nameEn: tagForm.nameEn.trim(), nameZh: tagForm.nameZh.trim() || null, color: tagForm.color || null }),
        })
      } else if (editingTagId) {
        await fetch(`/api/tags/${editingTagId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nameEn: tagForm.nameEn.trim(), nameZh: tagForm.nameZh.trim() || null, color: tagForm.color || null }),
        })
      }
      await mutateTags()
      cancelEditTag()
    } catch { /* ignore */ }
    finally { setSavingTag(false) }
  }

  const deleteTag = async (id: string) => {
    if (!confirm(t('tagsTab.confirmDelete'))) return
    await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    mutateTags()
  }

  const toggleTagActive = async (tag: TagItem) => {
    await fetch(`/api/tags/${tag.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !tag.isActive }),
    })
    mutateTags()
  }

  const TAG_COLORS = [
    { label: 'Green', value: 'bg-[#E8ECE4] text-[#6B7F5E]' },
    { label: 'Gold', value: 'bg-[#FEF3CD] text-[#8B6914]' },
    { label: 'Purple', value: 'bg-[#F3E8FF] text-[#7C3AED]' },
    { label: 'Orange', value: 'bg-[#FFF3E0] text-[#E65100]' },
    { label: 'Pink', value: 'bg-[#FCE7F3] text-[#DB2777]' },
    { label: 'Blue', value: 'bg-[#DBEAFE] text-[#1D4ED8]' },
    { label: 'Gray', value: 'bg-gray-100 text-gray-500' },
  ]

  function renderTagsTab() {
    return (
      <div className="bg-white rounded-xl border border-[#E8ECE4] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-[#1A1208] font-serif">{t('tagsTab.title')}</h2>
            <p className="text-sm text-[#8C8478] mt-1">{t('tagsTab.description')}</p>
          </div>
          <button
            onClick={startAddTag}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#6B7F5E] text-white text-sm font-semibold rounded-lg hover:bg-[#5A6E4F] transition-colors"
          >
            <Plus size={14} />
            {t('tagsTab.add')}
          </button>
        </div>

        {/* Add form */}
        {addingTag && (
          <div className="bg-[#F8F7F4] rounded-lg p-4 mb-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#2C2416] mb-1 block">EN</label>
                <input
                  value={tagForm.nameEn}
                  onChange={(e) => setTagForm(f => ({ ...f, nameEn: e.target.value }))}
                  className="w-full border border-[#E8ECE4] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#6B7F5E]"
                  placeholder="Signature"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#2C2416] mb-1 block">ZH</label>
                <input
                  value={tagForm.nameZh}
                  onChange={(e) => setTagForm(f => ({ ...f, nameZh: e.target.value }))}
                  className="w-full border border-[#E8ECE4] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#6B7F5E]"
                  placeholder="招牌"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#2C2416] mb-1 block">{t('tagsTab.color')}</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setTagForm(f => ({ ...f, color: c.value }))}
                    className={`text-[11px] font-medium px-3 py-1 rounded-full ${c.value} ${tagForm.color === c.value ? 'ring-2 ring-[#6B7F5E] ring-offset-1' : ''}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={cancelEditTag} className="text-sm text-[#8C8478] px-3 py-1.5 rounded-lg hover:bg-[#E8ECE4]/50">
                {t('tagsTab.cancel')}
              </button>
              <button onClick={saveTag} disabled={savingTag || !tagForm.nameEn.trim()} className="text-sm font-semibold text-white bg-[#6B7F5E] px-4 py-1.5 rounded-lg hover:bg-[#5A6E4F] disabled:opacity-50">
                {savingTag ? '...' : t('tagsTab.save')}
              </button>
            </div>
          </div>
        )}

        {/* Tags list */}
        <div className="flex flex-col gap-1">
          {tagsList.map(tag => (
            <div key={tag.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${!tag.isActive ? 'opacity-50' : ''} hover:bg-[#F8F7F4] transition-colors`}>
              {editingTagId === tag.id ? (
                /* Inline edit */
                <>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      value={tagForm.nameEn}
                      onChange={(e) => setTagForm(f => ({ ...f, nameEn: e.target.value }))}
                      className="border border-[#E8ECE4] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#6B7F5E]"
                      autoFocus
                    />
                    <input
                      value={tagForm.nameZh}
                      onChange={(e) => setTagForm(f => ({ ...f, nameZh: e.target.value }))}
                      className="border border-[#E8ECE4] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#6B7F5E]"
                      placeholder="中文"
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap max-w-[180px]">
                    {TAG_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setTagForm(f => ({ ...f, color: c.value }))}
                        className={`w-5 h-5 rounded-full ${c.value.split(' ')[0]} ${tagForm.color === c.value ? 'ring-2 ring-[#6B7F5E] ring-offset-1' : 'ring-1 ring-[#E8ECE4]'}`}
                      />
                    ))}
                  </div>
                  <button onClick={saveTag} disabled={savingTag} className="p-1 rounded hover:bg-[#5B8C3E]/10 text-[#5B8C3E]"><Check size={14} /></button>
                  <button onClick={cancelEditTag} className="p-1 rounded hover:bg-[#DC3545]/10 text-[#DC3545]"><X size={14} /></button>
                </>
              ) : (
                /* Display mode */
                <>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${tag.color || 'bg-[#E8ECE4] text-[#6B7F5E]'}`}>
                    {tag.nameEn}
                  </span>
                  {tag.nameZh && <span className="text-sm text-[#8C8478]">{tag.nameZh}</span>}
                  <span className="text-[10px] text-[#D0CCC4] ml-auto font-mono">{tag.key}</span>
                  <button onClick={() => toggleTagActive(tag)} className={`text-[10px] px-2 py-0.5 rounded-full border ${tag.isActive ? 'border-[#5B8C3E]/30 text-[#5B8C3E]' : 'border-[#DC3545]/30 text-[#DC3545]'}`}>
                    {tag.isActive ? t('tagsTab.active') : t('tagsTab.inactive')}
                  </button>
                  <button onClick={() => startEditTag(tag)} className="p-1 rounded hover:bg-[#E8ECE4]/50 text-[#8C8478]"><Pencil size={12} /></button>
                  <button onClick={() => deleteTag(tag.id)} className="p-1 rounded hover:bg-[#DC3545]/10 text-[#DC3545]"><Trash2 size={12} /></button>
                </>
              )}
            </div>
          ))}

          {tagsList.length === 0 && (
            <div className="text-center py-8 text-sm text-[#8C8478]">{t('tagsTab.empty')}</div>
          )}
        </div>
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
    renderTagsTab,
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
        <div className="md:hidden w-full flex flex-col overflow-hidden">
          <div className="flex overflow-x-auto gap-1 p-3 border-b border-[#E8ECE4] bg-white shrink-0">
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
                  <span className="text-sm text-[#8C8478]">{t('loadingSettings')}</span>
                </div>
              ) : (
                TAB_RENDERERS[activeTab]()
              )}
            </div>

            {/* Mobile Footer */}
            {settings && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#E8ECE4]">
                <span className={`text-xs font-medium ${saveError ? 'text-[#DC3545]' : hasChanges ? 'text-[#6B7F5E]' : saveSuccess ? 'text-[#6B7F5E]' : 'text-transparent'}`}>
                  {saveError || (hasChanges ? t('footer.unsavedChanges') : saveSuccess ? t('savedSuccessfully') : '.')}
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
                    {saving ? t('saving') : t('footer.saveChanges')}
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
                <span className="text-sm text-[#8C8478]">{t('loadingSettings')}</span>
              </div>
            ) : (
              TAB_RENDERERS[activeTab]()
            )}
          </div>

          {/* Footer */}
          {settings && (
            <div className="max-w-2xl mx-auto w-full flex items-center justify-between pt-6 border-t border-[#E8ECE4]">
              <span className={`text-xs font-medium ${saveError ? 'text-[#DC3545]' : hasChanges ? 'text-[#6B7F5E]' : saveSuccess ? 'text-[#6B7F5E]' : 'text-transparent'}`}>
                {saveError || (hasChanges ? t('footer.unsavedChanges') : saveSuccess ? t('savedSuccessfully') : '.')}
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
                  {saving ? t('saving') : t('footer.saveChanges')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Management fullscreen overlay */}
      {showMenuOverlay && (
        <div className="fixed inset-0 z-50 bg-[#F8F7F4] flex flex-col">
          <MenuManagementContent onClose={() => setShowMenuOverlay(false)} />
        </div>
      )}
    </>
  )
}
