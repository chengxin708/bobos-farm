"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { useLocale } from "next-intl"
import { DatePickerCalendar, type DateStatus } from "@/components/customer/DatePickerCalendar"
import { GuestCountPicker } from "@/components/customer/GuestCountPicker"
import type { ConvertInquiryFormModel } from "./useConvertInquiryForm"

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch failed")
  return r.json()
})

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Body of the inquiry conversion form. Renders the original inquiry
 * snapshot, the date picker, the guest count picker, yurt-combo preset
 * chips, a manual yurt list, plus per-day soft warnings and admin-only
 * deposit override.
 */
export function FormFields({ form }: { form: ConvertInquiryFormModel }) {
  const { t, inquiry } = form
  const locale = useLocale()
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US"

  const { data: settings } = useSWR<Record<string, string>>("/api/settings/public", fetcher, {
    revalidateOnFocus: false,
  })
  const [today] = useMemo(() => [new Date()], [])
  const minAdvanceDays = settings?.min_advance_booking_days
    ? Number(settings.min_advance_booking_days)
    : 0
  const maxAdvanceDays = settings?.max_advance_booking_days
    ? Number(settings.max_advance_booking_days)
    : 180
  const earliestStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + minAdvanceDays)
    return toLocalDateStr(d)
  }, [today, minAdvanceDays])
  const latestStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + maxAdvanceDays)
    return toLocalDateStr(d)
  }, [today, maxAdvanceDays])

  const { data: slots } = useSWR<Record<string, { total: number; occupied: number; available: number }>>(
    `/api/availability/slots?startDate=${earliestStr}&endDate=${latestStr}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  const dateStatusMap = useMemo<Record<string, DateStatus>>(() => {
    if (!slots) return {}
    const map: Record<string, DateStatus> = {}
    for (const [k, info] of Object.entries(slots)) {
      if (info.available === 0) map[k] = "full"
      else if (info.available === 1) map[k] = "limited"
      else map[k] = "available"
    }
    return map
  }, [slots])

  const softThreshold = form.freeYurts.reduce((acc, y) => Math.max(acc, y.capacity), 0) || undefined

  return (
    <div className="flex flex-col gap-5">
      {/* Inquiry snapshot */}
      {inquiry && (
        <section className="rounded-xl border border-[#E5D8B8] bg-[#FEFBF4] px-4 py-3 text-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[#8B6914]">
            {t("originalRequest")}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#2C2416]">
            <span><b>{t("customer")}:</b> {inquiry.user.name || inquiry.user.email}</span>
            <span><b>{t("originalDate")}:</b> {new Date(inquiry.preferredDate).toLocaleDateString(dateLocale)}</span>
            <span><b>{t("originalGuests")}:</b> {inquiry.guestCountMin}–{inquiry.guestCountMax}</span>
          </div>
          <div className="rounded-lg border border-[#E5D8B8] bg-white px-3 py-2 flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8B6914]">
              {t("noteFromCustomerLabel")}
            </span>
            {inquiry.note?.trim() ? (
              <p className="text-[13px] text-[#2C2416] whitespace-pre-wrap leading-relaxed">
                {inquiry.note}
              </p>
            ) : (
              <p className="text-[12px] italic text-[#8C8478]">
                {t("noteFromCustomerEmpty")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Date */}
      <div>
        <Label required>{t("date")}</Label>
        <DatePickerCalendar
          value={form.date}
          onChange={form.setDate}
          minDate={earliestStr}
          maxDate={latestStr}
          dateStatus={dateStatusMap}
          allowFullDates
          showLegend={false}
        />
        {form.isPastDate && (
          <p className="mt-2 text-[12px] font-semibold text-[#8B6914]">⚠️ {t("pastDateHint")}</p>
        )}
      </div>

      {/* Guest count */}
      <GuestCountPicker
        value={form.guestCount}
        onChange={form.setGuestCount}
        softThreshold={softThreshold}
      />
      {form.outOfOriginalRange && inquiry && (
        <p className="-mt-3 text-[12px] text-[#8B6914] font-medium">
          ⚠️ {t("outOfOriginalRangeHint", {
            min: inquiry.guestCountMin,
            max: inquiry.guestCountMax,
          })}
        </p>
      )}

      {/* Yurt combo chips */}
      {form.yurtCombos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-[#2C2416]">{t("comboSuggestions")}</span>
          <div className="flex flex-wrap gap-1.5">
            {form.yurtCombos.map((combo) => {
              const isActive =
                combo.ids.length === form.yurtIds.length &&
                combo.ids.every((id) => form.yurtIds.includes(id))
              const names = form.activeYurts
                .filter((y) => combo.ids.includes(y.id))
                .map((y) => y.name)
                .join(" + ")
              return (
                <button
                  key={combo.ids.join(",")}
                  type="button"
                  onClick={() => form.applyCombo(combo.ids)}
                  aria-pressed={isActive}
                  className={`h-9 px-3 rounded-full text-[12px] font-semibold border-none cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#6B7F5E] text-white shadow-sm"
                      : "bg-[#F2EDE6] text-[#2C2416] hover:bg-[#E8ECE4]"
                  }`}
                >
                  {names} · {combo.totalCapacity}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-[#8C8478]">{t("comboHint")}</p>
        </div>
      )}

      {/* Per-yurt checkboxes */}
      <div className="flex flex-col gap-1.5">
        <Label required>{t("selectYurts")}</Label>
        <div
          className={`flex flex-col gap-1 pl-2 border-l-2 transition-colors ${
            form.error === t("selectAtLeastOne") ? "border-[#DC3545]" : "border-[#E8E2D9]"
          }`}
        >
          {form.activeYurts.map((y) => {
            const isOccupied = form.occupiedYurtIds.has(y.id)
            return (
              <label
                key={y.id}
                className={`flex items-center gap-2 text-sm py-0.5 ${
                  isOccupied ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.yurtIds.includes(y.id)}
                  disabled={isOccupied}
                  onChange={(e) => form.toggleYurt(y.id, e.target.checked)}
                />
                <span className="flex-1">
                  {y.name}{y.alias ? ` (${y.alias})` : ""} · {y.capacity}{t("capacityUnit")}
                  {isOccupied && (
                    <span className="ml-2 text-[11px] text-[#DC3545]">{t("occupied")}</span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
        {form.capacityExceeded && (
          <p className="text-xs text-[#DC3545]">
            {t("capacityExceeded", {
              guests: form.guestCount ?? 0,
              capacity: form.combinedCapacity,
            })}
          </p>
        )}
      </div>

      {/* Deposit override */}
      <div>
        <Label>{t("depositOverride")}</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "#2C2416" }}>$</span>
          <input
            type="number"
            min="0"
            step="1"
            value={form.customDeposit}
            onChange={(e) => form.setCustomDeposit(e.target.value)}
            placeholder={t("depositPlaceholder", { n: form.yurtIds.length, total: form.yurtIds.length * 300 })}
            className="flex-1 h-11 px-3 rounded-lg border outline-none bg-white"
            style={{ borderColor: "#E8E2D9", color: "#2C2416" }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#6B7F5E"
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(107,127,94,0.15)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#E8E2D9"
              e.currentTarget.style.boxShadow = "none"
            }}
          />
        </div>
        {form.yurtIds.length > 0 && (
          <p className="mt-1 text-[12px] text-[#6B7F5E] font-medium">
            {t("depositPreview", { total: form.previewDeposit })}
          </p>
        )}
      </div>

      {/* Special requests editor — pre-filled with inquiry.note, admin can edit */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>{t("specialRequestsLabel")}</Label>
          {inquiry?.note?.trim() && form.specialRequestsTouched && (
            <button
              type="button"
              onClick={form.resetSpecialRequestsToOriginal}
              className="text-[11px] font-medium text-[#6B7F5E] hover:text-[#5A6B4E] cursor-pointer bg-transparent border-none p-0"
            >
              ↺ {t("specialRequestsResetCta")}
            </button>
          )}
        </div>
        <textarea
          value={form.specialRequests}
          onChange={(e) => form.setSpecialRequests(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border outline-none bg-white text-sm leading-relaxed resize-y"
          style={{ borderColor: "#E8E2D9", color: "#2C2416", minHeight: "72px" }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#6B7F5E"
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(107,127,94,0.15)"
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E8E2D9"
            e.currentTarget.style.boxShadow = "none"
          }}
        />
        {!!inquiry?.note?.trim() && !form.specialRequests.trim() ? (
          <p className="text-[12px] font-semibold text-[#DC3545] flex items-start gap-1">
            <span>⚠️</span>
            <span>{t("specialRequestsLossWarning")}</span>
          </p>
        ) : (
          <p className="text-[11px] text-[#8C8478]">{t("specialRequestsHint")}</p>
        )}
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
    <label className="block text-[13px] font-semibold mb-1.5" style={{ color: "#2C2416" }}>
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  )
}
