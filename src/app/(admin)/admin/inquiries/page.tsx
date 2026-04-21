"use client"

import Link from "next/link"
import useSWR from "swr"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

interface InquiryRow {
  id: string
  preferredDate: string
  guestCountMin: number
  guestCountMax: number
  priority: "NORMAL" | "HIGH" | "URGENT"
  status: string
  tags: string[]
  createdAt: string
  user: { id: string; name: string | null; email: string; phone: string | null }
  assignedAdmin: { id: string; name: string | null; email: string } | null
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch failed")
  return r.json()
})

const STATUS_OPTIONS = [
  "", "PENDING", "IN_PROGRESS", "AWAITING_CUSTOMER", "CONVERTED", "CLOSED", "EXPIRED",
] as const

const PRIORITY_OPTIONS = ["", "NORMAL", "HIGH", "URGENT"] as const

export default function AdminInquiryListPage() {
  const t = useTranslations("adminInquiries")
  const [status, setStatus] = useState<string>("")
  const [priority, setPriority] = useState<string>("")
  const [tag, setTag] = useState<string>("")
  const qs = new URLSearchParams()
  if (status) qs.set("status", status)
  if (priority) qs.set("priority", priority)
  if (tag) qs.set("tag", tag)
  const { data, isLoading } = useSWR<InquiryRow[]>(
    `/api/inquiries${qs.toString() ? `?${qs.toString()}` : ""}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-serif font-semibold text-[#2C2416]">{t("title")}</h1>

      <div className="flex gap-2 flex-wrap">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 px-2 rounded border border-[#E8ECE4] text-sm">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s ? t(`status.${s}`) : t("allStatuses")}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 px-2 rounded border border-[#E8ECE4] text-sm">
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p ? t(`priority.${p}`) : t("allPriorities")}</option>
          ))}
        </select>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder={t("tagFilter")}
          className="h-9 px-2 rounded border border-[#E8ECE4] text-sm"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#6B7F5E]" />
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <p className="text-sm text-[#8C8478] py-8 text-center">{t("empty")}</p>
      )}

      <div className="flex flex-col gap-2">
        {data?.map((inq) => (
          <Link
            key={inq.id}
            href={`/admin/inquiries/${inq.id}`}
            className="block bg-white rounded-xl border border-[#E8ECE4] px-4 py-3 hover:border-[#6B7F5E]/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#2C2416]">
                  {inq.user.name || inq.user.email}
                </p>
                <p className="text-xs text-[#6B6157]">
                  {new Date(inq.preferredDate).toLocaleDateString()} · {inq.guestCountMin}–{inq.guestCountMax} {t("guestsShort")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                  inq.priority === "URGENT" ? "bg-[#DC3545]/15 text-[#DC3545]" :
                  inq.priority === "HIGH" ? "bg-[#F4A623]/20 text-[#8B6914]" :
                  "bg-[#E8ECE4] text-[#6B7F5E]"
                }`}>{t(`priority.${inq.priority}`)}</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#F2EDE6] text-[#6B6157]">
                  {t(`status.${inq.status}`)}
                </span>
                {inq.tags.map((tg) => (
                  <span key={tg} className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#E8ECE4] text-[#6B7F5E]">
                    {tg}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
