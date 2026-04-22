"use client"

import { useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { CheckCircle2, Copy, Check, ExternalLink } from "lucide-react"
import type { ConvertInquiryFormModel } from "./useConvertInquiryForm"

interface Props {
  form: ConvertInquiryFormModel
  onDone: () => void
  onViewReservation: (reservationId: string) => void
}

/**
 * Post-conversion success state: shows the confirmation code, a copy
 * button for the claim URL, and a copy button for a pre-formatted
 * customer message the admin can paste into iMessage / WeChat.
 *
 * No automated sending — per the Phase 1/2 invariant, admin owns all
 * customer outreach. This screen is purely a clipboard convenience.
 */
export function ConvertSuccessScreen({ form, onDone, onViewReservation }: Props) {
  const { t, result, inquiry } = form
  const locale = useLocale()
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US"
  const [linkCopied, setLinkCopied] = useState(false)
  const [msgCopied, setMsgCopied] = useState(false)

  const claimUrl = useMemo(() => {
    if (!result || !result.claimToken) return ""
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams({
      code: result.confirmationCode,
      t: result.claimToken,
    })
    return `${window.location.origin}/claim?${params.toString()}`
  }, [result])

  const messageTemplate = useMemo(() => {
    if (!result) return ""
    const name = inquiry?.user.name || inquiry?.user.email || ""
    const displayDate = new Date(result.date).toLocaleDateString(dateLocale)
    if (locale === "zh") {
      return [
        `${name}您好！波姐农家乐已为您预留：`,
        `日期：${displayDate}`,
        `人数：${result.guestCount} 人`,
        `押金：$${result.depositAmount}`,
        "",
        `请点击以下链接确认并支付押金：`,
        claimUrl,
      ].join("\n")
    }
    return [
      `Hi ${name}! Your Bobo's Farm reservation is on hold:`,
      `Date: ${displayDate}`,
      `Guests: ${result.guestCount}`,
      `Deposit: $${result.depositAmount}`,
      "",
      `Please confirm and pay via the link below:`,
      claimUrl,
    ].join("\n")
  }, [result, inquiry, claimUrl, locale, dateLocale])

  if (!result) return null

  async function copyLink() {
    if (!claimUrl) return
    await navigator.clipboard.writeText(claimUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function copyMessage() {
    if (!messageTemplate) return
    await navigator.clipboard.writeText(messageTemplate)
    setMsgCopied(true)
    setTimeout(() => setMsgCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center text-center gap-2 py-2">
        <CheckCircle2 size={48} className="text-[#5B8C3E]" />
        <h3 className="text-lg font-semibold text-[#2C2416]">{t("successTitle")}</h3>
        <p className="text-sm text-[#6B6157]">{t("successSubtitle")}</p>
      </div>

      <div className="rounded-xl border border-[#E8E2D9] bg-white px-4 py-3 flex flex-col gap-2 text-sm">
        <Row label={t("confirmationCodeLabel")} value={result.confirmationCode} mono />
        <Row
          label={t("dateLabel")}
          value={new Date(result.date).toLocaleDateString(dateLocale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
          })}
        />
        <Row label={t("guestCountLabel")} value={String(result.guestCount)} />
        <Row label={t("depositLabel")} value={`$${result.depositAmount}`} />
      </div>

      {claimUrl && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-[#2C2416]">{t("claimLinkLabel")}</span>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={claimUrl}
              className="flex-1 h-10 px-3 rounded-lg border border-[#E8E2D9] bg-[#FAFAF7] text-[12px] text-[#2C2416] font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={copyLink}
              className="h-10 px-4 rounded-lg border border-[#6B7F5E] text-[#6B7F5E] font-semibold text-sm hover:bg-[#6B7F5E]/5 flex items-center gap-1.5 bg-white cursor-pointer"
            >
              {linkCopied ? <Check size={14} /> : <Copy size={14} />}
              {linkCopied ? t("copied") : t("copyLink")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-[#2C2416]">{t("messageTemplateLabel")}</span>
        <textarea
          readOnly
          rows={7}
          value={messageTemplate}
          className="w-full px-3 py-2 rounded-lg border border-[#E8E2D9] bg-[#FAFAF7] text-[12px] text-[#2C2416] resize-none"
        />
        <button
          type="button"
          onClick={copyMessage}
          className="self-start h-9 px-3 rounded-lg border border-[#6B7F5E] text-[#6B7F5E] font-semibold text-sm hover:bg-[#6B7F5E]/5 flex items-center gap-1.5 bg-white cursor-pointer"
        >
          {msgCopied ? <Check size={14} /> : <Copy size={14} />}
          {msgCopied ? t("copied") : t("copyMessage")}
        </button>
        <p className="text-[11px] text-[#8C8478]">{t("messageHint")}</p>
      </div>

      <div className="flex justify-between gap-2 pt-2 border-t border-[#E8E2D9]">
        <button
          type="button"
          onClick={onDone}
          className="h-10 px-4 rounded-lg text-sm font-medium hover:bg-[#F5F2ED] border-none bg-transparent cursor-pointer text-[#2C2416]"
        >
          {t("done")}
        </button>
        <button
          type="button"
          onClick={() => onViewReservation(result.reservationId)}
          className="h-10 px-4 rounded-lg text-sm font-semibold text-white border-none bg-[#6B7F5E] hover:bg-[#5A6E4F] flex items-center gap-1.5 cursor-pointer"
        >
          <ExternalLink size={14} />
          {t("viewReservation")}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-[#8C8478]">{label}</span>
      <span className={`${mono ? "font-mono" : ""} text-[13px] font-semibold text-[#2C2416]`}>{value}</span>
    </div>
  )
}
