'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')

  const leftLinks = [
    { label: t('links.home'), href: '/' },
    { label: t('links.menu'), href: '/menu' },
    { label: t('links.bookAVisit'), href: '/booking/date' },
  ]

  const rightLinks = [
    { label: t('links.reservations'), href: '/reservations' },
    { label: t('links.settings'), href: '/settings' },
  ]

  const legalLinks = [
    { label: t('links.privacy'), href: '/privacy' },
    { label: t('links.terms'), href: '/terms' },
    { label: t('links.cancellation'), href: '/cancellation' },
  ]

  return (
    <footer className="bg-[#1A1208] w-full">
      <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-16">
        {/* Mobile: vertical stack / Desktop: horizontal layout */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 md:gap-8">
          {/* Logo + Tagline */}
          <div className="flex flex-col gap-2">
            <span className="font-serif text-xl text-[#F8F7F4]">
              Bobo&apos;s Farm
            </span>
            <span className="text-xs text-[#F8F7F4]/50">
              Farm to Table &middot; Hudson Valley, NY
            </span>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-3 md:flex md:gap-8">
            {/* Left column */}
            <div className="flex flex-col gap-3">
              {leftLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[#F8F7F4] no-underline hover:text-[#6B7F5E] transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            {/* Right column */}
            <div className="flex flex-col gap-3">
              {rightLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[#F8F7F4] no-underline hover:text-[#6B7F5E] transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal + Copyright — stacked on mobile, right-aligned on desktop */}
          <div className="flex flex-col gap-3 md:items-end">
            <div className="flex items-center gap-1.5 text-xs text-[#F8F7F4]/50">
              {legalLinks.map((link, i) => (
                <span key={link.href} className="flex items-center gap-1.5">
                  {i > 0 && <span>&middot;</span>}
                  <Link
                    href={link.href}
                    className="no-underline text-[#F8F7F4]/50 hover:text-[#6B7F5E] transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
            <span className="text-xs text-[#F8F7F4]/50">
              {t('copyright')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
