'use client'

import Link from 'next/link'
import { Phone, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')

  const navLinks = [
    { label: t('links.home'), href: '/' },
    { label: t('links.menu'), href: '/menu' },
    { label: t('links.bookAVisit'), href: '/booking/date' },
    { label: t('links.reservations'), href: '/reservations' },
  ]

  const legalLinks = [
    { label: t('links.privacy'), href: '/privacy' },
    { label: t('links.terms'), href: '/terms' },
    { label: t('links.cancellation'), href: '/cancellation' },
  ]

  return (
    <footer className="bg-[#1A1208] w-full">
      <div className="max-w-[1200px] mx-auto px-6 py-10 md:py-16">

        {/* ── Mobile Layout ── */}
        <div className="flex flex-col gap-8 lg:hidden">
          {/* Logo */}
          <div className="text-center">
            <span className="font-[family-name:var(--font-logo)] text-2xl font-semibold text-[#F8F7F4] tracking-[0.01em]">
              Bobo&apos;s Farm
            </span>
            <p className="font-serif text-sm text-[#F8F7F4]/50 tracking-[0.05em] mt-1">
              波姐农家乐
            </p>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <a href="tel:+15162729999" className="flex items-center gap-3 text-[#F8F7F4] no-underline">
              <Phone size={16} className="text-[#6B7F5E] shrink-0" />
              <span className="text-sm">中文: (516) 272-9999</span>
            </a>
            <a href="tel:+19175020445" className="flex items-center gap-3 text-[#F8F7F4] no-underline">
              <Phone size={16} className="text-[#6B7F5E] shrink-0" />
              <span className="text-sm">English: (917) 502-0445</span>
            </a>
            <div className="flex items-start gap-3 text-[#F8F7F4]/60">
              <MapPin size={16} className="text-[#6B7F5E] shrink-0 mt-0.5" />
              <span className="text-sm">891 Albany Post Rd, New Paltz, NY 12561</span>
            </div>
          </div>

          {/* Map */}
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2949.8!2d-74.0878!3d41.7495!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89dd1f3e0e5e5e5d%3A0x0!2s891+Albany+Post+Rd%2C+New+Paltz%2C+NY+12561!5e0!3m2!1sen!2sus!4v1"
            width="100%"
            height="140"
            style={{ border: 0, borderRadius: '12px' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Bobo's Farm location"
          />

          {/* Legal + Copyright */}
          <div className="flex flex-col items-center gap-2 pt-4 border-t border-[#F8F7F4]/10">
            <div className="flex items-center gap-2 text-[11px] text-[#F8F7F4]/40">
              {legalLinks.map((link, i) => (
                <span key={link.href} className="flex items-center gap-2">
                  {i > 0 && <span>&middot;</span>}
                  <Link href={link.href} className="no-underline text-[#F8F7F4]/40 hover:text-[#6B7F5E] transition-colors">
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
            <span className="text-[11px] text-[#F8F7F4]/30">{t('copyright')}</span>
            <a
              href="https://lnfitservices.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#F8F7F4]/30 underline underline-offset-2 hover:text-[#6B7F5E] transition-colors"
            >
              Powered by LNF IT SERVICES 🔗
            </a>
          </div>
        </div>

        {/* ── Desktop Layout ── */}
        <div className="hidden lg:block">
          {/* Top row: 4 columns */}
          <div className="grid grid-cols-4 gap-8">
            {/* Col 1: Brand */}
            <div className="flex flex-col gap-3">
              <span className="font-[family-name:var(--font-logo)] text-2xl font-semibold text-[#F8F7F4] tracking-[0.01em]">
                Bobo&apos;s Farm
              </span>
              <span className="font-serif text-sm text-[#F8F7F4]/50 tracking-[0.05em]">
                波姐农家乐
              </span>
              <span className="text-xs text-[#F8F7F4]/40 leading-relaxed mt-1">
                Mongolian &amp; Northeastern Cuisine<br />
                Farm to Table · New Paltz, NY
              </span>
            </div>

            {/* Col 2: Navigation */}
            <div className="flex flex-col gap-3">
              <span className="text-xs text-[#F8F7F4]/40 uppercase tracking-widest mb-1">Navigate</span>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[#F8F7F4]/80 no-underline hover:text-[#6B7F5E] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Col 3: Contact */}
            <div className="flex flex-col gap-3">
              <span className="text-xs text-[#F8F7F4]/40 uppercase tracking-widest mb-1">Contact</span>
              <a href="tel:+15162729999" className="flex items-center gap-2.5 text-sm text-[#F8F7F4]/80 no-underline hover:text-[#6B7F5E] transition-colors">
                <Phone size={14} className="text-[#6B7F5E] shrink-0" />
                中文: (516) 272-9999
              </a>
              <a href="tel:+19175020445" className="flex items-center gap-2.5 text-sm text-[#F8F7F4]/80 no-underline hover:text-[#6B7F5E] transition-colors">
                <Phone size={14} className="text-[#6B7F5E] shrink-0" />
                EN: (917) 502-0445
              </a>
              <div className="flex items-start gap-2.5 text-sm text-[#F8F7F4]/60 mt-1">
                <MapPin size={14} className="text-[#6B7F5E] shrink-0 mt-0.5" />
                <span>891 Albany Post Rd<br />New Paltz, NY 12561</span>
              </div>
            </div>

            {/* Col 4: Map */}
            <div className="flex flex-col gap-3">
              <span className="text-xs text-[#F8F7F4]/40 uppercase tracking-widest mb-1">Find Us</span>
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
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#F8F7F4]/10">
            <div className="flex items-center gap-3 text-xs text-[#F8F7F4]/40">
              {legalLinks.map((link, i) => (
                <span key={link.href} className="flex items-center gap-3">
                  {i > 0 && <span>&middot;</span>}
                  <Link href={link.href} className="no-underline text-[#F8F7F4]/40 hover:text-[#6B7F5E] transition-colors">
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-[#F8F7F4]/30">{t('copyright')}</span>
              <a
                href="https://lnfitservices.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#F8F7F4]/30 underline underline-offset-2 hover:text-[#6B7F5E] transition-colors"
              >
                Powered by LNF IT SERVICES 🔗
              </a>
            </div>
          </div>
        </div>

      </div>
    </footer>
  )
}
