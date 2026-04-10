"use client"

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft } from 'lucide-react'

export default function TermsOfServicePage() {
  const t = useTranslations('legal.terms')

  return (
    <div className="flex-1 bg-[#F8F7F4]">
      <div className="max-w-[680px] mx-auto px-4 py-12 lg:py-20">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[#8C8478] hover:text-[#6B7F5E] transition-colors no-underline mb-6"
        >
          <ChevronLeft size={16} />
          Back
        </Link>

        <h1 className="font-serif text-[32px] lg:text-[40px] font-bold text-[#1A1208] mb-2">
          {t('title')}
        </h1>
        <p className="text-sm text-[#8C8478] mb-10">{t('lastUpdated')}</p>

        <div className="space-y-8">
          {/* Acceptance */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('acceptance.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('acceptance.body')}</p>
          </section>

          {/* Booking & Cancellation */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('booking.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('booking.body')}</p>
          </section>

          {/* Deposits */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('deposits.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('deposits.body')}</p>
          </section>

          {/* Liability */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('liability.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('liability.body')}</p>
          </section>

          {/* Governing Law */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('governingLaw.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('governingLaw.body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
