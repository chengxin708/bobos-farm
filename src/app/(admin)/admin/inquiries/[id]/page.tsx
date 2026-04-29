"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useTranslations } from "next-intl"
import { ArrowLeft } from "lucide-react"
import InquiryDetailPanel, {
  type InquiryDetailData,
} from "@/components/admin/inquiries/InquiryDetailPanel"

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed")
    return r.json()
  })

/**
 * Full-page admin inquiry detail. The actual UI lives in
 * <InquiryDetailPanel/> so the calendar drawer can reuse it. This page
 * just adds the page chrome (back link + heading) and delegates.
 */
export default function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = useTranslations("adminInquiries")
  const { id } = use(params)
  // Fetch just enough to fill the heading. The panel does its own
  // (deduped) fetch via SWR for the body.
  const { data } = useSWR<InquiryDetailData>(`/api/inquiries/${id}`, fetcher, {
    revalidateOnFocus: false,
  })

  return (
    <div className="p-3 sm:p-6 flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link href="/admin/inquiries" className="p-1 rounded hover:bg-[#E8ECE4]/30">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-serif font-semibold text-[#2C2416]">
          {data
            ? t("detailTitle", { name: data.user.name || data.user.email })
            : t("detailTitle", { name: "…" })}
        </h1>
      </div>
      <InquiryDetailPanel inquiryId={id} />
    </div>
  )
}
