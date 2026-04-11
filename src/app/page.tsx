'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Flame, Tent, TreePine } from 'lucide-react'
import { motion } from 'framer-motion'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'
import { useTranslations } from 'next-intl'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

function cardFadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-50px' },
    transition: { duration: 0.5, ease: 'easeOut' as const, delay },
  }
}

const experienceCards = [
  { key: 'lamb' as const, icon: Flame },
  { key: 'yurt' as const, icon: Tent },
  { key: 'farm' as const, icon: TreePine },
]

export default function Landing() {
  const t = useTranslations('landing')

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]"
         style={{ height: '100dvh' }}>
      <div className="shrink-0"><Navbar /></div>
      <div className="flex-1 overflow-y-auto overscroll-contain" id="main-scroll">

      {/* ── Section 1: Hero ── */}
      <section className="relative w-full overflow-hidden shrink-0" style={{ height: '100dvh' }}>
        <Image
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600"
          alt="Golden farm landscape at Bobo's Farm"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Bottom gradient — light, no dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4]/60 to-transparent" style={{ top: '60%' }} />

        <div className="relative z-10 flex flex-col justify-end h-full pb-20 md:pb-24 px-6 md:px-12 lg:px-20">
          <motion.div {...fadeUp} className="max-w-[1200px] mx-auto w-full">
            <h1 className="font-[family-name:var(--font-logo)] text-5xl md:text-7xl font-semibold text-[#1A1208] leading-[1.1] tracking-[0.01em]">
              Bobo&apos;s Farm
            </h1>
            <p className="mt-1 font-serif text-lg md:text-xl text-[#1A1208]/60 tracking-[0.05em]">
              波姐农家乐
            </p>
            <p className="mt-2 text-sm font-sans text-[#8C8478] tracking-[0.15em] uppercase">
              {t('hero.location')}
            </p>
            <Link
              href="/booking/date"
              className="inline-block mt-6 bg-[#6B7F5E] text-white rounded-full px-8 py-3 text-base font-medium no-underline transition-all hover:bg-[#5A6E4F] active:scale-[0.97]"
            >
              {t('hero.bookVisit')}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Section 2: Story ── */}
      <motion.section
        {...fadeUp}
        className="px-6 md:px-12 lg:px-20 pt-24 md:pt-32 pb-16 md:pb-24"
      >
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-center gap-10 md:gap-16">
          {/* Text */}
          <div className="flex flex-col gap-5 md:flex-1">
            <h2 className="font-serif text-2xl md:text-4xl text-[#1A1208] leading-[1.15]">
              {t('story.title')}
            </h2>
            <p className="text-base text-[#8C8478] leading-[1.8] max-w-[560px]">
              {t('story.description')}
            </p>
          </div>
          {/* Image */}
          <div className="md:flex-1">
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200"
                alt="Farm to table dining scene"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Section 3: Experience Cards ── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-24">
        <div className="max-w-[1200px] mx-auto">
          <motion.h2
            {...fadeUp}
            className="font-serif text-2xl md:text-3xl text-[#1A1208] text-center mb-10 md:mb-14"
          >
            {t('experience.title')}
          </motion.h2>

          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {experienceCards.map((card, i) => (
              <motion.div
                key={card.key}
                {...cardFadeUp(i * 0.1)}
                className="card-organic flex-1 flex flex-col gap-4 bg-[#F2EDE6] rounded-2xl p-6"
              >
                <card.icon size={28} className="text-[#6B7F5E]" strokeWidth={1.5} />
                <h3 className="font-serif text-lg text-[#1A1208]">
                  {t(`experience.${card.key}.title`)}
                </h3>
                <p className="text-sm text-[#8C8478] leading-[1.7]">
                  {t(`experience.${card.key}.desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: CTA ── */}
      <motion.section
        {...fadeUp}
        className="px-6 md:px-12 lg:px-20 pb-24"
      >
        <div className="max-w-[1200px] mx-auto">
          {/* Atmospheric photo */}
          <div className="relative w-full aspect-[16/9] md:rounded-2xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1544025162-d76694265947?w=1400"
              alt="Farm gathering atmosphere"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1200px"
            />
          </div>

          {/* CTA text */}
          <div className="flex flex-col items-center gap-5 mt-10 md:mt-12">
            <h2 className="font-serif text-2xl text-[#1A1208] text-center">
              {t('cta.title')}
            </h2>
            <Link
              href="/booking/date"
              className="inline-block bg-[#6B7F5E] text-white rounded-full px-8 py-3 text-base font-medium no-underline transition-all hover:bg-[#5A6E4F] active:scale-[0.97]"
            >
              {t('cta.bookVisit')}
            </Link>
          </div>
        </div>
      </motion.section>

      <Footer />
      </div>
      <div className="shrink-0 md:hidden"><BottomTabs /></div>
    </div>
  )
}
