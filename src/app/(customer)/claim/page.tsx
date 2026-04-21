"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations, useLocale } from "next-intl"
import { ArrowLeft, Search, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import InlineAuthTabs from "@/components/customer/InlineAuthTabs"

interface ReservationInfo {
  confirmationCode: string
  date: string
  guestCount: number
  yurtName: string | null
  status: string
  guestName: string | null
  claimed: boolean
  userId: string
}

export default function ClaimPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[#F8F7F4]">
        <Loader2 size={24} className="animate-spin text-[#6B7F5E]" />
      </div>
    }>
      <ClaimPage />
    </Suspense>
  )
}

function ClaimPage() {
  const t = useTranslations("claim")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()

  const [code, setCode] = useState("")
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState("")
  const [reservation, setReservation] = useState<ReservationInfo | null>(null)
  const [claimSuccess, setClaimSuccess] = useState(false)

  const handleLookup = useCallback(async (lookupCode: string, lookupToken: string | null) => {
    const trimmed = lookupCode.trim().toUpperCase()
    if (!trimmed) return

    setLoading(true)
    setError("")
    setReservation(null)
    setClaimSuccess(false)

    const qs = new URLSearchParams({ code: trimmed })
    if (lookupToken) qs.set("t", lookupToken)

    try {
      const res = await fetch(`/api/reservations/lookup?${qs.toString()}`)
      if (res.status === 404) {
        setError(t("notFound"))
        return
      }
      if (!res.ok) {
        setError(t("notFound"))
        return
      }
      const data: ReservationInfo = await res.json()
      setReservation(data)
    } catch {
      setError(t("notFound"))
    } finally {
      setLoading(false)
    }
  }, [t])

  // Handle ?code=XXX&t=YYY from URL
  useEffect(() => {
    const urlCode = searchParams.get("code")
    const urlToken = searchParams.get("t")
    if (urlCode) {
      const upper = urlCode.trim().toUpperCase()
      setCode(upper)
      setToken(urlToken?.trim() || null)
      handleLookup(upper, urlToken?.trim() || null)
    }
  }, [searchParams, handleLookup])

  const handleClaim = async () => {
    if (!reservation) return

    setClaiming(true)
    setError("")

    try {
      const res = await fetch("/api/reservations/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: reservation.confirmationCode,
          ...(token ? { token } : {}),
        }),
      })

      if (res.status === 409) {
        setError(t("alreadyClaimed"))
        setClaiming(false)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t("notFound"))
        setClaiming(false)
        return
      }

      setClaimSuccess(true)
      // Update local reservation state to reflect claim
      setReservation((prev) =>
        prev ? { ...prev, claimed: true, userId: session?.user?.id ?? prev.userId } : prev
      )
    } catch {
      setError(t("notFound"))
    } finally {
      setClaiming(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    })
  }

  const statusLabel = (status: string) => {
    const knownStatuses = [
      'PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'CONFIRMED',
      'COMPLETED', 'CANCELLED', 'EXPIRED',
    ]
    if (knownStatuses.includes(status)) {
      return t(`statusLabels.${status}`)
    }
    return status
  }

  const isOwnReservation = reservation && session?.user?.id === reservation.userId
  const canClaim = reservation && !reservation.claimed && session?.user?.id && !isOwnReservation

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => router.push("/")}
          aria-label={t("back")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#E8ECE4] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#2C2416]" />
        </button>
        <h1 className="text-xl font-serif font-semibold text-[#2C2416]">
          {t("title")}
        </h1>
      </div>

      <div className="flex-1 px-5 pb-8">
        <p className="text-[#6B6157] text-sm mb-6">{t("subtitle")}</p>

        {/* Code Input */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder={t("codePlaceholder")}
              maxLength={6}
              className="w-full h-14 px-4 rounded-2xl border border-[#E8ECE4] bg-white
                         text-[#2C2416] font-mono text-2xl tracking-[0.3em] text-center
                         placeholder:text-[#6B6157]/30 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal
                         focus:outline-none focus:ring-2 focus:ring-[#6B7F5E]/20 focus:border-[#6B7F5E]
                         transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length > 0) handleLookup(code, token)
              }}
            />
          </div>
          <button
            onClick={() => handleLookup(code, token)}
            disabled={loading || code.length === 0}
            className="w-full h-12 rounded-full bg-[#6B7F5E] text-white text-sm font-semibold
                       hover:bg-[#5A6E4E] disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {t("lookup")}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm mb-6">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Reservation Details */}
        {reservation && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8ECE4] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8ECE4]">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-[#2C2416]">
                  {t("reservationDetails")}
                </h2>
                <span className="font-mono text-sm text-[#6B7F5E] bg-[#E8ECE4] px-3 py-1 rounded-full">
                  {reservation.confirmationCode}
                </span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <DetailRow label={t("date")} value={formatDate(reservation.date)} />
              <DetailRow label={t("guests")} value={`${reservation.guestCount}`} />
              {reservation.yurtName && (
                <DetailRow label={t("yurt")} value={reservation.yurtName} />
              )}
              <DetailRow label={t("status")} value={statusLabel(reservation.status)} />
              {reservation.guestName && (
                <DetailRow label={t("guest")} value={reservation.guestName} />
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-[#E8ECE4]">
              {/* Claim success */}
              {(claimSuccess || isOwnReservation) && (
                <div className="flex items-center gap-2 text-[#6B7F5E] bg-[#E8ECE4]/50 px-4 py-3 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("claimed")}</span>
                </div>
              )}

              {/* Already claimed by another user */}
              {reservation.claimed && !isOwnReservation && !claimSuccess && (
                <div className="flex items-center gap-2 text-[#6B6157] bg-[#F2EDE6] px-4 py-3 rounded-xl">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm">{t("alreadyClaimed")}</span>
                </div>
              )}

              {/* Not logged in — inline login + register tabs */}
              {!reservation.claimed && sessionStatus !== "loading" && !session?.user && (
                <InlineAuthTabs
                  claimCode={reservation.confirmationCode}
                  claimToken={token}
                  onSuccess={(dest) => router.push(dest)}
                />
              )}

              {/* Can claim */}
              {canClaim && !claimSuccess && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full h-[48px] rounded-full bg-[#6B7F5E] text-white font-medium
                             hover:bg-[#5A6E4E] disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all flex items-center justify-center gap-2"
                >
                  {claiming && <Loader2 className="w-4 h-4 animate-spin" />}
                  {claiming ? t("claiming") : t("claimButton")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-[#6B6157] hover:text-[#2C2416] transition-colors underline underline-offset-2"
          >
            {t("back")}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[#6B6157]">{label}</span>
      <span className="text-sm font-medium text-[#2C2416]">{value}</span>
    </div>
  )
}
