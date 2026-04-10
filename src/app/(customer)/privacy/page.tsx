"use client"

import { useTranslations } from 'next-intl'

export default function PrivacyPolicyPage() {
  const t = useTranslations('legal.privacy')

  return (
    <div className="flex-1 bg-cream">
      <div className="max-w-[760px] mx-auto px-6 sm:px-12 py-16 lg:py-24">
        <h1 className="font-playfair text-[32px] lg:text-[40px] font-bold text-brown mb-2">
          {t('title')}
        </h1>
        <p className="text-sm text-brown/40 mb-10">{t('lastUpdated')}</p>

        <div className="flex flex-col gap-10">
          {/* What We Collect */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('collect.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('collect.body')}</p>
          </section>

          {/* How We Use It */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('usage.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('usage.body')}</p>
          </section>

          {/* Data Storage */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('storage.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('storage.body')}</p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('rights.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('rights.body')}</p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-playfair text-xl font-bold text-brown mb-3">{t('contact.title')}</h2>
            <p className="text-[15px] text-brown/60 leading-[1.8]">{t('contact.body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
