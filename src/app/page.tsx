"use client"

import Link from 'next/link'
import { ChevronDown, Phone, MapPin, Flame, Tent, Leaf, Calendar, DollarSign, UtensilsCrossed, PartyPopper } from 'lucide-react'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import { useTranslations } from 'next-intl'

const galleryImages = [
  { url: 'https://images.unsplash.com/photo-1609534751961-f396ded2af99?w=600&q=80', h: 'h-[280px]' },
  { url: 'https://images.unsplash.com/photo-1590944015552-6a285311add8?w=600&q=80', h: 'h-[200px]' },
  { url: 'https://images.unsplash.com/photo-1563104307-944928bb174a?w=600&q=80', h: 'h-[200px]' },
  { url: 'https://images.unsplash.com/photo-1628178527736-45c6af90c95d?w=600&q=80', h: 'h-[280px]' },
  { url: 'https://images.unsplash.com/photo-1765290774520-5aed2d718aa3?w=600&q=80', h: 'h-[260px]' },
  { url: 'https://images.unsplash.com/photo-1762186541239-5eee85c08c57?w=600&q=80', h: 'h-[220px]' },
]

export default function Landing() {
  const t = useTranslations('landing')

  const highlights = [
    { icon: Flame, title: t('highlights.lamb.title'), desc: t('highlights.lamb.desc'), iconColor: '#9B7B2C' },
    { icon: Tent, title: t('highlights.yurt.title'), desc: t('highlights.yurt.desc'), iconColor: '#B8795A' },
    { icon: Leaf, title: t('highlights.farm.title'), desc: t('highlights.farm.desc'), iconColor: '#6B8F55' },
  ]

  const steps = [
    { icon: Calendar, title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.desc'), stroke: '#9B7B2C' },
    { icon: DollarSign, title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.desc'), stroke: '#6B8F55' },
    { icon: UtensilsCrossed, title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.desc'), stroke: '#B8795A' },
    { icon: PartyPopper, title: t('howItWorks.step4.title'), desc: t('howItWorks.step4.desc'), stroke: '#9B7B2C' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative h-[92vh] min-h-[640px] max-h-[960px] w-full overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1767447612225-a281f76abdb7?w=1440&q=80"
          alt="Farm landscape"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/60" />

        <div className="relative z-10 flex flex-col items-center justify-end h-full gap-8 px-6 sm:px-16 lg:px-[140px] pb-[12vh]">
          <h1 className="font-playfair text-3xl sm:text-[44px] lg:text-[58px] font-bold text-white text-center leading-[1.1] max-w-[800px] tracking-[-0.01em] animate-fade-in-up">
            {t('hero.title')}
          </h1>
          <p className="text-[15px] sm:text-[17px] text-white/75 text-center leading-[1.7] max-w-[560px] font-light tracking-wide animate-fade-in-up stagger-1">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-2 animate-fade-in-up stagger-2">
            <Link
              href="/booking/date"
              className="btn-warm no-underline px-10 py-[14px] rounded-lg bg-white text-brown text-[15px] font-semibold tracking-wide text-center"
            >
              {t('hero.bookVisit')}
            </Link>
            <Link
              href="/menu"
              className="btn-ghost no-underline px-10 py-[14px] rounded-lg border border-white/40 text-white text-[15px] font-medium tracking-wide text-center"
            >
              {t('hero.viewMenu')}
            </Link>
          </div>
        </div>

        <ChevronDown size={22} className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40" />
      </section>

      {/* ── About ── */}
      <section id="about" className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20 px-6 sm:px-16 lg:px-24 py-20 lg:py-32 bg-white">
        <div className="w-full lg:w-[520px] h-[300px] lg:h-[400px] rounded-lg overflow-hidden shrink-0 img-zoom animate-fade-in-up"
          style={{ boxShadow: '0 4px 32px rgba(0, 0, 0, 0.06)' }}
        >
          <img src="https://images.unsplash.com/photo-1763771056927-557d39cb5e02?w=800&q=80" alt="Farm" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-7 animate-fade-in-up stagger-2">
          <div>
            <p className="text-[11px] font-semibold text-amber tracking-[0.2em] uppercase mb-3">Our Story</p>
            <h2 className="font-playfair text-[32px] lg:text-[38px] font-bold text-brown leading-[1.15] tracking-[-0.01em]">{t('about.title')}</h2>
          </div>
          <div className="w-[48px] h-[1px] bg-beige" />
          <p className="text-[15px] text-brown/60 leading-[1.85] font-light">{t('about.para1')}</p>
          <p className="text-[15px] text-brown/60 leading-[1.85] font-light">{t('about.para2')}</p>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-3">
              <Phone size={14} className="text-amber" />
              <span className="text-[13px] text-brown/70 tracking-wide">{t('about.phone')}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={14} className="text-amber" />
              <span className="text-[13px] text-brown/70 tracking-wide">{t('about.location')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="flex flex-col items-center gap-16 px-6 sm:px-16 lg:px-24 py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="text-center animate-fade-in-up">
          <p className="text-[11px] font-semibold text-amber tracking-[0.2em] uppercase mb-4">Why Us</p>
          <h2 className="font-playfair text-[32px] lg:text-[38px] font-bold text-brown tracking-[-0.01em]">{t('highlights.title')}</h2>
          <p className="text-[15px] text-brown/45 mt-5 max-w-[440px] mx-auto leading-[1.7] font-light">{t('highlights.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-[1060px]">
          {highlights.map((card, i) => (
            <div
              key={card.title}
              className={`card-warm flex-1 flex flex-col items-center gap-6 bg-white rounded-lg p-10 border border-[#F0EDE8] animate-fade-in-up stagger-${i + 1}`}
            >
              <div className="w-12 h-12 rounded-full border border-[#EDEBE6] flex items-center justify-center">
                <card.icon size={22} style={{ color: card.iconColor }} strokeWidth={1.5} />
              </div>
              <h3 className="font-playfair text-xl font-bold text-brown text-center leading-snug tracking-[-0.01em]">{card.title}</h3>
              <p className="text-[14px] text-brown/45 text-center leading-[1.75] font-light">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="flex flex-col items-center gap-16 px-6 sm:px-16 lg:px-24 py-20 lg:py-28 bg-white">
        <div className="text-center animate-fade-in-up">
          <p className="text-[11px] font-semibold text-amber tracking-[0.2em] uppercase mb-4">Process</p>
          <h2 className="font-playfair text-[32px] lg:text-[38px] font-bold text-brown tracking-[-0.01em]">{t('howItWorks.title')}</h2>
          <p className="text-[15px] text-brown/45 mt-5 max-w-[440px] mx-auto leading-[1.7] font-light">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="relative w-full max-w-[960px]">
          <div className="absolute top-[24px] left-[12%] right-[12%] h-px bg-[#EDEBE6] hidden lg:block" />
          <div className="flex flex-wrap justify-center lg:justify-between gap-8 relative z-10">
            {steps.map((step, i) => (
              <div key={step.title} className={`flex flex-col items-center gap-5 w-[200px] animate-fade-in-up stagger-${i + 1}`}>
                <div
                  className="w-12 h-12 rounded-full border flex items-center justify-center bg-white transition-colors duration-300"
                  style={{ borderColor: step.stroke + '40' }}
                >
                  <step.icon size={20} style={{ color: step.stroke }} strokeWidth={1.5} />
                </div>
                <h4 className="font-playfair text-[17px] font-bold text-brown text-center tracking-[-0.01em]">{step.title}</h4>
                <p className="text-[13px] text-brown/40 text-center leading-[1.7] font-light">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery ── */}
      <section id="gallery" className="flex flex-col items-center gap-16 px-6 sm:px-16 lg:px-24 py-20 lg:py-28 bg-[#FAFAF7]">
        <div className="text-center animate-fade-in-up">
          <p className="text-[11px] font-semibold text-amber tracking-[0.2em] uppercase mb-4">Gallery</p>
          <h2 className="font-playfair text-[32px] lg:text-[38px] font-bold text-brown tracking-[-0.01em]">{t('gallery.title')}</h2>
          <p className="text-[15px] text-brown/45 mt-5">{t('gallery.subtitle')}</p>
        </div>
        <div className="flex gap-4 w-full max-w-[1100px]">
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
      </section>

      <Footer />
    </div>
  )
}
