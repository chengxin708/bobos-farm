"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { Loader2, ExternalLink } from "lucide-react"
import ConvertInquiryModal from "@/components/admin/inquiries/ConvertInquiryModal"

export interface InquiryComment {
  id: string
  content: string
  type: "INTERNAL_NOTE" | "PHONE_LOG" | "EMAIL_LOG" | "WECHAT_LOG" | "SYSTEM"
  createdAt: string
  author: { id: string; name: string | null; email: string; role: string }
}

export interface InquiryDetailData {
  id: string
  preferredDate: string
  guestCountMin: number
  guestCountMax: number
  packageHint: number | null
  note: string | null
  status: string
  priority: string
  tags: string[]
  reservationId: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
    wechatId: string | null
  }
  assignedAdmin: { id: string; name: string | null; email: string } | null
  reservation: {
    id: string
    confirmationCode: string
    status: string
    date: string
  } | null
  comments: InquiryComment[]
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch failed")
    return r.json()
  })

interface Props {
  inquiryId: string
  /**
   * When provided, "View reservation" CTA is delegated upstream so a
   * calendar drawer can switch the selected reservation in-place
   * instead of navigating away. Falls back to a Link when omitted.
   */
  onViewReservation?: (reservationId: string) => void
}

/**
 * Reusable inquiry detail UI. Used by:
 *  - /admin/inquiries/[id] full-page route
 *  - CalendarDesktop drawer when admin clicks an inquiry strip/row
 *
 * Manages its own SWR + comment posting + status patching + convert
 * modal. Caller supplies the id; everything else is internal.
 */
