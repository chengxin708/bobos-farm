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
    <footer className="bg-brown w-full flex flex-col warm-grain">
      <div className="flex items-center justify-center gap-4 h-12 w-full">
        <div className="w-[200px] h-px" style={{ background: 'linear-gradient(to right, transparent, #5B4A3A)' }} />
        <Sprout size={20} className="text-green animate-gentle-float" />
        <div className="w-[200px] h-px" style={{ background: 'linear-gradient(to left, transparent, #5B4A3A)' }} />
      </div>
      <div className="flex gap-[60px] px-20 py-10">
        <div className="flex-1 flex flex-col gap-4">
          <span className="font-playfair text-2xl font-bold text-amber">Bobo&apos;s Farm</span>
          <span className="text-[13px] text-white/40 tracking-wide">波姐农家乐</span>
          <p className="text-sm text-white/53 leading-relaxed max-w-[260px] whitespace-pre-line">
            {t('tagline')}
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-3.5">
          <span className="text-[13px] text-white/60 font-semibold tracking-wide">{t('quickLinks')}</span>
          {links.map((link) => (
            <Link key={link.href + link.label} href={link.href} className="text-sm text-white/80 no-underline hover:text-amber hover:translate-x-1 transition-all duration-200">{link.label}</Link>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-3.5">
          <span className="text-[13px] text-white/60 font-semibold tracking-wide">{t('visitUs')}</span>
          <span className="text-sm text-white/80">{t('address')}</span>
          <span className="text-sm text-white/80">{t('phone')}</span>
          <span className="text-sm text-white/80">{t('email')}</span>
          <p className="text-[13px] text-white/47 leading-relaxed whitespace-pre-line">
            {t('hours')}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between h-14 px-20 border-t border-[#5B4A3A]">
        <span className="text-xs text-white/40">{t('copyright')}</span>
        <span className="text-xs text-white/27 italic">{t('madeWith')}</span>
      </div>
    </footer>
  )
}
