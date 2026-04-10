"use client"

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft } from 'lucide-react'

export default function PrivacyPolicyPage() {
  const t = useTranslations('legal.privacy')

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
          {/* What We Collect */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('collect.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('collect.body')}</p>
          </section>

          {/* How We Use It */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('usage.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('usage.body')}</p>
          </section>

          {/* Data Storage */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('storage.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('storage.body')}</p>
          </section>

          {/* Your Rights */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('rights.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('rights.body')}</p>
          </section>

          {/* Contact */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#1A1208]">{t('contact.title')}</h2>
            <p className="text-base text-[#8C8478] leading-[1.8] font-sans">{t('contact.body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
