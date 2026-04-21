"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeft, Loader2 } from "lucide-react"

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
  const router = useRouter()
  const searchParams = useSearchParams()

  const [preferredDate, setPreferredDate] = useState(searchParams.get("date") ?? "")
  const prefillCount = parseInt(searchParams.get("guestCount") ?? "", 10)
  const [guestCountMin, setGuestCountMin] = useState<number>(
    Number.isFinite(prefillCount) && prefillCount > 0 ? prefillCount : 40,
  )
  const [guestCountMax, setGuestCountMax] = useState<number>(
    Number.isFinite(prefillCount) && prefillCount > 0 ? prefillCount : 60,
  )
  const [packageHint, setPackageHint] = useState<number | null>(null)
  const [note, setNote] = useState(searchParams.get("note") ?? "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (guestCountMax < guestCountMin) setGuestCountMax(guestCountMin)
  }, [guestCountMin, guestCountMax])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredDate,
          guestCountMin,
          guestCountMax,
          packageHint,
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
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#E8ECE4] transition-colors"
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
            {t("preferredDate")}
            <input
              type="date"
              required
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="h-11 px-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
              {t("guestCountMin")}
              <input
                type="number"
                required
                min={1}
                value={guestCountMin}
                onChange={(e) => setGuestCountMin(parseInt(e.target.value) || 1)}
                className="h-11 px-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
              {t("guestCountMax")}
              <input
                type="number"
                required
                min={1}
                value={guestCountMax}
                onChange={(e) => setGuestCountMax(parseInt(e.target.value) || 1)}
                className="h-11 px-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-[#2C2416]">
            {t("packageHint")}
            <input
              type="number"
              min={1}
              max={5}
              value={packageHint ?? ""}
              onChange={(e) => setPackageHint(e.target.value ? parseInt(e.target.value) : null)}
              className="h-11 px-3 rounded-xl border border-[#E8ECE4] focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E]"
              placeholder={t("packageHintPlaceholder")}
            />
            <span className="text-xs text-[#8C8478]">{t("packageHintHelp")}</span>
          </label>

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
            disabled={busy}
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
