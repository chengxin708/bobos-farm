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
    { icon: Flame, title: t('highlights.lamb.title'), desc: t('highlights.lamb.desc'), bg: 'bg-amber-light', iconColor: 'text-amber' },
    { icon: Tent, title: t('highlights.yurt.title'), desc: t('highlights.yurt.desc'), bg: 'bg-terracotta-light', iconColor: 'text-terracotta' },
    { icon: Leaf, title: t('highlights.farm.title'), desc: t('highlights.farm.desc'), bg: 'bg-green-light', iconColor: 'text-green' },
  ]

  const steps = [
    { icon: Calendar, title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.desc'), color: 'bg-amber-light', stroke: '#8B6914', num: '1' },
    { icon: DollarSign, title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.desc'), color: 'bg-green-light', stroke: '#5B8C3E', num: '2' },
    { icon: UtensilsCrossed, title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.desc'), color: 'bg-terracotta-light', stroke: '#C4724B', num: '3' },
    { icon: PartyPopper, title: t('howItWorks.step4.title'), desc: t('howItWorks.step4.desc'), color: 'bg-cream', stroke: '#8B6914', num: '4' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative h-[90vh] min-h-[600px] max-h-[900px] w-full overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1767447612225-a281f76abdb7?w=1440&q=80"
          alt="Farm landscape"
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ animation: 'fadeInScale 1.2s cubic-bezier(0.22, 1, 0.36, 1) both' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/70" />
        {/* Warm tint overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber/5 to-transparent" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-7 px-6 sm:px-16 lg:px-[120px]">
          <h1
            className="font-playfair text-3xl sm:text-[42px] lg:text-[56px] font-bold text-white text-center leading-[1.15] max-w-[850px] whitespace-pre-line drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)] animate-fade-in-up"
          >
            {t('hero.title')}
          </h1>
          <p className="text-base sm:text-lg text-white/85 text-center leading-relaxed max-w-[700px] animate-fade-in-up stagger-1">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in-up stagger-2">
            <Link
              href="/booking/date"
              className="btn-warm no-underline px-10 py-4 rounded-2xl bg-gradient-to-b from-[#A07818] to-amber text-white text-base font-semibold shadow-[0_4px_24px_rgba(139,105,20,0.35)] text-center"
            >
              {t('hero.bookVisit')}
            </Link>
            <Link
              href="/menu"
              className="btn-ghost no-underline px-10 py-4 rounded-2xl border-[1.5px] border-white/50 text-white text-base font-semibold text-center"
            >
              {t('hero.viewMenu')}
            </Link>
          </div>
        </div>

        <ChevronDown
          size={28}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 animate-bounce"
        />
      </section>

      {/* ── About ── */}
      <section id="about" className="warm-grain flex flex-col lg:flex-row items-center gap-8 lg:gap-16 px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <div className="w-full lg:w-[560px] h-[280px] lg:h-[420px] rounded-3xl overflow-hidden shrink-0 img-zoom animate-fade-in-up"
          style={{ boxShadow: '0 12px 48px rgba(61, 43, 31, 0.1), 0 4px 16px rgba(139, 105, 20, 0.06)' }}
        >
          <img src="https://images.unsplash.com/photo-1763771056927-557d39cb5e02?w=800&q=80" alt="Farm" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-6 animate-fade-in-up stagger-2">
          <div className="flex items-center gap-4">
            <h2 className="font-playfair text-3xl lg:text-[40px] font-bold text-brown leading-tight">{t('about.title')}</h2>
            <div className="w-[60px] h-[3px] rounded-full bg-gradient-to-r from-amber to-amber/30" />
          </div>
          <p className="text-base text-brown/75 leading-[1.8]">{t('about.para1')}</p>
          <p className="text-base text-brown/75 leading-[1.8]">{t('about.para2')}</p>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-light flex items-center justify-center">
                <Phone size={14} className="text-amber" />
              </div>
              <span className="text-sm font-medium text-brown">{t('about.phone')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-light flex items-center justify-center">
                <MapPin size={14} className="text-amber" />
              </div>
              <span className="text-sm font-medium text-brown">{t('about.location')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="warm-grain bg-cream flex flex-col items-center gap-14 px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <div className="text-center animate-fade-in-up">
          <h2 className="font-playfair text-3xl lg:text-[40px] font-bold text-brown">{t('highlights.title')}</h2>
          <p className="text-base text-brown/50 mt-4 max-w-[500px] mx-auto leading-relaxed">{t('highlights.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-7 w-full max-w-[1100px]">
          {highlights.map((card, i) => (
            <div
              key={card.title}
              className={`card-warm flex-1 flex flex-col items-center gap-5 bg-white rounded-3xl p-10 animate-fade-in-up stagger-${i + 1}`}
            >
              <div className={`w-[72px] h-[72px] ${card.bg} rounded-full flex items-center justify-center`}>
                <card.icon size={30} className={card.iconColor} strokeWidth={1.8} />
              </div>
              <h3 className="font-playfair text-[22px] font-bold text-brown text-center leading-tight whitespace-pre-line">{card.title}</h3>
              <p className="text-sm text-brown/55 text-center leading-[1.7]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-white flex flex-col items-center gap-14 px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <div className="text-center animate-fade-in-up">
          <h2 className="font-playfair text-3xl lg:text-[40px] font-bold text-brown">{t('howItWorks.title')}</h2>
          <p className="text-base text-brown/50 mt-4 max-w-[500px] mx-auto leading-relaxed">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="relative w-full max-w-[1100px]">
          {/* Connecting line */}
          <div className="absolute top-[40px] left-[15%] right-[15%] h-[2px] hidden lg:block"
            style={{ background: 'linear-gradient(to right, #E8DFD0, #8B691440, #E8DFD0)' }}
          />
          <div className="flex flex-wrap justify-center lg:justify-between gap-8 relative z-10">
            {steps.map((step, i) => (
              <div key={step.title} className={`flex flex-col items-center gap-4 w-[240px] animate-fade-in-up stagger-${i + 1}`}>
                <div className="relative">
                  <div
                    className={`w-[80px] h-[80px] ${step.color} rounded-full flex items-center justify-center border-2 transition-transform duration-300 hover:scale-110`}
                    style={{ borderColor: step.stroke }}
                  >
                    <step.icon size={30} style={{ color: step.stroke }} strokeWidth={1.8} />
                  </div>
                  {/* Step number */}
                  <div
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ backgroundColor: step.stroke }}
                  >
                    {step.num}
                  </div>
                </div>
                <h4 className="font-playfair text-lg font-bold text-brown text-center">{step.title}</h4>
                <p className="text-[13px] text-brown/50 text-center leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery ── */}
      <section id="gallery" className="warm-grain bg-cream flex flex-col items-center gap-14 px-6 sm:px-12 lg:px-20 py-16 lg:py-24">
        <div className="text-center animate-fade-in-up">
          <h2 className="font-playfair text-3xl lg:text-[40px] font-bold text-brown">{t('gallery.title')}</h2>
          <p className="text-base text-brown/50 mt-4">{t('gallery.subtitle')}</p>
        </div>
        <div className="flex gap-5 w-full max-w-[1200px]">
          <div className="flex-1 flex flex-col gap-5">
            <div className={`gallery-item ${galleryImages[0].h} animate-fade-in-up stagger-1`}><img src={galleryImages[0].url} alt="" className="w-full h-full object-cover" /></div>
            <div className={`gallery-item ${galleryImages[1].h} animate-fade-in-up stagger-3`}><img src={galleryImages[1].url} alt="" className="w-full h-full object-cover" /></div>
          </div>
          <div className="flex-1 flex flex-col gap-5">
            <div className={`gallery-item ${galleryImages[2].h} animate-fade-in-up stagger-2`}><img src={galleryImages[2].url} alt="" className="w-full h-full object-cover" /></div>
            <div className={`gallery-item ${galleryImages[3].h} animate-fade-in-up stagger-4`}><img src={galleryImages[3].url} alt="" className="w-full h-full object-cover" /></div>
          </div>
          <div className="flex-1 hidden sm:flex flex-col gap-5">
            <div className={`gallery-item ${galleryImages[4].h} animate-fade-in-up stagger-3`}><img src={galleryImages[4].url} alt="" className="w-full h-full object-cover" /></div>
            <div className={`gallery-item ${galleryImages[5].h} animate-fade-in-up stagger-5`}><img src={galleryImages[5].url} alt="" className="w-full h-full object-cover" /></div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
