"use client"

import { useTranslations } from 'next-intl'

export default function TermsOfServicePage() {
  const t = useTranslations('legal.terms')

  return (
    <div className="flex-1 bg-cream">
      <div className="max-w-[760px] mx-auto px-6 sm:px-12 py-16 lg:py-24">
        <h1 className="font-playfair text-[32px] lg:text-[40px] font-bold text-brown mb-2">
          {t('title')}
        </h1>
        <p className="text-sm text-brown/40 mb-10">{t('lastUpdated')}</p>

        <div className="flex flex-col gap-10">
          {/* Acceptance */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('acceptance.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('acceptance.body')}</p>
          </section>

          {/* Booking & Cancellation */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('booking.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('booking.body')}</p>
          </section>

          {/* Deposits */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('deposits.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('deposits.body')}</p>
          </section>

          {/* Liability */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('liability.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('liability.body')}</p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('governingLaw.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('governingLaw.body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
