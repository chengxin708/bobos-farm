"use client"

import { useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeft, Loader2 } from "lucide-react"
import useSWR from "swr"
import { DatePickerCalendar, type DateStatus } from "@/components/customer/DatePickerCalendar"
import { GuestRangePicker, type GuestRangeValue } from "@/components/customer/GuestRangePicker"

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
  const [guests, setGuests] = useState<GuestRangeValue | null>(() => {
    const minParam = parseInt(searchParams.get("guestCountMin") ?? "", 10)
    const maxParam = parseInt(searchParams.get("guestCountMax") ?? "", 10)
    if (Number.isFinite(minParam) && Number.isFinite(maxParam) && minParam > 0 && maxParam >= minParam) {
      return { min: minParam, max: maxParam }
    }
    const single = parseInt(searchParams.get("guestCount") ?? "", 10)
    if (Number.isFinite(single) && single > 0) {
      return { min: single, max: single }
    }
    return null
  })
  const [note, setNote] = useState(searchParams.get("note") ?? "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const [today] = useState(() => new Date())

  // Use the same settings-backed booking window as /booking/date. For inquiries
  // we still respect the farm's configured window (no point collecting dates
  // the farm isn't even open for), but we leave sold-out days clickable so
  // "I want this date even though it's full" inquiries can come through.
  const { data: settings } = useSWR<Record<string, string>>("/api/settings/public", fetcher, {
    revalidateOnFocus: false,
  })
  const minAdvanceDays = settings?.min_advance_booking_days
    ? Number(settings.min_advance_booking_days)
    : 1
  const maxAdvanceDays = settings?.max_advance_booking_days
    ? Number(settings.max_advance_booking_days)
    : 90

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

  const canSubmit = preferredDate != null && guests != null && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !preferredDate || !guests) return
    setError("")
    setBusy(true)
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredDate,
          guestCountMin: guests.min,
          guestCountMax: guests.max,
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
    <div className="min-h-full flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#E8ECE4] transition-colors"
          aria-label={tCommon("back")}
        >
          <ArrowLeft className="w-5 h-5 text-[#2C2416]" />
        </button>
        <h1 className="text-xl font-serif font-semibold text-[#2C2416]">{t("title")}</h1>
      </div>

      <div className="flex-1 px-5 pb-8">
        <p className="text-[#6B6157] text-sm mb-6">{t("subtitle")}</p>

        {error && (
          <div className="bg-[#C4453A]/10 text-[#C4453A] rounded-xl p-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#6B6157]">{t("preferredDate")}</span>
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

          <GuestRangePicker value={guests} onChange={setGuests} />

          <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
            {t("note")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder={t("notePlaceholder")}
              className="px-3 py-2.5 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E] resize-none"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 rounded-full bg-[#6B7F5E] text-white font-semibold hover:bg-[#5A6E4E] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {t("submit")}
          </button>
        </form>
      </div>
    </div>
  )
}
