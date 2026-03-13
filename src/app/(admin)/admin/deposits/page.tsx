"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { Calendar, MapPin, Users, Phone, Image as ImageIcon } from 'lucide-react'

interface DepositItem {
  name: string
  email: string
  dates: string
  yurt: string
  guests: number
  phone: string
  amount: string
  status: string
  image?: boolean
  expiresIn?: string
}

const pendingDeposits: DepositItem[] = [
  { name: 'John Smith', email: 'john.smith@email.com', dates: 'Mar 25 - Mar 28', yurt: 'Golden Meadow', guests: 13, phone: '(805) 555-0178', amount: '$250', status: 'pending', image: true },
  { name: 'Tom Wilson', email: 'tom.wilson@email.com', dates: 'Mar 30 - Mar 31', yurt: 'Silver Creek', guests: 11, phone: '(805) 555-0192', amount: '$190', status: 'pending', expiresIn: '15 min left' },
  { name: 'Anna Roberts', email: 'anna.roberts@email.com', dates: 'Mar 27 - Mar 30', yurt: 'Jade Valley', guests: 0, phone: '', amount: '', status: 'pending' },
]

const confirmedDeposits: DepositItem[] = [
  { name: 'Sarah Lee', email: 'sarah.lee@email.com', dates: 'Mar 20 - Mar 22', yurt: 'Silver Creek', guests: 2, phone: '(805) 555-0145', amount: '$150', status: 'confirmed' },
  { name: 'Ray Gupta', email: 'ray.gupta@email.com', dates: 'Mar 25 - Mar 28', yurt: 'Golden Meadow', guests: 4, phone: '(805) 555-0200', amount: '$250', status: 'confirmed' },
]

const refundedDeposits: DepositItem[] = [
  { name: 'Lisa Wang', email: 'lisa.wang@email.com', dates: 'Mar 22 - Mar 25', yurt: 'Golden Meadow', guests: 3, phone: '(805) 555-0161', amount: '$200', status: 'refunded' },
]

export default function Deposits() {
  const t = useTranslations('admin.deposits')
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    t('tabs.pending'),
    t('tabs.confirmed'),
    t('tabs.refunded'),
    t('tabs.expiringSoon'),
  ]

  const statCards = [
    { value: '5 ' + t('tabs.pending'), sub: t('stats.totalPending'), bg: 'bg-[#FEF3CD]', border: 'border-[#F4A623]' },
    { value: '$3,600 Collected', sub: t('stats.collectedThisMonth'), bg: 'bg-light-green-bg', border: 'border-green' },
    { value: '$300 Refunded', sub: t('stats.refundedThisMonth'), bg: 'bg-light-red-bg', border: 'border-red' },
  ]

  const getDeposits = () => {
    if (activeTab === 1) return confirmedDeposits
    if (activeTab === 2) return refundedDeposits
    return pendingDeposits
  }

  const getStatusLabel = (status: string) => {
    if (status === 'confirmed') return t('status.confirmed')
    if (status === 'refunded') return t('status.refunded')
    return t('status.pending')
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* Stat Cards */}
        <div className="flex gap-4">
          {statCards.map((card) => (
            <div key={card.value} className={`flex-1 ${card.bg} rounded-xl p-5 border-l-4 ${card.border}`}>
              <div className="text-lg font-bold text-brown">{card.value}</div>
              <div className="text-sm text-gray-text">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-beige">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === i ? 'border-amber text-amber' : 'border-transparent text-gray-text hover:text-brown'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Deposit Cards */}
        <div className="flex flex-col gap-4">
          {getDeposits().map((dep) => (
            <div key={dep.name} className="bg-white rounded-xl border border-beige p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-bold text-brown">{dep.name}</div>
                  <div className="text-sm text-gray-text">{dep.email}</div>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  dep.status === 'confirmed' ? 'bg-light-green-bg text-green' :
                  dep.status === 'refunded' ? 'bg-light-red-bg text-red' :
                  'bg-light-yellow-bg text-[#D4A017]'
                }`}>
                  {getStatusLabel(dep.status)}
                </span>
              </div>

              <div className="flex items-center gap-6 text-sm text-brown">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-text" /> {dep.dates}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-text" /> {dep.yurt}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-gray-text" /> {dep.guests} {t('card.guests')}
                </span>
              </div>

              {dep.phone && (
                <div className="flex items-center gap-1.5 text-sm text-brown">
                  <Phone size={14} className="text-gray-text" /> {t('card.depositPhone')} {dep.phone}
                </div>
              )}

              {dep.image && (
                <div className="flex items-center gap-4">
                  <div className="w-[120px] h-[80px] bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon size={24} className="text-gray-text" />
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="text-gray-text">{t('card.sentVia')} Zelle</span>
                    <span className="text-gray-text">{t('card.txnId')} Bobo123</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                {dep.status === 'pending' && (
                  <>
                    <button className="px-4 py-1.5 bg-green text-white text-sm font-semibold rounded-md">
                      {t('actions.confirmDeposit')}
                    </button>
                    <button className="px-4 py-1.5 bg-white text-brown text-sm font-semibold rounded-md border border-beige">
                      {t('actions.notReceived')}
                    </button>
                    <button className="px-4 py-1.5 bg-amber text-white text-sm font-semibold rounded-md">
                      {t('actions.remind')}
                    </button>
                  </>
                )}
                {dep.expiresIn && (
                  <span className="text-xs font-semibold text-red bg-light-red-bg px-2 py-0.5 rounded-full mr-auto">
                    {dep.expiresIn}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
