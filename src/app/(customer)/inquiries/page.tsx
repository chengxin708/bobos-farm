"use client"

import Link from "next/link"
import useSWR from "swr"
import { useTranslations, useLocale } from "next-intl"
import { Loader2, MessageCircle } from "lucide-react"

interface InquiryRow {
  id: string
  preferredDate: string
  guestCountMin: number
  guestCountMax: number
  status: "PENDING" | "IN_PROGRESS" | "AWAITING_CUSTOMER" | "CONVERTED" | "CLOSED" | "EXPIRED"
  updatedAt: string
  reservation: { id: string; confirmationCode: string; status: string } | null
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch failed")
  return r.json()
})

export default function MyInquiriesPage() {
  const t = useTranslations("inquiryList")
  const locale = useLocale()
  const { data, isLoading } = useSWR<InquiryRow[]>("/api/inquiries/mine", fetcher, {
    revalidateOnFocus: false,
  })

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  return (
    <div className="min-h-full flex flex-col px-5 py-6 gap-4">
      <h1 className="text-xl font-serif font-semibold text-[#2C2416]">{t("title")}</h1>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#6B7F5E]" />
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <MessageCircle size={40} className="text-[#E8ECE4]" />
          <p className="text-sm text-[#8C8478]">{t("empty")}</p>
          <Link
            href="/inquiries/new"
            className="mt-2 h-11 px-4 rounded-full bg-[#6B7F5E] text-white text-sm font-semibold hover:bg-[#5A6E4E] flex items-center"
          >
            {t("newCta")}
          </Link>
        </div>
      )}

      {!isLoading &&
        data?.map((inq) => (
          <Link
            key={inq.id}
            href={inq.reservation ? `/reservations/${inq.reservation.id}` : `#`}
            className="block bg-white rounded-2xl border border-[#E8ECE4] p-4 hover:border-[#6B7F5E]/40"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-sm font-semibold text-[#2C2416]">
                  {fmtDate(inq.preferredDate)}
                </p>
                <p className="text-xs text-[#6B6157] mt-1">
                  {t("guests", { min: inq.guestCountMin, max: inq.guestCountMax })}
                </p>
              </div>
              <span className="text-[10px] font-semibold uppercase text-[#6B7F5E] bg-[#E8ECE4] px-2 py-0.5 rounded-full">
                {t(`status.${inq.status}`)}
              </span>
            </div>
            {inq.reservation && (
              <p className="text-xs text-[#6B7F5E] mt-2 font-medium">
                {t("convertedCta", { code: inq.reservation.confirmationCode })}
              </p>
            )}
            <p className="text-[11px] text-[#8C8478] mt-2">
              {t("updated", { date: fmtDate(inq.updatedAt) })}
            </p>
          </Link>
        ))}
    </div>
  )
}
