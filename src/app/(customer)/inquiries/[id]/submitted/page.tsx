"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2 } from "lucide-react"

export default function InquirySubmittedPage() {
  const t = useTranslations("inquiryForm.submitted")
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-5 py-12 gap-6 text-center">
      <CheckCircle2 size={56} className="text-[#5B8C3E]" />
      <h1 className="text-2xl font-serif font-semibold text-[#2C2416]">{t("title")}</h1>
      <p className="text-sm text-[#6B6157] max-w-md">{t("body")}</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/inquiries"
          className="h-11 rounded-full bg-[#6B7F5E] text-white text-sm font-semibold hover:bg-[#5A6E4E] flex items-center justify-center"
        >
          {t("viewMine")}
        </Link>
        <Link
          href="/"
          className="h-11 rounded-full border border-[#E8ECE4] text-sm text-[#2C2416] hover:bg-[#F2EDE6] flex items-center justify-center"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  )
}
