'use client'

import Link from 'next/link'
import { Sprout } from 'lucide-react'
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
    <footer className="bg-[#1E1A15] w-full flex flex-col">
      <div className="flex items-center justify-center gap-5 h-12 w-full">
        <div className="w-[160px] h-px bg-white/8" />
        <Sprout size={16} className="text-white/20" />
        <div className="w-[160px] h-px bg-white/8" />
      </div>
      <div className="flex flex-col md:flex-row gap-12 md:gap-[80px] px-8 sm:px-16 lg:px-24 py-12">
        <div className="flex flex-col gap-4">
          <span className="font-playfair text-xl font-bold text-amber tracking-wide">Bobo&apos;s Farm</span>
          <span className="text-[12px] text-white/30 tracking-[0.1em]">{'\u6CE2\u59D0\u519C\u5BB6\u4E50'}</span>
          <p className="text-[13px] text-white/35 leading-[1.8] max-w-[240px] font-light mt-2">
            {t('tagline')}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[11px] text-white/40 font-semibold tracking-[0.15em] uppercase">{t('quickLinks')}</span>
          {links.map((link) => (
            <Link key={link.href + link.label} href={link.href} className="text-[13px] text-white/55 no-underline hover:text-amber transition-colors duration-300 font-light">{link.label}</Link>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[11px] text-white/40 font-semibold tracking-[0.15em] uppercase">{t('visitUs')}</span>
          <span className="text-[13px] text-white/55 font-light">{t('address')}</span>
          <span className="text-[13px] text-white/55 font-light">{t('phone')}</span>
          <span className="text-[13px] text-white/55 font-light">{t('email')}</span>
          <p className="text-[12px] text-white/30 leading-[1.8] whitespace-pre-line font-light mt-1">
            {t('hours')}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between h-12 px-8 sm:px-16 lg:px-24 border-t border-white/6">
        <span className="text-[11px] text-white/25 font-light">{t('copyright')}</span>
        <span className="text-[11px] text-white/15 italic font-light">{t('madeWith')}</span>
      </div>
    </footer>
  )
}
