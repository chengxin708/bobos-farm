"use client"

import Link from 'next/link'
import { ArrowLeft, ArrowRight, User, Mail, Phone, Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function BookingDetailsPage() {
  const t = useTranslations('booking.details')
  const tCommon = useTranslations('common')

  return (
    <>
      {/* Content */}
      <div className="flex-1 flex justify-center py-10 px-20">
        <div className="w-[560px] bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-6">
          <div>
            <h2 className="font-playfair text-2xl font-bold text-brown">{t('title')}</h2>
            <p className="text-sm text-[#8E8E93] mt-1">{t('subtitle')}</p>
          </div>

          <div className="h-px bg-beige" />

          {/* Form Fields */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('contactName')}</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-[#FAFAF8] rounded-xl border border-beige">
                <User size={16} className="text-brown/40" />
                <input type="text" defaultValue="John Smith" className="flex-1 text-sm bg-transparent outline-none text-brown" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('email')}</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-[#FAFAF8] rounded-xl border border-beige">
                <Mail size={16} className="text-brown/40" />
                <input type="email" defaultValue="john@example.com" className="flex-1 text-sm bg-transparent outline-none text-brown" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-brown">{t('phoneNumber')}</label>
              <div className="flex items-center gap-3 h-12 px-4 bg-[#FAFAF8] rounded-xl border border-beige">
                <Phone size={16} className="text-brown/40" />
                <input type="tel" defaultValue="(555) 123-4567" className="flex-1 text-sm bg-transparent outline-none text-brown" />
              </div>
            </div>

            {/* Guest Counter */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-brown">{t('numberOfGuests')}</label>
              <div className="flex items-center justify-center gap-5">
                <button className="w-9 h-9 rounded-lg border border-beige flex items-center justify-center bg-white cursor-pointer">
                  <Minus size={16} className="text-brown" />
                </button>
                <span className="text-2xl font-bold text-brown w-10 text-center">4</span>
                <button className="w-9 h-9 rounded-lg border border-beige flex items-center justify-center bg-white cursor-pointer">
                  <Plus size={16} className="text-brown" />
                </button>
              </div>
            </div>

            {/* Capacity Notice */}
            <div className="bg-[#FEF3CD] rounded-lg p-4 flex flex-col gap-1">
              <p className="text-[13px] text-[#7A5D10] leading-relaxed">
                {t('capacityNotice')}
              </p>
              <a href="#" className="text-[13px] font-semibold text-amber no-underline self-end">{tCommon('gotItContinue')}</a>
            </div>

            {/* Special Requests */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[13px] font-semibold text-brown">{t('specialRequests')}</label>
                <span className="text-[11px] text-brown/40 italic">{tCommon('optional')}</span>
              </div>
              <textarea
                placeholder={t('specialRequestsPlaceholder')}
                className="h-24 px-4 py-3 bg-white rounded-xl border border-beige text-sm resize-none outline-none placeholder:text-brown/27"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-20 bg-white border-t border-beige flex items-center justify-between px-20">
        <Link href="/booking/yurt" className="no-underline flex items-center gap-2 px-4 py-2.5 text-[15px] font-medium text-brown">
          <ArrowLeft size={18} /> {tCommon('back')}
        </Link>
        <Link
          href="/booking/confirm"
          className="no-underline flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber to-[#A67C2E] text-white text-base font-semibold shadow-[0_4px_16px_rgba(139,105,20,0.2)]"
        >
          {tCommon('next')} <ArrowRight size={18} />
        </Link>
      </div>
    </>
  )
}
