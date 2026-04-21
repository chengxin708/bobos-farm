"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Calendar, MessageCircle } from "lucide-react"

export default function BookingStartPage() {
  const t = useTranslations("bookingStart")
  return (
    <div className="min-h-full flex flex-col px-5 py-8 gap-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-serif font-semibold text-[#2C2416]">{t("title")}</h1>
        <p className="text-sm text-[#6B6157] mt-2">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <PathCard
          href="/booking/date"
          icon={<Calendar className="w-10 h-10 text-[#6B7F5E]" />}
          title={t("decided.title")}
          description={t("decided.body")}
          cta={t("decided.cta")}
        />

        <div className="self-center text-sm text-[#8C8478] md:rotate-0 rotate-0">
          {t("or")}
        </div>

        <PathCard
          href="/inquiries/new"
          icon={<MessageCircle className="w-10 h-10 text-[#8B6914]" />}
          title={t("unsure.title")}
          description={t("unsure.body")}
          cta={t("unsure.cta")}
        />
      </div>
    </div>
  )
}

function PathCard({
  href,
  icon,
  title,
  description,
  cta,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="flex-1 bg-white rounded-2xl border border-[#E8ECE4] p-6 hover:border-[#6B7F5E]/60 hover:shadow-sm transition-all flex flex-col gap-3"
    >
      {icon}
      <h2 className="text-lg font-serif font-semibold text-[#2C2416]">{title}</h2>
      <p className="text-sm text-[#6B6157] flex-1">{description}</p>
      <span className="text-sm font-semibold text-[#6B7F5E]">{cta} →</span>
    </Link>
  )
}
