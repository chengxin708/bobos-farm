"use client"

import { useState } from 'react'
import { Lock, EyeOff, ChevronDown, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function SettingsPage() {
  const t = useTranslations('customerSettings')
  const tCommon = useTranslations('common')

  const notificationKeys = [
    'reservationConfirmations',
    'orderReminders',
    'dayBeforeReminders',
    'promotionalOffers',
  ] as const

  const notificationDefaults = [true, true, true, false]

  const [toggles, setToggles] = useState(notificationDefaults)

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <div className="flex-1 flex flex-col items-center py-12 px-4 gap-6">
        <h1 className="font-playfair text-[32px] font-bold text-brown">{t('title')}</h1>

        <div className="w-[560px] flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-beige flex flex-col gap-5">
            {/* Avatar Row */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber flex items-center justify-center">
                <span className="text-2xl font-bold text-white">JS</span>
              </div>
              <span className="text-sm text-amber cursor-pointer">{t('profile.changePhoto')}</span>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.fullName')}</label>
                <div className="flex items-center h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input type="text" defaultValue="John Smith" className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.email')}</label>
                <div className="flex items-center gap-2 h-11 px-3 bg-[#F0EDE8] rounded-lg border border-beige">
                  <Lock size={16} className="text-[#8A8A8A]" />
                  <input type="email" defaultValue="john@example.com" disabled className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.phone')}</label>
                <div className="flex items-center h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input type="tel" defaultValue="+1 (555) 123-4567" className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('profile.language')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige cursor-pointer">
                  <span className="text-sm text-[#8A8A8A]">English</span>
                  <ChevronDown size={16} className="text-[#8A8A8A]" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="px-6 py-2.5 rounded-3xl bg-amber text-white text-sm font-medium border-none cursor-pointer">
                {tCommon('saveChanges')}
              </button>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl p-6 border border-beige flex flex-col gap-5">
            <h3 className="font-playfair text-lg font-bold text-brown">{t('password.title')}</h3>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('password.currentPassword')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input type="password" defaultValue="12345678" className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]" />
                  <EyeOff size={16} className="text-[#8A8A8A] cursor-pointer" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('password.newPassword')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input type="password" defaultValue="12345678" className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]" />
                  <EyeOff size={16} className="text-[#8A8A8A] cursor-pointer" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#F0EDE8] rounded-sm overflow-hidden">
                    <div className="h-full bg-green rounded-sm" style={{ width: '60%' }} />
                  </div>
                  <span className="text-xs text-green">{t('password.strength.good')}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brown">{t('password.confirmNewPassword')}</label>
                <div className="flex items-center justify-between h-11 px-3 bg-cream rounded-lg border border-beige">
                  <input type="password" defaultValue="12345678" className="flex-1 bg-transparent outline-none text-sm text-[#8A8A8A]" />
                  <EyeOff size={16} className="text-[#8A8A8A] cursor-pointer" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="px-6 py-2.5 rounded-3xl bg-white text-amber text-sm font-medium cursor-pointer" style={{ border: '1.5px solid #8B6914' }}>
                {t('password.updatePassword')}
              </button>
            </div>
          </div>

          {/* Email Notifications Card */}
          <div className="bg-white rounded-2xl p-6 border border-beige flex flex-col gap-5">
            <h3 className="font-playfair text-lg font-bold text-brown">{t('notifications.title')}</h3>

            <div className="flex flex-col">
              {notificationKeys.map((key, i) => (
                <div
                  key={key}
                  className={`flex items-center justify-between py-3.5 ${
                    i < notificationKeys.length - 1 ? 'border-b border-[#F0EDE8]' : ''
                  }`}
                >
                  <span className="text-sm text-brown">{t(`notifications.${key}`)}</span>
                  <button
                    onClick={() => setToggles((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                    className={`w-11 h-6 rounded-xl border-none cursor-pointer relative transition-colors ${
                      toggles[i] ? 'bg-amber' : 'bg-[#D9D1C7]'
                    }`}
                  >
                    <div
                      className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all"
                      style={{ left: toggles[i] ? '22px' : '2px' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-white rounded-2xl p-6 flex flex-col gap-3" style={{ borderLeft: '4px solid #DC3545', border: '1px solid #E8DFD0', borderLeftWidth: 4, borderLeftColor: '#DC3545' }}>
            <div className="flex items-center gap-2 py-2 cursor-pointer">
              <Trash2 size={16} className="text-[#DC3545]" />
              <span className="text-sm font-medium text-[#DC3545]">{t('danger.deleteAccount')}</span>
            </div>
            <p className="text-[13px] text-[#8A8A8A] leading-relaxed">
              {t('danger.deleteWarning')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
