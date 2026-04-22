"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { formatPhoneUS } from "@/lib/phone-mask"

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
})

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

export interface UseCreateInquiryFormArgs {
  isOpen: boolean
  defaultDate?: string
  onCreated: () => void
  onClose: () => void
}

export function useCreateInquiryForm({
  isOpen,
  defaultDate,
  onCreated,
  onClose,
}: UseCreateInquiryFormArgs) {
  const t = useTranslations("admin.createInquiry")

  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestWechatId, setGuestWechatId] = useState("")
  const [preferredDate, setPreferredDate] = useState<string | null>(defaultDate ?? null)
  const [guestCountMin, setGuestCountMin] = useState<number>(10)
  const [guestCountMax, setGuestCountMax] = useState<number>(10)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Pull the settings-backed booking window so the date picker mirrors the
  // customer-facing one (no dates before min_advance, no past dates).
  const { data: settings } = useSWR<Record<string, string>>(
    isOpen ? "/api/settings/public" : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  const minAdvanceDays = settings?.min_advance_booking_days
    ? Number(settings.min_advance_booking_days)
    : 1
  const maxAdvanceDays = settings?.max_advance_booking_days
    ? Number(settings.max_advance_booking_days)
    : 180
  const today = isOpen ? new Date() : null
  const earliestStr = today ? (() => { const d = new Date(today); d.setDate(d.getDate() + minAdvanceDays); return toLocalDateStr(d) })() : ""
  const latestStr = today ? (() => { const d = new Date(today); d.setDate(d.getDate() + maxAdvanceDays); return toLocalDateStr(d) })() : ""

  const { data: slots } = useSWR<Record<string, { total: number; occupied: number; available: number }>>(
    isOpen && earliestStr && latestStr
      ? `/api/availability/slots?startDate=${earliestStr}&endDate=${latestStr}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  // Reset form every time the modal opens. External sync from the isOpen
  // prop — not a derived-state antipattern.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return
    setGuestName("")
    setGuestEmail("")
    setGuestPhone("")
    setGuestWechatId("")
    setPreferredDate(defaultDate ?? null)
    setGuestCountMin(10)
    setGuestCountMax(10)
    setNote("")
    setError("")
    setSubmitting(false)
    setTimeout(() => nameInputRef.current?.focus(), 100)
  }, [isOpen, defaultDate])
  /* eslint-enable react-hooks/set-state-in-effect */

  function setPhoneWithMask(raw: string) {
    setGuestPhone(formatPhoneUS(raw))
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setError("")

    const hasContact = guestEmail.trim() || guestPhone.trim() || guestWechatId.trim()
    if (!hasContact) {
      setError(t("atLeastOneContactRequired"))
      return
    }
    if (!preferredDate) {
      setError(t("dateRequired"))
      return
    }
    if (guestCountMax < guestCountMin) {
      setError(t("countRangeInvalid"))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/inquiries/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          guestEmail: guestEmail || undefined,
          guestPhone: guestPhone || undefined,
          guestWechatId: guestWechatId || undefined,
          preferredDate,
          guestCountMin,
          guestCountMax,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t("createFailed"))
        setSubmitting(false)
        return
      }
      onCreated()
      onClose()
    } catch {
      setError(t("networkError"))
      setSubmitting(false)
    }
  }

  return {
    t,
    nameInputRef,
    // state
    guestName, setGuestName,
    guestEmail, setGuestEmail,
    guestPhone, setPhoneWithMask,
    guestWechatId, setGuestWechatId,
    preferredDate, setPreferredDate,
    guestCountMin, setGuestCountMin,
    guestCountMax, setGuestCountMax,
    note, setNote,
    // data
    earliestStr,
    latestStr,
    slots,
    // submit
    submitting, error, handleSubmit,
  }
}

export type CreateInquiryFormModel = ReturnType<typeof useCreateInquiryForm>
