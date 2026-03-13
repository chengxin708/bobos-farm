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
    { icon: Flame, title: t('highlights.lamb.title'), desc: t('highlights.lamb.desc'), bg: 'bg-amber-light' },
    { icon: Tent, title: t('highlights.yurt.title'), desc: t('highlights.yurt.desc'), bg: 'bg-terracotta-light' },
    { icon: Leaf, title: t('highlights.farm.title'), desc: t('highlights.farm.desc'), bg: 'bg-green-light' },
  ]

  const steps = [
    { icon: Calendar, title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.desc'), color: 'bg-amber-light', border: 'border-amber', stroke: '#8B6914' },
    { icon: DollarSign, title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.desc'), color: 'bg-green-light', border: 'border-green', stroke: '#5B8C3E' },
    { icon: UtensilsCrossed, title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.desc'), color: 'bg-terracotta-light', border: 'border-terracotta', stroke: '#C4724B' },
    { icon: PartyPopper, title: t('howItWorks.step4.title'), desc: t('howItWorks.step4.desc'), color: 'bg-cream', border: 'border-amber', stroke: '#8B6914' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <section className="relative h-[800px] w-full overflow-hidden">
        <img src="https://images.unsplash.com/photo-1767447612225-a281f76abdb7?w=1440&q=80" alt="Farm landscape" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/12 to-black/67" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6 px-[120px]">
          <h1 className="font-playfair text-[52px] font-bold text-white text-center leading-[1.2] max-w-[800px] whitespace-pre-line">{t('hero.title')}</h1>
          <p className="text-lg text-white/80 text-center leading-relaxed max-w-[700px]">{t('hero.subtitle')}</p>
          <div className="flex gap-4 pt-3">
            <Link href="/booking/date" className="no-underline px-9 py-4 rounded-[14px] bg-gradient-to-b from-[#A07818] to-amber text-white text-base font-semibold shadow-[0_4px_20px_rgba(139,105,20,0.25)]">{t('hero.bookVisit')}</Link>
            <Link href="/menu" className="no-underline px-9 py-4 rounded-[14px] border-[1.5px] border-white/67 text-white text-base font-semibold">{t('hero.viewMenu')}</Link>
          </div>
        </div>
        <ChevronDown size={28} className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/53 animate-bounce" />
      </section>
      <section id="about" className="flex items-center gap-[60px] px-20 py-20">
        <div className="w-[560px] h-[400px] rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.07)] shrink-0">
          <img src="https://images.unsplash.com/photo-1763771056927-557d39cb5e02?w=800&q=80" alt="Farm" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <h2 className="font-playfair text-4xl font-bold text-brown">{t('about.title')}</h2>
            <div className="w-[60px] h-0.5 bg-amber" />
          </div>
          <p className="text-base text-brown/80 leading-[1.7]">{t('about.para1')}</p>
          <p className="text-base text-brown/80 leading-[1.7]">{t('about.para2')}</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5"><Phone size={16} className="text-amber" /><span className="text-sm text-brown">{t('about.phone')}</span></div>
            <div className="flex items-center gap-2.5"><MapPin size={16} className="text-amber" /><span className="text-sm text-brown">{t('about.location')}</span></div>
          </div>
        </div>
      </section>
      <section className="bg-cream flex flex-col items-center gap-12 px-20 py-20">
        <div className="text-center">
          <h2 className="font-playfair text-4xl font-bold text-brown">{t('highlights.title')}</h2>
          <p className="text-base text-brown/60 mt-3">{t('highlights.subtitle')}</p>
        </div>
        <div className="flex gap-7 w-full">
          {highlights.map((card) => (
            <div key={card.title} className="flex-1 flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
              <div className={`w-16 h-16 ${card.bg} rounded-[32px] flex items-center justify-center`}><card.icon size={28} className="text-amber" /></div>
              <h3 className="font-playfair text-[22px] font-bold text-brown text-center leading-tight whitespace-pre-line">{card.title}</h3>
              <p className="text-sm text-brown/67 text-center leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-white flex flex-col items-center gap-12 px-20 py-20">
        <div className="text-center">
          <h2 className="font-playfair text-4xl font-bold text-brown">{t('howItWorks.title')}</h2>
          <p className="text-base text-brown/60 mt-3">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="relative w-full max-w-[1100px]">
          <div className="absolute top-[36px] left-[150px] right-[150px] h-0.5 border-t-2 border-dashed border-beige" />
          <div className="flex justify-between relative z-10">
            {steps.map((step) => (
              <div key={step.title} className="flex flex-col items-center gap-3 w-[220px]">
                <div className={`w-[72px] h-[72px] ${step.color} rounded-full flex items-center justify-center border-2`} style={{ borderColor: step.stroke }}><step.icon size={28} style={{ color: step.stroke }} /></div>
                <h4 className="font-playfair text-lg font-bold text-brown text-center">{step.title}</h4>
                <p className="text-[13px] text-brown/60 text-center leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="gallery" className="bg-cream flex flex-col items-center gap-12 px-20 py-20">
        <div className="text-center">
          <h2 className="font-playfair text-4xl font-bold text-brown">{t('gallery.title')}</h2>
          <p className="text-base text-brown/60 mt-3">{t('gallery.subtitle')}</p>
        </div>
        <div className="flex gap-5 w-full">
          <div className="flex-1 flex flex-col gap-5">
            <div className={`${galleryImages[0].h} rounded-[14px] overflow-hidden`}><img src={galleryImages[0].url} alt="" className="w-full h-full object-cover" /></div>
            <div className={`${galleryImages[1].h} rounded-[14px] overflow-hidden`}><img src={galleryImages[1].url} alt="" className="w-full h-full object-cover" /></div>
          </div>
          <div className="flex-1 flex flex-col gap-5">
            <div className={`${galleryImages[2].h} rounded-[14px] overflow-hidden`}><img src={galleryImages[2].url} alt="" className="w-full h-full object-cover" /></div>
            <div className={`${galleryImages[3].h} rounded-[14px] overflow-hidden`}><img src={galleryImages[3].url} alt="" className="w-full h-full object-cover" /></div>
          </div>
          <div className="flex-1 flex flex-col gap-5">
            <div className={`${galleryImages[4].h} rounded-[14px] overflow-hidden`}><img src={galleryImages[4].url} alt="" className="w-full h-full object-cover" /></div>
            <div className={`${galleryImages[5].h} rounded-[14px] overflow-hidden`}><img src={galleryImages[5].url} alt="" className="w-full h-full object-cover" /></div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
