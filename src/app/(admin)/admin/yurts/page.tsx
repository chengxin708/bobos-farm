"use client"

import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { Plus, Edit, Eye, Users, Bed, ChevronRight, AlertTriangle } from 'lucide-react'

interface Yurt {
  name: string
  description: string
  status: 'Active' | 'Maintenance'
  capacity: number
  beds: number
  amenities: string
  pricePerNight: string
  maintenanceNote?: string
}

const yurts: Yurt[] = [
  {
    name: 'Golden Meadow',
    description: 'A spacious luxury yurt nestled in golden meadow with a natural river view. Features modern heating, a private deck, and a beautiful setting.',
    status: 'Active',
    capacity: 6,
    beds: 3,
    amenities: '10 amenities, 3 exclusive',
    pricePerNight: '$365/night',
  },
  {
    name: 'Silver Creek',
    description: 'Cozy rustic cabin-style yurt near the peaceful Silver Creek. Equipped with all amenities for a serene glamping experience.',
    status: 'Active',
    capacity: 4,
    beds: 2,
    amenities: '8 amenities, 2 exclusive',
    pricePerNight: '$285/night',
    maintenanceNote: '🔧 Scheduled maintenance: Jan 15th – heater/AC, will be resolved before Feb 1st',
  },
  {
    name: 'Jade Valley',
    description: 'Tucked away in a lush valley surrounded by bamboo groves. Perfect for a couple or solo retreat with private garden area.',
    status: 'Maintenance',
    capacity: 2,
    beds: 1,
    amenities: '6 amenities',
    pricePerNight: '$185/night',
    maintenanceNote: '🔧 Water heater/electric issue, not a fire. Estimate repair by end of week.',
  },
]

export default function YurtManagement() {
  const t = useTranslations('admin.yurts')

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-brown">{t('title')}</h2>
            <p className="text-sm text-gray-text">{t('subtitle')}</p>
          </div>
          <button className="flex items-center gap-1.5 bg-amber text-white text-sm font-semibold px-4 py-2 rounded-md">
            <Plus size={14} /> {t('addYurt')}
          </button>
        </div>

        {/* Yurt Cards */}
        {yurts.map((yurt) => (
          <div key={yurt.name} className="bg-white rounded-xl border border-beige p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-brown">{yurt.name}</h3>
                <p className="text-sm text-gray-text mt-1 max-w-[600px]">{yurt.description}</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                yurt.status === 'Active' ? 'bg-light-green-bg text-green' : 'bg-light-yellow-bg text-amber'
              }`}>
                {yurt.status === 'Active' ? t('status.active') : t('status.maintenance')}
              </span>
            </div>

            {yurt.maintenanceNote && (
              <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FFE082] rounded-lg px-4 py-2.5">
                <AlertTriangle size={14} className="text-[#F4A623] shrink-0" />
                <span className="text-xs text-brown">{yurt.maintenanceNote}</span>
              </div>
            )}

            <div className="flex items-center gap-6 text-sm text-brown">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-gray-text" /> {t('capacity')} {yurt.capacity} {t('guests')}
              </span>
              <span className="flex items-center gap-1.5">
                <Bed size={14} className="text-gray-text" /> {yurt.beds} {t('beds')} • {yurt.amenities}
              </span>
              <span className="font-semibold text-amber">{yurt.pricePerNight}</span>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1.5 text-sm text-amber font-semibold">
                <Edit size={14} /> {t('actions.edit')}
              </button>
              <button className="flex items-center gap-1.5 text-sm text-brown">
                <Eye size={14} /> {t('actions.viewDetails')}
              </button>
              <ChevronRight size={14} className="text-gray-text" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
