"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import {
  Settings as SettingsIcon,
  CreditCard,
  ListOrdered,
  MessageSquare,
  Bell,
} from 'lucide-react'

export default function Settings() {
  const t = useTranslations('admin.settings')
  const [activeTab, setActiveTab] = useState(1)

  const settingsTabs = [
    { icon: SettingsIcon, label: t('tabs.general') },
    { icon: CreditCard, label: t('tabs.booking') },
    { icon: ListOrdered, label: t('tabs.classification') },
    { icon: MessageSquare, label: t('tabs.ordering') },
    { icon: CreditCard, label: t('tabs.guestPolicies') },
    { icon: CreditCard, label: t('tabs.payment') },
    { icon: Bell, label: t('tabs.notifications') },
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
              onClick={() => setActiveTab(i)}
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
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-brown">{t('booking.title')}</h2>
            <p className="text-sm text-gray-text mt-1 mb-8">{t('booking.subtitle')}</p>

            {/* Deposit Amount */}
            <div className="mb-8">
              <label className="text-sm font-bold text-brown block mb-1">{t('booking.depositAmount')}</label>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-brown">$</span>
                <input
                  type="text"
                  defaultValue="250"
                  className="border-2 border-amber rounded-md px-3 py-2 text-sm w-32 font-semibold"
                />
              </div>
              <p className="text-xs text-gray-text">{t('booking.depositAmountHelp')}</p>
            </div>

            {/* Payment Timeout */}
            <div className="mb-8">
              <label className="text-sm font-bold text-brown block mb-1">{t('booking.paymentTimeout')}</label>
              <div className="flex items-center gap-2 mb-1">
                <input type="text" defaultValue="72" className="border border-beige rounded-md px-3 py-2 text-sm w-20" />
                <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">{t('booking.paymentTimeoutUnit')}</span>
              </div>
              <p className="text-xs text-gray-text">{t('booking.paymentTimeoutHelp')}</p>
            </div>

            {/* Max Advance Booking */}
            <div className="mb-8">
              <label className="text-sm font-bold text-brown block mb-1">{t('booking.maxAdvanceBooking')}</label>
              <div className="flex items-center gap-2 mb-1">
                <input type="text" defaultValue="6" className="border border-beige rounded-md px-3 py-2 text-sm w-20" />
                <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">{t('booking.maxAdvanceBookingUnit')}</span>
              </div>
              <p className="text-xs text-gray-text">{t('booking.maxAdvanceBookingHelp')}</p>
            </div>

            {/* Min Advance Booking */}
            <div className="mb-8">
              <label className="text-sm font-bold text-brown block mb-1">{t('booking.minAdvanceBooking')}</label>
              <div className="flex items-center gap-2 mb-1">
                <input type="text" defaultValue="1" className="border border-beige rounded-md px-3 py-2 text-sm w-20" />
                <span className="text-xs font-semibold text-brown bg-cream-bg px-3 py-2 rounded-md">{t('booking.minAdvanceBookingUnit')}</span>
              </div>
              <p className="text-xs text-gray-text">{t('booking.minAdvanceBookingHelp')}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-beige">
              <span className="text-xs text-amber font-medium">{t('footer.unsavedChanges')}</span>
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm text-brown border border-beige rounded-md">{t('footer.discard')}</button>
                <button className="px-4 py-2 text-sm bg-green text-white font-semibold rounded-md">{t('footer.saveChanges')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
