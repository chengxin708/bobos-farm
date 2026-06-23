"use client"

import { useTranslations } from 'next-intl'
import { Phone, Wrench } from 'lucide-react'
import { LanguageToggle } from '@/components/customer/LanguageToggle'

// Chinese and English callers reach different lines, so — like the site
// footer and home page — we always show both numbers labeled, rather than
// picking one by locale. Kept in sync with src/components/customer/Footer.tsx.
const PHONES = [
  { label: '中文', display: '(516) 272-9999', tel: '+15162729999' },
  { label: 'English', display: '(917) 502-0445', tel: '+19175020445' },
] as const

/**
 * Full-screen notice shown in place of the booking / inquiry flow while
 * online booking is paused ("under development") from admin settings.
 * Rendered inside the focused-flow container in (customer)/layout.tsx.
 */
export default function BookingClosedNotice() {
  const t = useTranslations('bookingClosed')
  const tFooter = useTranslations('footer')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar mirrors the focused-flow header so the language toggle stays put */}
      <div className="shrink-0 bg-[#F8F7F4] px-4 py-3 flex items-center justify-end">
        <LanguageToggle />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-6 py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#EFE9DF] flex items-center justify-center mb-6">
          <Wrench size={28} className="text-[#6B7F5E]" />
        </div>

        <h1 className="font-serif text-2xl text-[#1A1208] mb-3">{t('title')}</h1>
        <p className="text-[15px] leading-relaxed text-[#6B6157] max-w-sm mb-8">{t('body')}</p>

        <div className="w-full max-w-xs flex flex-col gap-3">
          {PHONES.map((p) => (
            <a
              key={p.tel}
              href={`tel:${p.tel}`}
              className="flex items-center justify-center gap-2.5 bg-[#6B7F5E] text-white rounded-2xl px-5 py-3.5 no-underline font-medium shadow-[0_2px_8px_rgba(107,127,94,0.25)] active:scale-[0.98] transition-transform"
            >
              <Phone size={18} />
              <span>{p.label}: {p.display}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Footer: copyright + powered-by, mirrors Footer.tsx but tuned for the light background */}
      <footer className="shrink-0 px-6 py-5 flex flex-col items-center gap-1.5 border-t border-[#E8DFD2]">
        <span className="text-[11px] text-[#A89F92]">{tFooter('copyright')}</span>
        <a
          href="https://lnfitservices.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#A89F92] underline underline-offset-2 hover:text-[#6B7F5E] transition-colors"
        >
          Powered by LNF IT SERVICES 🔗
        </a>
      </footer>
    </div>
  )
}
