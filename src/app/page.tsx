"use client"

import Link from 'next/link'
import { Phone, MapPin, Flame, Tent, Leaf, ArrowRight } from 'lucide-react'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import { useTranslations } from 'next-intl'

const galleryImages = [
  { url: 'https://images.unsplash.com/photo-1609534751961-f396ded2af99?w=600&q=80', h: 'h-[300px]' },
  { url: 'https://images.unsplash.com/photo-1590944015552-6a285311add8?w=600&q=80', h: 'h-[220px]' },
  { url: 'https://images.unsplash.com/photo-1563104307-944928bb174a?w=600&q=80', h: 'h-[220px]' },
  { url: 'https://images.unsplash.com/photo-1628178527736-45c6af90c95d?w=600&q=80', h: 'h-[300px]' },
  { url: 'https://images.unsplash.com/photo-1765290774520-5aed2d718aa3?w=600&q=80', h: 'h-[260px]' },
  { url: 'https://images.unsplash.com/photo-1762186541239-5eee85c08c57?w=600&q=80', h: 'h-[260px]' },
]

export default function Landing() {
  const t = useTranslations('landing')

  const highlights = [
    { icon: Flame, title: t('highlights.lamb.title'), desc: t('highlights.lamb.desc'), accent: '#B8860B' },
    { icon: Tent, title: t('highlights.yurt.title'), desc: t('highlights.yurt.desc'), accent: '#C06B3E' },
    { icon: Leaf, title: t('highlights.farm.title'), desc: t('highlights.farm.desc'), accent: '#5E7D4E' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* ── Hero — dark, immersive, cinematic ── */}
      <section className="relative h-screen min-h-[680px] max-h-[1000px] w-full overflow-hidden bg-[#1a1510]">
        <img
          src="https://images.unsplash.com/photo-1767447612225-a281f76abdb7?w=1440&q=80"
          alt="Farm landscape"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510] via-[#1a1510]/40 to-transparent" />

        <div className="relative z-10 flex flex-col items-center justify-end h-full pb-[14vh] px-6 sm:px-16 lg:px-20">
          <div className="flex flex-col items-center gap-6 max-w-[720px] text-center">
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase text-amber/80 animate-fade-in-up">
              Gardiner, New York · By Appointment Only
            </p>
            <h1 className="font-playfair text-[32px] sm:text-[44px] lg:text-[56px] font-bold text-white leading-[1.1] tracking-[-0.01em] animate-fade-in-up stagger-1">
              {t('hero.title')}
            </h1>
            <p className="text-[15px] sm:text-[17px] text-white/60 leading-[1.8] max-w-[520px] animate-fade-in-up stagger-2">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4 animate-fade-in-up stagger-3">
              <Link
                href="/booking/date"
                className="btn-warm no-underline inline-flex items-center gap-2 px-8 py-3.5 rounded-md bg-amber text-white text-[14px] font-semibold tracking-wide"
              >
                {t('hero.bookVisit')} <ArrowRight size={16} />
              </Link>
              <Link
                href="/menu"
                className="no-underline inline-flex items-center gap-2 px-8 py-3.5 rounded-md border border-white/20 text-white/80 text-[14px] font-medium tracking-wide hover:border-white/40 hover:text-white transition-all duration-300"
              >
                {t('hero.viewMenu')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── About — warm, editorial ── */}
      <section id="about" className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28 bg-[#FAF6F0]">
        <div className="max-w-[1120px] mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="w-full lg:w-[480px] h-[320px] lg:h-[440px] rounded-md overflow-hidden shrink-0 img-zoom animate-fade-in-up"
            style={{ boxShadow: '0 4px 24px rgba(42, 31, 20, 0.08)' }}
          >
            <img src="https://images.unsplash.com/photo-1763771056927-557d39cb5e02?w=800&q=80" alt="Farm" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-6 animate-fade-in-up stagger-2">
            <p className="text-[11px] font-semibold text-amber tracking-[0.25em] uppercase">Our Story</p>
            <h2 className="font-playfair text-[30px] lg:text-[36px] font-bold text-brown leading-[1.2]">{t('about.title')}</h2>
            <div className="w-[40px] h-[2px] bg-amber/30 rounded-full" />
            <p className="text-[15px] text-brown/55 leading-[1.9]">{t('about.para1')}</p>
            <p className="text-[15px] text-brown/55 leading-[1.9]">{t('about.para2')}</p>
            <div className="flex flex-col gap-2.5 mt-3 pt-4 border-t border-beige/60">
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-amber/70" />
                <span className="text-[13px] text-brown/60">(516) 272-9999</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={14} className="text-amber/70" />
                <span className="text-[13px] text-brown/60">Gardiner, New York · Hudson Valley</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights — three pillars ── */}
      <section className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28 bg-white">
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <p className="text-[11px] font-semibold text-amber tracking-[0.25em] uppercase mb-4">The Experience</p>
            <h2 className="font-playfair text-[30px] lg:text-[36px] font-bold text-brown">{t('highlights.title')}</h2>
            <p className="text-[15px] text-brown/40 mt-4 max-w-[420px] mx-auto leading-[1.8]">{t('highlights.subtitle')}</p>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            {highlights.map((card, i) => (
              <div
                key={card.title}
                className={`card-warm flex-1 flex flex-col gap-5 bg-[#FAF6F0] rounded-md p-8 lg:p-10 animate-fade-in-up stagger-${i + 1}`}
              >
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: card.accent + '12' }}
                >
                  <card.icon size={20} style={{ color: card.accent }} strokeWidth={1.8} />
                </div>
                <h3 className="font-playfair text-[20px] font-bold text-brown leading-snug">{card.title}</h3>
                <p className="text-[14px] text-brown/45 leading-[1.8]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works — clean steps ── */}
      <section className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28 bg-[#FAF6F0]">
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <p className="text-[11px] font-semibold text-amber tracking-[0.25em] uppercase mb-4">How It Works</p>
            <h2 className="font-playfair text-[30px] lg:text-[36px] font-bold text-brown">{t('howItWorks.title')}</h2>
            <p className="text-[15px] text-brown/40 mt-4 max-w-[420px] mx-auto leading-[1.8]">{t('howItWorks.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: '01', title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.desc') },
              { num: '02', title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.desc') },
              { num: '03', title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.desc') },
              { num: '04', title: t('howItWorks.step4.title'), desc: t('howItWorks.step4.desc') },
            ].map((step, i) => (
              <div key={step.num} className={`flex flex-col gap-4 animate-fade-in-up stagger-${i + 1}`}>
                <span className="font-playfair text-[36px] font-bold text-amber/20">{step.num}</span>
                <h4 className="font-playfair text-[17px] font-bold text-brown">{step.title}</h4>
                <p className="text-[13px] text-brown/40 leading-[1.8]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery — masonry ── */}
      <section id="gallery" className="px-6 sm:px-12 lg:px-20 py-20 lg:py-28 bg-white">
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <p className="text-[11px] font-semibold text-amber tracking-[0.25em] uppercase mb-4">Gallery</p>
            <h2 className="font-playfair text-[30px] lg:text-[36px] font-bold text-brown">{t('gallery.title')}</h2>
            <p className="text-[15px] text-brown/40 mt-4">{t('gallery.subtitle')}</p>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-4">
              <div className={`gallery-item ${galleryImages[0].h} animate-fade-in-up stagger-1`}><img src={galleryImages[0].url} alt="" className="w-full h-full object-cover" /></div>
              <div className={`gallery-item ${galleryImages[1].h} animate-fade-in-up stagger-3`}><img src={galleryImages[1].url} alt="" className="w-full h-full object-cover" /></div>
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <div className={`gallery-item ${galleryImages[2].h} animate-fade-in-up stagger-2`}><img src={galleryImages[2].url} alt="" className="w-full h-full object-cover" /></div>
              <div className={`gallery-item ${galleryImages[3].h} animate-fade-in-up stagger-4`}><img src={galleryImages[3].url} alt="" className="w-full h-full object-cover" /></div>
            </div>
            <div className="flex-1 hidden sm:flex flex-col gap-4">
              <div className={`gallery-item ${galleryImages[4].h} animate-fade-in-up stagger-3`}><img src={galleryImages[4].url} alt="" className="w-full h-full object-cover" /></div>
              <div className={`gallery-item ${galleryImages[5].h} animate-fade-in-up stagger-5`}><img src={galleryImages[5].url} alt="" className="w-full h-full object-cover" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="relative py-24 overflow-hidden bg-[#1a1510]">
        <img
          src="https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1510]/80 to-[#1a1510]/60" />
        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase text-amber/70">Reserve Your Table</p>
          <h2 className="font-playfair text-[28px] sm:text-[36px] font-bold text-white max-w-[600px] leading-[1.2]">
            Gather your friends. <br className="hidden sm:block" />We&apos;ll roast the lamb.
          </h2>
          <Link
            href="/booking/date"
            className="btn-warm no-underline inline-flex items-center gap-2 px-8 py-3.5 rounded-md bg-amber text-white text-[14px] font-semibold tracking-wide mt-2"
          >
            Book Your Yurt <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
