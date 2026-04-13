"use client"

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft } from 'lucide-react'

export default function CancellationPolicyPage() {
  const t = useTranslations('legal.cancellation')

  return (
    <div className="flex-1 bg-[#F8F7F4]">
      <div className="max-w-[680px] mx-auto px-4 py-12 lg:py-20">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[#6B6157] hover:text-[#6B7F5E] transition-colors no-underline mb-6"
        >
          <ChevronLeft size={16} />
          Back
        </Link>

        <h1 className="font-serif text-[32px] lg:text-[40px] font-bold text-[#1A1208] mb-2">
          {t('title')}
        </h1>
        <p className="text-sm text-[#6B6157] mb-10">{t('lastUpdated')}</p>

        <div className="space-y-8">
          {/* Policy Overview */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('overview.title')}</h2>
            <p className="text-base text-[#6B6157] leading-[1.8] font-sans">{t('overview.body')}</p>
          </section>

          {/* Refund Details */}
          <section className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-[#E8ECE4] flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#6B7F5E] mt-2 shrink-0" />
                <div>
                  <p className="text-base font-medium text-[#1A1208]">{t('refund.eligible.title')}</p>
                  <p className="text-sm text-[#6B6157] mt-1 leading-[1.8]">{t('refund.eligible.desc')}</p>
                </div>
              </div>
              <div className="h-px bg-[#E8ECE4]" />
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#C4453A] mt-2 shrink-0" />
                <div>
                  <p className="text-base font-medium text-[#1A1208]">{t('refund.nonEligible.title')}</p>
                  <p className="text-sm text-[#6B6157] mt-1 leading-[1.8]">{t('refund.nonEligible.desc')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* How to Cancel */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('howToCancel.title')}</h2>
            <p className="text-base text-[#6B6157] leading-[1.8] font-sans">
              {t('howToCancel.body')}{' '}
              <Link href="/reservations" className="text-[#6B7F5E] font-medium no-underline hover:underline">
                {t('howToCancel.reservationsLink')}
              </Link>
            </p>
          </section>

          {/* Disputes */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('disputes.title')}</h2>
            <p className="text-base text-[#6B6157] leading-[1.8] font-sans">{t('disputes.body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