export default function InquiryDetailPanel({
  inquiryId,
  onViewReservation,
}: Props) {
  const t = useTranslations("adminInquiries")
  const locale = useLocale()
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US"
  const { data, mutate, isLoading } = useSWR<InquiryDetailData>(
    `/api/inquiries/${inquiryId}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  const [commentText, setCommentText] = useState("")
  const [commentType, setCommentType] = useState<InquiryComment["type"]>("INTERNAL_NOTE")
  const [posting, setPosting] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#6B7F5E]" />
      </div>
    )
  }

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setPosting(true)
    await fetch(`/api/inquiries/${inquiryId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText, type: commentType }),
    })
    setCommentText("")
    await mutate()
    setPosting(false)
  }

  const patchStatus = async (nextStatus: string) => {
    await fetch(`/api/inquiries/${inquiryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    })
    await mutate()
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-[#8C8478]">{t("customerName")}</span>
          <span className="font-semibold text-right break-words">{data.user.name || "—"}</span>
        </div>
        {data.user.phone && (
          <div className="flex justify-between gap-3">
            <span className="text-[#8C8478]">{t("customerPhone")}</span>
            <a href={`tel:${data.user.phone}`} className="font-semibold text-[#6B7F5E] underline-offset-2 hover:underline">{data.user.phone}</a>
          </div>
        )}
        {data.user.email && !data.user.email.endsWith("@placeholder.local") && (
          <div className="flex justify-between gap-3">
            <span className="text-[#8C8478]">{t("customerEmail")}</span>
            <a href={`mailto:${data.user.email}`} className="font-semibold text-[#6B7F5E] underline-offset-2 hover:underline break-all text-right">{data.user.email}</a>
          </div>
        )}
        {data.user.wechatId && (
          <div className="flex justify-between gap-3">
            <span className="text-[#8C8478]">{t("customerWechat")}</span>
            <span className="font-semibold text-right break-all">{data.user.wechatId}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-[#8C8478]">{t("filedAt")}</span>
          <span>{new Date(data.createdAt).toLocaleString(dateLocale)}</span>
        </div>
        {data.assignedAdmin && (
          <div className="flex justify-between gap-3">
            <span className="text-[#8C8478]">{t("assignedTo")}</span>
            <span>{data.assignedAdmin.name || data.assignedAdmin.email}</span>
          </div>
        )}
      </section>
      <section className="bg-white rounded-xl border border-[#E8ECE4] p-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[#8C8478]">{t("preferredDate")}</span>
          <span>{new Date(data.preferredDate).toLocaleDateString(dateLocale)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8C8478]">{t("guestRange")}</span>
          <span>
            {data.guestCountMin}–{data.guestCountMax}
          </span>
        </div>
        {data.packageHint && (
          <div className="flex justify-between">
            <span className="text-[#8C8478]">{t("packageHint")}</span>
            <span>{data.packageHint}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[#8C8478]">{t("statusLabel")}</span>
          <span className="font-semibold">{t(`status.${data.status}`)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#8C8478]">{t("priorityLabel")}</span>
          <span className="font-semibold">{t(`priority.${data.priority}`)}</span>
        </div>
        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {data.tags.map((tg) => (
              <span
                key={tg}
                className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#E8ECE4] text-[#6B7F5E]"
              >
                {tg}
              </span>
            ))}
          </div>
        )}
        {data.note && (
          <div className="mt-2">
            <p className="text-xs text-[#8C8478]">{t("note")}</p>
            <p className="text-sm text-[#2C2416] whitespace-pre-wrap">{data.note}</p>
          </div>
        )}
        {data.reservation && (
          <div className="mt-2 text-sm text-[#6B7F5E] font-semibold">
            {t("convertedTo", { code: data.reservation.confirmationCode })}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        {data.status !== "CONVERTED" && data.status !== "CLOSED" && (
          <>
            <button
              onClick={() => patchStatus("IN_PROGRESS")}
              className="px-3 py-1.5 text-sm rounded-full border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5 cursor-pointer bg-transparent"
            >
              {t("markInProgress")}
            </button>
            <button
              onClick={() => patchStatus("AWAITING_CUSTOMER")}
              className="px-3 py-1.5 text-sm rounded-full border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5 cursor-pointer bg-transparent"
            >
              {t("markWaiting")}
            </button>
            <button
              onClick={() => patchStatus("CLOSED")}
              className="px-3 py-1.5 text-sm rounded-full border border-[#8C8478] text-[#8C8478] hover:bg-[#8C8478]/5 cursor-pointer bg-transparent"
            >
              {t("markClosed")}
            </button>
            <button
              onClick={() => setShowConvertModal(true)}
              className="px-3 py-1.5 text-sm rounded-full bg-[#6B7F5E] text-white hover:bg-[#5A6E4F] cursor-pointer border-none"
            >
              {t("convertCta")}
            </button>
          </>
        )}
        {data.reservation &&
          (onViewReservation ? (
            <button
              onClick={() => onViewReservation(data.reservation!.id)}
              className="px-3 py-1.5 text-sm rounded-full border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5 flex items-center gap-1 cursor-pointer bg-transparent"
            >
              <ExternalLink size={12} />
              {t("viewReservationCta", { code: data.reservation.confirmationCode })}
            </button>
          ) : (
            <Link
              href={`/admin/reservations?highlight=${data.reservation.id}`}
              className="px-3 py-1.5 text-sm rounded-full border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5 flex items-center gap-1"
            >
              <ExternalLink size={12} />
              {t("viewReservationCta", { code: data.reservation.confirmationCode })}
            </Link>
          ))}
      </section>

      {showConvertModal && (
        <ConvertInquiryModal
          inquiryId={inquiryId}
          defaultDate={data.preferredDate}
          defaultGuestCount={data.guestCountMax}
          onCancel={() => setShowConvertModal(false)}
          onConverted={(rid) => {
            setShowConvertModal(false)
            if (onViewReservation) {
              onViewReservation(rid)
            } else {
              window.location.href = `/admin/reservations?highlight=${rid}`
            }
          }}
        />
      )}

      <section className="bg-white rounded-xl border border-[#E8ECE4] p-4">
        <h2 className="text-sm font-semibold text-[#2C2416] mb-3">{t("commentsTitle")}</h2>
        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto mb-3">
          {data.comments.length === 0 && (
            <p className="text-sm text-[#8C8478]">{t("noComments")}</p>
          )}
          {data.comments.map((c) => (
            <div key={c.id} className="border-l-2 border-[#E8ECE4] pl-3">
              <p className="text-xs text-[#8C8478]">
                {c.author.name || c.author.email} · {t(`commentType.${c.type}`)} ·{" "}
                {new Date(c.createdAt).toLocaleString(dateLocale)}
              </p>
              <p className="text-sm text-[#2C2416] whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
        <form onSubmit={postComment} className="flex flex-col gap-2">
          <select
            value={commentType}
            onChange={(e) => setCommentType(e.target.value as InquiryComment["type"])}
            className="h-9 px-2 rounded border border-[#E8ECE4] text-sm"
          >
            <option value="INTERNAL_NOTE">{t("commentType.INTERNAL_NOTE")}</option>
            <option value="PHONE_LOG">{t("commentType.PHONE_LOG")}</option>
            <option value="EMAIL_LOG">{t("commentType.EMAIL_LOG")}</option>
            <option value="WECHAT_LOG">{t("commentType.WECHAT_LOG")}</option>
            <option value="SYSTEM">{t("commentType.SYSTEM")}</option>
          </select>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={t("commentPlaceholder")}
            className="px-3 py-2 rounded-lg border border-[#E8ECE4] resize-none focus:outline-none focus:border-[#6B7F5E] text-sm"
          />
          <button
            type="submit"
            disabled={posting || !commentText.trim()}
            className="self-end px-4 py-1.5 text-sm font-semibold rounded-full bg-[#6B7F5E] text-white hover:bg-[#5A6E4F] disabled:opacity-50 cursor-pointer border-none"
          >
            {posting ? t("commentPosting") : t("commentPost")}
          </button>
        </form>
      </section>
    </div>
  )
}
