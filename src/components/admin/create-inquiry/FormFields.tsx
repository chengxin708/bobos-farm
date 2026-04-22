"use client"

/* eslint-disable react-hooks/refs */

import { useMemo } from "react"
import { DatePickerCalendar, type DateStatus } from "@/components/customer/DatePickerCalendar"
import type { CreateInquiryFormModel } from "./useCreateInquiryForm"

const FIELD_BASE_CLASS =
  "h-11 px-3 rounded-lg border outline-none transition-all duration-150 bg-white"
const FIELD_BASE_STYLE: React.CSSProperties = {
  borderColor: "#E8E2D9",
  backgroundColor: "#FFFFFF",
  color: "#2C2416",
}

function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#6B7F5E"
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(107,127,94,0.15)"
}
function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#E8E2D9"
  e.currentTarget.style.boxShadow = "none"
}

export function FormFields({
  form,
  layout,
}: {
  form: CreateInquiryFormModel
  layout: "single" | "two-col"
}) {
  const { t } = form

  const gridClass =
    layout === "two-col"
      ? "grid grid-cols-2 gap-x-4 gap-y-4"
      : "flex flex-col gap-4"

  const dateStatusMap = useMemo<Record<string, DateStatus>>(() => {
    if (!form.slots) return {}
    const map: Record<string, DateStatus> = {}
    for (const [k, info] of Object.entries(form.slots)) {
      if (info.available === 0) map[k] = "full"
      else if (info.available === 1) map[k] = "limited"
      else map[k] = "available"
    }
    return map
  }, [form.slots])

  return (
    <div className="flex flex-col gap-4">
      <div className={gridClass}>
        <div className={layout === "two-col" ? "col-span-2" : ""}>
          <Label required>{t("guestName")}</Label>
          <input
            ref={form.nameInputRef}
            type="text"
            required
            value={form.guestName}
            onChange={(e) => form.setGuestName(e.target.value)}
            placeholder={t("guestNamePlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        <div>
          <Label>{t("guestEmail")}</Label>
          <input
            type="email"
            value={form.guestEmail}
            onChange={(e) => form.setGuestEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        <div>
          <Label>{t("guestPhone")}</Label>
          <input
            type="tel"
            value={form.guestPhone}
            onChange={(e) => form.setPhoneWithMask(e.target.value)}
            placeholder={t("phonePlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        <div className={layout === "two-col" ? "col-span-2" : ""}>
          <Label>{t("guestWechat")}</Label>
          <input
            type="text"
            value={form.guestWechatId}
            onChange={(e) => form.setGuestWechatId(e.target.value)}
            placeholder={t("wechatPlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
          <p className="text-[11px] text-[#8C8478] mt-1">{t("contactHint")}</p>
        </div>
      </div>

      <div>
        <Label required>{t("preferredDate")}</Label>
        <DatePickerCalendar
          value={form.preferredDate}
          onChange={form.setPreferredDate}
          minDate={form.earliestStr}
          maxDate={form.latestStr}
          dateStatus={dateStatusMap}
          allowFullDates
          showLegend={false}
        />
      </div>

      <div className={layout === "two-col" ? "grid grid-cols-2 gap-x-4" : "flex flex-col gap-4"}>
        <div>
          <Label required>{t("guestCountMin")}</Label>
          <input
            type="number"
            required
            min={1}
            max={999}
            value={form.guestCountMin}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10) || 1
              form.setGuestCountMin(n)
              if (form.guestCountMax < n) form.setGuestCountMax(n)
            }}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>
        <div>
          <Label required>{t("guestCountMax")}</Label>
          <input
            type="number"
            required
            min={1}
            max={999}
            value={form.guestCountMax}
            onChange={(e) =>
              form.setGuestCountMax(parseInt(e.target.value, 10) || form.guestCountMin)
            }
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>
      </div>

      <div>
        <Label>{t("note")}</Label>
        <textarea
          value={form.note}
          onChange={(e) => form.setNote(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder={t("notePlaceholder")}
          className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all duration-150 resize-none bg-white"
          style={{ borderColor: "#E8E2D9", color: "#2C2416" }}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
        <span className="block text-[11px] text-right mt-1" style={{ color: "#8A7E6B" }}>
          {form.note.length}/2000
        </span>
      </div>

      {form.error && (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
        >
          {form.error}
        </div>
      )}
    </div>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="block text-[13px] font-semibold mb-1.5"
      style={{ color: "#2C2416" }}
    >
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  )
}
