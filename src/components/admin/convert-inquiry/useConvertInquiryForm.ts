"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch failed")
  return r.json()
})

export interface InquirySnapshot {
  id: string
  preferredDate: string
  guestCountMin: number
  guestCountMax: number
  note: string | null
  user: { id: string; name: string | null; email: string; phone: string | null; wechatId: string | null }
}

interface YurtRow {
  id: string
  name: string
  alias?: string | null
  capacity: number
  status: string
}

interface DateReservation {
  id: string
  yurtId: string | null
  status: string
}

export interface ConversionResult {
  reservationId: string
  confirmationCode: string
  date: string
  guestCount: number
  depositAmount: number
  claimToken: string | null
}

interface UseArgs {
  inquiryId: string
  isOpen: boolean
  defaultDate: string
  defaultGuestCount: number
  onCancel: () => void
}

export function useConvertInquiryForm({
  inquiryId,
  isOpen,
  defaultDate,
  defaultGuestCount,
  onCancel,
}: UseArgs) {
  const t = useTranslations("adminInquiries.convertModal")

  const [date, setDate] = useState<string | null>(defaultDate.slice(0, 10))
  const [guestCount, setGuestCount] = useState<number | null>(defaultGuestCount)
  const [yurtIds, setYurtIds] = useState<string[]>([])
  const [customDeposit, setCustomDeposit] = useState<string>("")
  const [copyNote, setCopyNote] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ConversionResult | null>(null)

  // Reset on open so re-opening the modal after a previous conversion
  // doesn't show the old success screen.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return
    setDate(defaultDate.slice(0, 10))
    setGuestCount(defaultGuestCount)
    setYurtIds([])
    setCustomDeposit("")
    setCopyNote(true)
    setError("")
    setResult(null)
    setSubmitting(false)
  }, [isOpen, defaultDate, defaultGuestCount])
  /* eslint-enable react-hooks/set-state-in-effect */

  const { data: inquiry } = useSWR<InquirySnapshot>(
    isOpen ? `/api/inquiries/${inquiryId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const { data: yurts } = useSWR<YurtRow[]>(isOpen ? "/api/yurts" : null, fetcher)
  const activeYurts = useMemo(
    () => (yurts || []).filter((y) => y.status === "ACTIVE"),
    [yurts],
  )

  const { data: dateReservations } = useSWR<DateReservation[]>(
    isOpen && date ? `/api/reservations?date=${date}` : null,
    (url: string) => fetch(url).then((r) => r.json()).then((d) => d.reservations ?? d),
    { revalidateOnFocus: false },
  )

  const occupiedYurtIds = useMemo(
    () =>
      new Set(
        (dateReservations || [])
          .filter((r) => r.yurtId && !["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"].includes(r.status))
          .map((r) => r.yurtId as string),
      ),
    [dateReservations],
  )

  const freeYurts = useMemo(
    () => activeYurts.filter((y) => !occupiedYurtIds.has(y.id)),
    [activeYurts, occupiedYurtIds],
  )

  // Enumerate every non-empty subset of the free yurts whose combined
  // capacity fits guestCount. Sort by smallest total capacity first so
  // the least-wasteful combination surfaces as the leading chip.
  const yurtCombos = useMemo(() => {
    if (!guestCount || freeYurts.length === 0) return []
    const combos: { ids: string[]; totalCapacity: number }[] = []
    const n = freeYurts.length
    const mask_limit = 1 << n
    for (let mask = 1; mask < mask_limit; mask++) {
      const ids: string[] = []
      let total = 0
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          ids.push(freeYurts[i].id)
          total += freeYurts[i].capacity
        }
      }
      if (total >= guestCount) combos.push({ ids, totalCapacity: total })
    }
    combos.sort((a, b) => a.totalCapacity - b.totalCapacity || a.ids.length - b.ids.length)
    return combos.slice(0, 6)
  }, [freeYurts, guestCount])

  const selectedYurts = useMemo(
    () => activeYurts.filter((y) => yurtIds.includes(y.id)),
    [activeYurts, yurtIds],
  )
  const combinedCapacity = selectedYurts.reduce((s, y) => s + y.capacity, 0)
  const capacityExceeded =
    selectedYurts.length > 0 && !!guestCount && guestCount > combinedCapacity

  // Soft-warn if admin picked a guest count outside the customer's
  // original ask — helps catch typos like "50 instead of 5".
  const outOfOriginalRange = Boolean(
    inquiry && guestCount != null &&
      (guestCount < inquiry.guestCountMin || guestCount > inquiry.guestCountMax),
  )

  const isPastDate = !!date && date < new Date().toISOString().slice(0, 10)

  const previewDeposit = useMemo(() => {
    if (customDeposit !== "") {
      const n = Number(customDeposit)
      return Number.isFinite(n) ? n : 0
    }
    return yurtIds.length * 300
  }, [customDeposit, yurtIds])

  function toggleYurt(id: string, checked: boolean) {
    setYurtIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  function applyCombo(ids: string[]) {
    setYurtIds(ids)
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setError("")
    if (!date) {
      setError(t("dateRequired"))
      return
    }
    if (!guestCount) {
      setError(t("guestCountRequired"))
      return
    }
    if (yurtIds.length === 0) {
      setError(t("selectAtLeastOne"))
      return
    }
    if (capacityExceeded) {
      setError(t("capacityExceeded", { guests: guestCount, capacity: combinedCapacity }))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yurtIds,
          guestCount,
          date,
          ...(customDeposit !== "" ? { customDeposit: Number(customDeposit) } : {}),
          copyNoteToSpecialRequests: copyNote,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || t("failed"))
        setSubmitting(false)
        return
      }
      const body = await res.json() as {
        reservation: { id: string; confirmationCode: string; date: string; depositAmount: number }
        claimToken: string | null
      }
      setResult({
        reservationId: body.reservation.id,
        confirmationCode: body.reservation.confirmationCode,
        date: body.reservation.date,
        guestCount,
        depositAmount: body.reservation.depositAmount,
        claimToken: body.claimToken,
      })
      setSubmitting(false)
    } catch {
      setError(t("networkError"))
      setSubmitting(false)
    }
  }

  return {
    t,
    onCancel,
    // Fetched data
    inquiry,
    activeYurts,
    freeYurts,
    occupiedYurtIds,
    yurtCombos,
    // Form state
    date, setDate,
    guestCount, setGuestCount,
    yurtIds, toggleYurt, applyCombo,
    customDeposit, setCustomDeposit,
    copyNote, setCopyNote,
    // Derived
    combinedCapacity,
    capacityExceeded,
    outOfOriginalRange,
    isPastDate,
    previewDeposit,
    // Submit + result
    submitting, error, handleSubmit,
    result,
  }
}

export type ConvertInquiryFormModel = ReturnType<typeof useConvertInquiryForm>
