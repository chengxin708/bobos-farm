"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import useSWR from "swr"
import { formatPhoneUS } from "@/lib/phone-mask"

export interface Yurt {
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

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("Fetch failed")
  return r.json()
})

export type YurtMode = "auto" | "specific" | "hold"

export interface UseCreateReservationFormArgs {
  isOpen: boolean
  defaultDate?: string
  defaultYurtId?: string
  onCreated: () => void
  onClose: () => void
}

/**
 * Owns all state, derived values, validation, and submit logic for the
 * "create reservation" flow. The desktop and mobile modals render this
 * shared data into their own layout without duplicating business logic.
 */
export function useCreateReservationForm({
  isOpen,
  defaultDate,
  defaultYurtId,
  onCreated,
  onClose,
}: UseCreateReservationFormArgs) {
  const t = useTranslations("admin.createReservation")
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN"

  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [guestWechatId, setGuestWechatId] = useState("")
  const [date, setDate] = useState(defaultDate || "")
  const [yurtMode, setYurtMode] = useState<YurtMode>(defaultYurtId ? "specific" : "auto")
  const [yurtIds, setYurtIds] = useState<string[]>(defaultYurtId ? [defaultYurtId] : [])
  const [guestCount, setGuestCount] = useState(1)
  const [specialRequests, setSpecialRequests] = useState("")
  const [customDeposit, setCustomDeposit] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const nameInputRef = useRef<HTMLInputElement>(null)

  const { data: yurts } = useSWR<Yurt[]>(isOpen ? "/api/yurts" : null, fetcher)
  const activeYurts = (yurts || []).filter((y) => y.status === "ACTIVE")

  const { data: dateReservations } = useSWR<DateReservation[]>(
    isOpen && date ? `/api/reservations?date=${date}` : null,
    (url: string) => fetch(url).then((r) => r.json()).then((d) => d.reservations ?? d),
    { revalidateOnFocus: false },
  )

  const occupiedYurtIds = new Set(
    (dateReservations || [])
      .filter((r) => r.yurtId && !["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"].includes(r.status))
      .map((r) => r.yurtId),
  )
  const availableYurts = activeYurts.filter((y) => !occupiedYurtIds.has(y.id))
  const fittingYurts = availableYurts.filter((y) => y.capacity >= guestCount)

  const selectedYurts = activeYurts.filter((y) => yurtIds.includes(y.id))
  const combinedCapacity = selectedYurts.reduce((s, y) => s + y.capacity, 0)
  const capacityExceeded =
    yurtMode === "specific" && selectedYurts.length > 0 && guestCount > combinedCapacity
  const selectedYurtOccupied = selectedYurts.some((y) => occupiedYurtIds.has(y.id))
  const noRoomAvailable = Boolean(
    date && guestCount > 0 && yurtMode === "auto" && dateReservations && fittingYurts.length === 0,
  )
  const isPastDate = !!date && date < new Date().toISOString().slice(0, 10)

  // Reset form each time the modal opens. The state reset is a legitimate
  // external sync (prop isOpen changes => form should reinit) — not a
  // derived-state antipattern the lint rule is guarding against.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return
    setGuestName("")
    setGuestEmail("")
    setGuestPhone("")
    setGuestWechatId("")
    setDate(defaultDate || "")
    setYurtMode(defaultYurtId ? "specific" : "auto")
    setYurtIds(defaultYurtId ? [defaultYurtId] : [])
    setGuestCount(1)
    setSpecialRequests("")
    setCustomDeposit("")
    setError("")
    setSubmitting(false)
    setTimeout(() => nameInputRef.current?.focus(), 100)
  }, [isOpen, defaultDate, defaultYurtId])
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleYurt(id: string, checked: boolean) {
    setYurtIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

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
    if (yurtMode === "specific" && yurtIds.length === 0) {
      setError(t("selectAtLeastOneYurt"))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName,
          guestEmail,
          guestPhone,
          guestWechatId: guestWechatId || undefined,
          date,
          ...(yurtMode === "specific" ? { yurtIds } : {}),
          holdAssignment: yurtMode === "hold" ? true : undefined,
          guestCount,
          specialRequests: specialRequests || undefined,
          ...(isAdmin && customDeposit !== "" ? { customDeposit: Number(customDeposit) } : {}),
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
    isAdmin,
    nameInputRef,
    // Field values + setters
    guestName, setGuestName,
    guestEmail, setGuestEmail,
    guestPhone, setPhoneWithMask,
    guestWechatId, setGuestWechatId,
    date, setDate,
    yurtMode, setYurtMode,
    yurtIds, toggleYurt,
    guestCount, setGuestCount,
    specialRequests, setSpecialRequests,
    customDeposit, setCustomDeposit,
    // Data
    activeYurts,
    occupiedYurtIds,
    // Derived
    capacityExceeded,
    combinedCapacity,
    selectedYurtOccupied,
    noRoomAvailable,
    isPastDate,
    selectedYurtsCount: yurtIds.length,
    // Submit
    submitting, error,
    handleSubmit,
  }
}

export type CreateReservationFormModel = ReturnType<typeof useCreateReservationForm>
