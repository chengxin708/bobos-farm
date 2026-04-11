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
            <span className="font-[family-name:var(--font-logo)] text-xl font-semibold text-[#F8F7F4] tracking-[0.01em]">
              Bobo&apos;s Farm
            </span>
            <span className="font-serif text-xs text-[#F8F7F4]/50 tracking-[0.05em]">
              波姐农家乐
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

          {/* Google Map */}
          <div className="w-full mt-2">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2949.8!2d-74.0878!3d41.7495!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89dd1f3e0e5e5e5d%3A0x0!2s891+Albany+Post+Rd%2C+New+Paltz%2C+NY+12561!5e0!3m2!1sen!2sus!4v1"
              width="100%"
              height="160"
              style={{ border: 0, borderRadius: '12px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Bobo's Farm location"
            />
            <p className="text-xs text-[#F8F7F4]/50 mt-2">
              891 Albany Post Rd, New Paltz, NY 12561
            </p>
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
