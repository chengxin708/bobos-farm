"use client"

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function CancellationPolicyPage() {
  const t = useTranslations('legal.cancellation')

  return (
    <div className="flex-1 bg-cream">
      <div className="max-w-[760px] mx-auto px-6 sm:px-12 py-16 lg:py-24">
        <h1 className="font-playfair text-[32px] lg:text-[40px] font-bold text-brown mb-2">
          {t('title')}
        </h1>
        <p className="text-sm text-brown/40 mb-10">{t('lastUpdated')}</p>

        <div className="flex flex-col gap-10">
          {/* Policy Overview */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('overview.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('overview.body')}</p>
          </section>

          {/* Refund Details */}
          <section>
            <div className="bg-white rounded-xl p-6 border border-beige flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green mt-2 shrink-0" />
                <div>
                  <p className="text-[15px] font-semibold text-brown">{t('refund.eligible.title')}</p>
                  <p className="text-sm text-brown/50 mt-1">{t('refund.eligible.desc')}</p>
                </div>
              </div>
              <div className="h-px bg-beige" />
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#DC3545] mt-2 shrink-0" />
                <div>
                  <p className="text-[15px] font-semibold text-brown">{t('refund.nonEligible.title')}</p>
                  <p className="text-sm text-brown/50 mt-1">{t('refund.nonEligible.desc')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* How to Cancel */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('howToCancel.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">
              {t('howToCancel.body')}{' '}
              <Link href="/reservations" className="text-amber font-medium no-underline hover:underline">
                {t('howToCancel.reservationsLink')}
              </Link>
            </p>
          </section>

          {/* Disputes */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('disputes.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('disputes.body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
