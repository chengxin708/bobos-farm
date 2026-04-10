'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')

  const links = [
    { label: t('links.menu'), href: '/menu' },
    { label: t('links.bookAYurt'), href: '/booking/date' },
    { label: t('links.aboutUs'), href: '/#about' },
    { label: t('links.gallery'), href: '/#gallery' },
    { label: t('links.contact'), href: '/#about' },
  ]

  return (
    <footer className="bg-[#1a1510] w-full">
      <div className="max-w-[1120px] mx-auto px-6 sm:px-12 lg:px-20">
        <div className="flex flex-col md:flex-row gap-12 md:gap-16 py-14 border-b border-white/6">
          <div className="flex flex-col gap-4 md:w-[280px]">
            <span className="font-playfair text-[20px] font-bold italic text-amber">Bobo&apos;s Farm</span>
            <span className="text-[11px] text-white/25 tracking-[0.12em]">{'\u6CE2\u59D0\u519C\u5BB6\u4E50'}</span>
            <p className="text-[13px] text-white/30 leading-[1.8] mt-1">
              {t('tagline')}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[11px] text-white/35 font-semibold tracking-[0.15em] uppercase mb-1">{t('quickLinks')}</span>
            {links.map((link) => (
              <Link key={link.href + link.label} href={link.href} className="text-[13px] text-white/45 no-underline hover:text-amber transition-colors duration-300">{link.label}</Link>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[11px] text-white/35 font-semibold tracking-[0.15em] uppercase mb-1">{t('visitUs')}</span>
            <span className="text-[13px] text-white/45">{t('address')}</span>
            <span className="text-[13px] text-white/45">{t('phone')}</span>
            <span className="text-[13px] text-white/45">{t('email')}</span>
            <p className="text-[12px] text-white/25 leading-[1.8] whitespace-pre-line mt-1">
              {t('hours')}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between h-12">
          <span className="text-[11px] text-white/20">{t('copyright')}</span>
          <span className="text-[11px] text-white/12 italic">{t('madeWith')}</span>
        </div>
      </div>
    </footer>
  )
}
