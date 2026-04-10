"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import {
  Settings as SettingsIcon,
  CreditCard,
  ListOrdered,
  MessageSquare,
  Bell,
  ShieldAlert,
  Wallet,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface SystemSetting {
  id: string
  key: string
  value: string
  description: string | null
}

type TabIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

// Map of setting keys to their tab index
const KEY_TAB_MAP: Record<string, TabIndex> = {
  deposit_amount: 1,
  payment_timeout_hours: 1,
  max_advance_booking_days: 1,
  cancellation_window_days: 2,
  guest_warning_threshold: 4,
  zelle_recipient: 5,
  zelle_recipient_name: 5,
}

// ── Component ──────────────────────────────────────────────────────

export default function Settings() {
  const t = useTranslations('admin.settings')
  const [activeTab, setActiveTab] = useState<TabIndex>(1)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current)
    }
  }, [])

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
    const changed: Record<string, string> = {}
    Object.keys(formValues).forEach(key => {
      if (formValues[key] !== originalValues[key]) {
        changed[key] = formValues[key]
      }
    })
    if (Object.keys(changed).length === 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })
      if (!res.ok) throw new Error('Failed to save')
      setOriginalValues({ ...formValues })
      setSaveSuccess(true)
      mutate()
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current)
      saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Save settings error:', err)
    } finally {
      setSaving(false)
    }
  }, [formValues, originalValues, mutate])

  const settingsTabs: { icon: typeof SettingsIcon; label: string }[] = [
    { icon: SettingsIcon, label: t('tabs.general') },
    { icon: CreditCard, label: t('tabs.booking') },
    { icon: ListOrdered, label: t('tabs.classification') },
    { icon: MessageSquare, label: t('tabs.ordering') },
    { icon: ShieldAlert, label: t('tabs.guestPolicies') },
    { icon: Wallet, label: t('tabs.payment') },
    { icon: Bell, label: t('tabs.notifications') },
  ]

  // ── Tab content renderers ──────────────────────────────────────

  function renderGeneralTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">General Settings</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">General configuration options. More settings coming soon.</p>
        <div className="text-sm text-gray-text bg-cream-bg rounded-lg p-6 text-center">
          General settings will be available in a future update.
        </div>
      </div>
    )
  }

  function renderBookingTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">{t('booking.title')}</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">{t('booking.subtitle')}</p>

        {/* Deposit Amount */}
        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">{t('booking.depositAmount')}</label>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-brown">$</span>
            <input
              type="number"
              value={formValues.deposit_amount ?? ''}
              onChange={e => updateField('deposit_amount', e.target.value)}
              className={`border-2 ${formValues.deposit_amount !== originalValues.deposit_amount ? 'border-amber' : 'border-beige'} rounded-md px-3 py-2 text-sm w-32 font-semibold`}
            />
          </div>
          <p className="text-xs text-gray-text">{t('booking.depositAmountHelp')}</p>
        </div>

        {/* Payment Timeout */}
        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">{t('booking.paymentTimeout')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.payment_timeout_hours ?? ''}
              onChange={e => updateField('payment_timeout_hours', e.target.value)}
              className={`border ${formValues.payment_timeout_hours !== originalValues.payment_timeout_hours ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-20`}
            />
            <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">{t('booking.paymentTimeoutUnit')}</span>
          </div>
          <p className="text-xs text-gray-text">{t('booking.paymentTimeoutHelp')}</p>
        </div>

        {/* Max Advance Booking */}
        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">{t('booking.maxAdvanceBooking')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.max_advance_booking_days ?? ''}
              onChange={e => updateField('max_advance_booking_days', e.target.value)}
              className={`border ${formValues.max_advance_booking_days !== originalValues.max_advance_booking_days ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-20`}
            />
            <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">{t('booking.maxAdvanceBookingUnit')}</span>
          </div>
          <p className="text-xs text-gray-text">{t('booking.maxAdvanceBookingHelp')}</p>
        </div>

        {/* Min Advance Booking — use a placeholder key for now since it may not exist */}
        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">{t('booking.minAdvanceBooking')}</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.min_advance_booking_days ?? '1'}
              onChange={e => updateField('min_advance_booking_days', e.target.value)}
              className={`border ${formValues.min_advance_booking_days !== originalValues.min_advance_booking_days ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-20`}
            />
            <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">{t('booking.minAdvanceBookingUnit')}</span>
          </div>
          <p className="text-xs text-gray-text">{t('booking.minAdvanceBookingHelp')}</p>
        </div>
      </div>
    )
  }

  function renderCancellationTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">Cancellation Settings</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">Configure cancellation policies and refund windows.</p>

        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">Cancellation Window</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.cancellation_window_days ?? ''}
              onChange={e => updateField('cancellation_window_days', e.target.value)}
              className={`border ${formValues.cancellation_window_days !== originalValues.cancellation_window_days ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-20`}
            />
            <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">days</span>
          </div>
          <p className="text-xs text-gray-text">Number of days before reservation date that cancellation is allowed with full refund.</p>
        </div>
      </div>
    )
  }

  function renderOrderingTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">Ordering Settings</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">Configure pre-ordering and menu settings.</p>
        <div className="text-sm text-gray-text bg-cream-bg rounded-lg p-6 text-center">
          Ordering settings will be available in a future update.
        </div>
      </div>
    )
  }

  function renderGuestPoliciesTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">Guest Policies</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">Configure guest warning thresholds and policies.</p>

        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">Guest Warning Threshold</label>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="number"
              value={formValues.guest_warning_threshold ?? ''}
              onChange={e => updateField('guest_warning_threshold', e.target.value)}
              className={`border ${formValues.guest_warning_threshold !== originalValues.guest_warning_threshold ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-20`}
            />
            <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">guests</span>
          </div>
          <p className="text-xs text-gray-text">Minimum number of guests below which a warning is shown during booking.</p>
        </div>
      </div>
    )
  }

  function renderPaymentTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">Payment Settings</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">Configure Zelle payment recipient information.</p>

        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">Zelle Recipient Name</label>
          <input
            type="text"
            value={formValues.zelle_recipient_name ?? ''}
            onChange={e => updateField('zelle_recipient_name', e.target.value)}
            className={`border ${formValues.zelle_recipient_name !== originalValues.zelle_recipient_name ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-full max-w-sm mb-1`}
            placeholder="Enter recipient name"
          />
          <p className="text-xs text-gray-text">Name displayed to customers during payment.</p>
        </div>

        <div className="mb-8">
          <label className="text-sm font-bold text-brown block mb-1">Zelle Recipient Email</label>
          <input
            type="email"
            value={formValues.zelle_recipient ?? ''}
            onChange={e => updateField('zelle_recipient', e.target.value)}
            className={`border ${formValues.zelle_recipient !== originalValues.zelle_recipient ? 'border-amber border-2' : 'border-beige'} rounded-md px-3 py-2 text-sm w-full max-w-sm mb-1`}
            placeholder="Enter Zelle email"
          />
          <p className="text-xs text-gray-text">Zelle email address where customers send deposit payments.</p>
        </div>
      </div>
    )
  }

  function renderNotificationsTab() {
    return (
      <div>
        <h2 className="text-xl font-bold text-brown">Notification Settings</h2>
        <p className="text-sm text-gray-text mt-1 mb-8">Configure email and notification preferences.</p>
        <div className="text-sm text-gray-text bg-cream-bg rounded-lg p-6 text-center">
          Notification settings will be available in a future update.
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
  ]

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex bg-cream-bg overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-[220px] bg-white border-r border-beige p-4 flex flex-col gap-1 shrink-0">
          <div className="text-lg font-bold text-brown mb-2">{t('sidebarTitle')}</div>
          <div className="text-xs text-gray-text mb-4">{t('sidebarSubtitle')}</div>
          {settingsTabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i as TabIndex)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${
                activeTab === i
                  ? 'bg-amber text-white font-semibold'
                  : 'text-brown hover:bg-cream-bg'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-auto flex flex-col">
          <div className="max-w-2xl flex-1">
            {!settings ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-gray-text">Loading settings...</span>
              </div>
            ) : (
              TAB_RENDERERS[activeTab]()
            )}
          </div>

          {/* Footer */}
          {settings && (
            <div className="max-w-2xl flex items-center justify-between pt-6 border-t border-beige">
              <span className={`text-xs font-medium ${hasChanges ? 'text-amber' : saveSuccess ? 'text-green' : 'text-transparent'}`}>
                {hasChanges ? t('footer.unsavedChanges') : saveSuccess ? 'Saved successfully!' : '.'}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleDiscard}
                  disabled={!hasChanges}
                  className={`px-4 py-2 text-sm border border-beige rounded-md ${hasChanges ? 'text-brown' : 'text-gray-text opacity-50'}`}
                >
                  {t('footer.discard')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className={`px-4 py-2 text-sm font-semibold rounded-md ${
                    hasChanges && !saving ? 'bg-green text-white' : 'bg-gray-200 text-gray-text'
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
