'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Flame, Tent, Gamepad2, Mic, Baby, PawPrint, Phone, Clock, Users } from 'lucide-react'
import { motion } from 'framer-motion'
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

const facilities = [
  { key: 'lamb', icon: Flame },
  { key: 'yurt', icon: Tent },
  { key: 'mahjong', icon: Gamepad2 },
  { key: 'ktv', icon: Mic },
  { key: 'kids', icon: Baby },
  { key: 'pets', icon: PawPrint },
]

export default function Landing() {
  const t = useTranslations('landing')

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative w-full overflow-hidden" style={{ height: '75vh' }}>
        <Image
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600"
          alt="Golden farm landscape at Bobo's Farm"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F8F7F4] via-[#F8F7F4]/60 to-transparent" style={{ top: '55%' }} />

        <div className="relative z-10 flex flex-col justify-end h-full pb-10 md:pb-16 px-6 md:px-12 lg:px-20">
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

      {/* ── About ── */}
      <motion.section
        {...fadeUp}
        className="px-6 md:px-12 lg:px-20 pt-20 md:pt-28 pb-16 md:pb-24"
      >
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-center gap-10 md:gap-16">
          <div className="flex flex-col gap-5 md:flex-1">
            <h2 className="font-serif text-2xl md:text-4xl text-[#1A1208] leading-[1.15]">
              {t('story.title')}
            </h2>
            <p className="text-base text-[#8C8478] leading-[1.8] max-w-[560px]">
              {t('story.description')}
            </p>
          </div>
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

      {/* ── Facilities (2x3 grid) ── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-24 bg-[#F2EDE6]/50">
        <div className="max-w-[1200px] mx-auto">
          <motion.h2
            {...fadeUp}
            className="font-serif text-2xl md:text-3xl text-[#1A1208] text-center mb-10 md:mb-14"
          >
            {t('facilities.title')}
          </motion.h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
            {facilities.map((item, i) => (
              <motion.div
                key={item.key}
                {...cardFadeUp(i * 0.08)}
                className="card-organic flex flex-col items-center gap-3 bg-white rounded-2xl p-5 md:p-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-[#E8ECE4] flex items-center justify-center">
                  <item.icon size={22} className="text-[#6B7F5E]" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-base text-[#1A1208]">
                  {t(`facilities.${item.key}.title`)}
                </h3>
                <p className="text-xs text-[#8C8478] leading-relaxed">
                  {t(`facilities.${item.key}.desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Booking Info ── */}
      <motion.section {...fadeUp} className="px-6 md:px-12 lg:px-20 py-16 md:py-24">
        <div className="max-w-[800px] mx-auto">
          <h2 className="font-serif text-2xl md:text-3xl text-[#1A1208] text-center mb-10">
            {t('booking.title')}
          </h2>

          <div className="flex flex-col gap-4">
            {/* Advance booking */}
            <div className="flex items-start gap-4 bg-[#F2EDE6] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <Clock size={20} className="text-[#6B7F5E]" />
              </div>
              <div>
                <h3 className="font-serif text-base text-[#1A1208] mb-1">{t('booking.advance.title')}</h3>
                <p className="text-sm text-[#8C8478] leading-relaxed">{t('booking.advance.desc')}</p>
              </div>
            </div>

            {/* Group size */}
            <div className="flex items-start gap-4 bg-[#F2EDE6] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <Users size={20} className="text-[#6B7F5E]" />
              </div>
              <div>
                <h3 className="font-serif text-base text-[#1A1208] mb-1">{t('booking.group.title')}</h3>
                <p className="text-sm text-[#8C8478] leading-relaxed">{t('booking.group.desc')}</p>
              </div>
            </div>

            {/* Phone numbers */}
            <div className="flex items-start gap-4 bg-[#F2EDE6] rounded-2xl p-5">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <Phone size={20} className="text-[#6B7F5E]" />
              </div>
              <div>
                <h3 className="font-serif text-base text-[#1A1208] mb-1">{t('booking.phone.title')}</h3>
                <div className="flex flex-col gap-1.5">
                  <a href="tel:+15162729999" className="text-sm text-[#6B7F5E] font-medium no-underline">
                    中文: (516) 272-9999
                  </a>
                  <a href="tel:+19175020445" className="text-sm text-[#6B7F5E] font-medium no-underline">
                    English: (917) 502-0445
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        {...fadeUp}
        className="px-6 md:px-12 lg:px-20 pb-24"
      >
        <div className="max-w-[1200px] mx-auto">
          <div className="relative w-full aspect-[16/9] md:rounded-2xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1544025162-d76694265947?w=1400"
              alt="Farm gathering atmosphere"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1200px"
            />
          </div>

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
    </>
  )
}
