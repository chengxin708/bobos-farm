"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Tent, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface YurtOption {
  name: string
  capacity: string
  desc: string
  status: 'available' | 'booked'
  image: string
  badgeKey: 'available' | 'booked'
}

const yurts: YurtOption[] = [
  {
    name: 'Golden Meadow',
    capacity: 'Up to 15 guests',
    desc: 'Our largest yurt with panoramic meadow views, wood-burning stove, and a private outdoor fire pit.',
    status: 'available',
    image: 'https://images.unsplash.com/photo-1618767689160-da3fb810aad7?w=500&q=80',
    badgeKey: 'available',
  },
  {
    name: 'Sunset Ridge',
    capacity: 'Up to 8 guests',
    desc: 'A cozy mid-size yurt perched on the ridge with stunning sunset views over the valley.',
    status: 'available',
    image: 'https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?w=500&q=80',
    badgeKey: 'available',
  },
  {
    name: 'Willow Creek',
    capacity: 'Up to 6 guests',
    desc: 'An intimate riverside yurt surrounded by willow trees, perfect for smaller gatherings.',
    status: 'booked',
    image: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=500&q=80',
    badgeKey: 'booked',
  },
]

export default function BookingYurtPage() {
  const t = useTranslations('booking.yurt')
  const tCommon = useTranslations('common')
  const [selected, setSelected] = useState(0)

  return (
    <>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 sm:px-10 lg:px-20 gap-8 overflow-y-auto">
        <div className="text-center">
          <h2 className="font-playfair text-[28px] font-bold text-brown">{t('title')}</h2>
          <p className="text-base text-brown/53 mt-2">{t('subtitle')}</p>
        </div>

        {/* Yurt Cards */}
        <div className="flex gap-6 w-full max-w-[1100px]">
          {yurts.map((yurt, i) => (
            <div
              key={yurt.name}
              onClick={() => yurt.status === 'available' && setSelected(i)}
              className={`flex-1 bg-white rounded-2xl overflow-hidden cursor-pointer transition-all relative ${
                selected === i ? 'ring-[3px] ring-amber shadow-[0_4px_24px_rgba(0,0,0,0.06)]' : 'shadow-[0_2px_16px_rgba(0,0,0,0.03)]'
              } ${yurt.status === 'booked' ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {/* Image */}
              <div className="h-[200px] overflow-hidden relative">
                <img src={yurt.image} alt={yurt.name} className="w-full h-full object-cover" />
                {/* Badge */}
                <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  yurt.status === 'available' ? 'bg-green text-white' : 'bg-gray-400 text-white'
                }`}>
                  <Tent size={12} /> {t(`status.${yurt.badgeKey}`)}
                </div>
                {/* Selected check */}
                {selected === i && (
                  <div className="absolute bottom-3 right-3 w-8 h-8 bg-amber rounded-full flex items-center justify-center">
                    <Check size={16} className="text-white" />
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col gap-2">
                <h3 className="font-playfair text-lg font-bold text-brown">{yurt.name}</h3>
                <div className="flex items-center gap-1.5 text-[13px] text-brown/60">
                  <Users size={14} /> {yurt.capacity}
                </div>
                <p className="text-[13px] text-brown/53 leading-relaxed">{yurt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 shrink-0 bg-white border-t border-beige flex items-center justify-between px-4 sm:px-10 lg:px-20">
        <Link href="/booking/date" className="no-underline flex items-center gap-2 px-4 py-2.5 text-[15px] font-medium text-brown">
          <ArrowLeft size={18} /> {tCommon('back')}
        </Link>
        <Link
          href="/booking/details"
          className="no-underline flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber to-[#A67C2E] text-white text-base font-semibold shadow-[0_4px_16px_rgba(139,105,20,0.2)]"
        >
          {tCommon('next')} <ArrowRight size={18} />
        </Link>
      </div>
    </>
  )
}
