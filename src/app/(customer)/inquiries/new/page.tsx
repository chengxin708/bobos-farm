"use client"

import { useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronLeft, Loader2 } from "lucide-react"
import useSWR from "swr"
import { DatePickerCalendar, type DateStatus } from "@/components/customer/DatePickerCalendar"
import { GuestCountPicker } from "@/components/customer/GuestCountPicker"
import { LanguageToggle } from "@/components/customer/LanguageToggle"

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
})

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export default function InquiryNewPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-[#F8F7F4]">
          <Loader2 size={24} className="animate-spin text-[#6B7F5E]" />
        </div>
      }
    >
      <InquiryNewPage />
    </Suspense>
  )
}

function InquiryNewPage() {
  const t = useTranslations("inquiryForm")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const searchParams = useSearchParams()

  const [preferredDate, setPreferredDate] = useState<string | null>(
    searchParams.get("date") || null,
  )
  const [guestCount, setGuestCount] = useState<number | null>(() => {
    const single = parseInt(searchParams.get("guestCount") ?? "", 10)
    if (Number.isFinite(single) && single > 0) return single
    // Back-compat: legacy redirects passed guestCountMin/Max for range intent.
    // We no longer collect ranges from customers — just seed with min.
    const minParam = parseInt(searchParams.get("guestCountMin") ?? "", 10)
    if (Number.isFinite(minParam) && minParam > 0) return minParam
    return null
  })
  const [note, setNote] = useState(searchParams.get("note") ?? "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [today] = useState(() => new Date())

  const { data: settings } = useSWR<Record<string, string>>("/api/settings/public", fetcher, {
    revalidateOnFocus: false,
  })
  const minAdvanceDays = settings?.min_advance_booking_days
    ? Number(settings.min_advance_booking_days)
    : 1
  const maxAdvanceDays = settings?.max_advance_booking_days
    ? Number(settings.max_advance_booking_days)
    : 90
  const minRecommended = settings?.guest_warning_threshold
    ? Number(settings.guest_warning_threshold)
    : undefined

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
    if (!slots || typeof slots !== "object") return {}
    const map: Record<string, DateStatus> = {}
    for (const [dateKey, info] of Object.entries(slots)) {
      if (info.available === 0) map[dateKey] = "full"
      else if (info.available === 1) map[dateKey] = "limited"
      else map[dateKey] = "available"
    }
    return map
  }, [slots])

  const canSubmit = preferredDate != null && guestCount != null && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !preferredDate || guestCount == null) return
    setError("")
    setBusy(true)
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredDate,
          guestCountMin: guestCount,
          guestCountMax: guestCount,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t("submitFailed"))
        setBusy(false)
        return
      }
      const body = await res.json()
      router.push(`/inquiries/${body.inquiry.id}/submitted`)
    } catch {
      setError(t("networkError"))
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 bg-[#F8F7F4] px-4 py-3 grid grid-cols-3 items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="justify-self-start flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon("back")}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <div className="justify-self-center">
          <LanguageToggle />
        </div>
        <span className="justify-self-end text-[15px] text-[#6B6157]">{t("stepLabel")}</span>
      </div>

      <div className="shrink-0 text-center mt-4 mb-4 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">{t("title")}</h1>
        <p className="text-[13px] text-[#6B6157] mt-1">{t("subtitle")}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
        <div className="max-w-[560px] mx-auto flex flex-col gap-5">
          {error && (
            <div className="bg-[#C4453A]/10 text-[#C4453A] rounded-xl p-3 text-sm">{error}</div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#1A1208]">{t("preferredDate")}</span>
            <DatePickerCalendar
              value={preferredDate}
              onChange={setPreferredDate}
              minDate={earliestStr}
              maxDate={latestStr}
              dateStatus={dateStatusMap}
              allowFullDates
              showLegend={false}
            />
          </div>

          <GuestCountPicker
            value={guestCount}
            onChange={setGuestCount}
            minRecommended={minRecommended}
          />

          <label className="flex flex-col gap-1 text-sm text-[#1A1208]">
            <span className="font-semibold">{t("note")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder={t("notePlaceholder")}
              style={{ border: '1px solid #E8ECE4', outline: 'none' }}
              className="px-3 py-2.5 rounded-xl text-[#1A1208] focus:!border-[#6B7F5E] bg-white resize-none transition-colors"
            />
          </label>
        </div>
      </div>

      <div className="shrink-0 p-4 pb-6 bg-[#F8F7F4]">
        <div className="max-w-[560px] mx-auto">
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={!canSubmit}
            className={`w-full py-3.5 rounded-full text-base font-medium border-none transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-[#6B7F5E] text-white cursor-pointer shadow-[0_2px_8px_rgba(107,127,94,0.25)]'
                : 'bg-[#6B7F5E] text-white opacity-40 cursor-not-allowed'
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("submit")}
          </button>
        </div>
      </div>
    </div>
  )
}
