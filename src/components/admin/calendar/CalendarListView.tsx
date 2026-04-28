"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Filter,
  ShieldCheck,
  User as UserIcon,
  MessageCircle,
} from "lucide-react"

// ── Types (mirror the CalendarDesktop shape) ──────────────────────

interface ReservationUser {
  id: string
  name: string | null
  email: string
  phone: string | null
}

interface ReservationYurt {
  id: string
  name: string
  alias?: string | null
  capacity: number
}

export interface ListReservation {
  id: string
  userId: string
  yurtId: string | null
  date: string
  guestCount: number
  specialRequests: string | null
  status:
    | "PENDING_PAYMENT"
    | "PAYMENT_SUBMITTED"
    | "CONFIRMED"
    | "COMPLETED"
    | "CANCELLED"
    | "CANCELLED_PENDING_REFUND"
    | "EXPIRED"
  depositAmount: number
  depositStatus: string
  holdByAdmin?: boolean
  paymentDeadline?: string | null
  createdAt?: string
  user: ReservationUser
  yurt: ReservationYurt | null
  orders?: Array<{ status: string; estimatedTotal: number | null; finalTotal: number | null }>
}

type SortKey =
  | "date"
  | "customerName"
  | "guestCount"
  | "yurt"
  | "status"
  | "paymentDeadline"
  | "createdAt"
type SortDir = "asc" | "desc"
type StatusFilter = "all" | "pending" | "confirmed" | "completed"
type SourceFilter = "all" | "self" | "admin"

interface Props {
  reservations: ListReservation[]
  onSelect: (id: string) => void
  selectedId?: string | null
}

// ── Status badge config ───────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING_PAYMENT:   { bg: "bg-[#E67E22]/10", text: "text-[#E67E22]" },
  PAYMENT_SUBMITTED: { bg: "bg-[#E67E22]/10", text: "text-[#E67E22]" },
  CONFIRMED:         { bg: "bg-[#2980B9]/10", text: "text-[#2980B9]" },
  COMPLETED:         { bg: "bg-[#8C8478]/10", text: "text-[#8C8478]" },
  CANCELLED:         { bg: "bg-red-50",        text: "text-red-400" },
  EXPIRED:           { bg: "bg-gray-50",       text: "text-gray-400" },
}

function statusLabel(status: string, t: ReturnType<typeof useTranslations>): string {
  const key = ({
    PENDING_PAYMENT: "pendingPayment",
    PAYMENT_SUBMITTED: "paymentSubmitted",
    CONFIRMED: "confirmed",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    CANCELLED_PENDING_REFUND: "cancelled",
    EXPIRED: "expired",
  } as Record<string, string>)[status]
  return key ? t(`status.${key}`) : status
}

function getDisplayName(user: ReservationUser): string {
  if (user.name) return user.name
  if (user.email && !user.email.endsWith("@placeholder.local")) {
    return user.email.split("@")[0]
  }
  if (user.phone) return user.phone
  return "(unnamed)"
}

function formatDateISO(s: string): string {
  return s.slice(0, 10)
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—"
  const d = new Date(s)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDeadlineRelative(s: string | null | undefined): { label: string; tone: "ok" | "soon" | "overdue" } {
  if (!s) return { label: "—", tone: "ok" }
  const target = new Date(s).getTime()
  const now = Date.now()
  const diff = target - now
  if (diff <= 0) return { label: "overdue", tone: "overdue" }
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  return { label, tone: hours < 6 ? "soon" : "ok" }
}

// ── Component ──────────────────────────────────────────────────────

export default function CalendarListView({ reservations, onSelect, selectedId }: Props) {
  const t = useTranslations("admin.calendar.listView")
  const tCal = useTranslations("admin.calendar")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const todayKey = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  // ── Filter ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reservations.filter((r) => {
      // Upcoming + alive only.
      if (
        r.status === "CANCELLED" ||
        r.status === "CANCELLED_PENDING_REFUND" ||
        r.status === "EXPIRED"
      ) {
        return false
      }
      const dateMs = new Date(r.date).getTime()
      if (Number.isNaN(dateMs) || dateMs < todayKey) return false

      // Status filter
      if (statusFilter === "pending") {
        if (r.status !== "PENDING_PAYMENT" && r.status !== "PAYMENT_SUBMITTED") return false
      } else if (statusFilter === "confirmed") {
        if (r.status !== "CONFIRMED") return false
      } else if (statusFilter === "completed") {
        if (r.status !== "COMPLETED") return false
      }

      // Source filter
      if (sourceFilter === "admin" && !r.holdByAdmin) return false
      if (sourceFilter === "self" && r.holdByAdmin) return false

      // Search across name / phone / email
      if (q) {
        const inName = (r.user.name || "").toLowerCase().includes(q)
        const inEmail = (r.user.email || "").toLowerCase().includes(q)
        const inPhone = (r.user.phone || "").toLowerCase().includes(q)
        if (!inName && !inEmail && !inPhone) return false
      }
      return true
    })
  }, [reservations, search, statusFilter, sourceFilter, todayKey])

  // ── Sort ───────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1
    const cmp = (a: ListReservation, b: ListReservation): number => {
      switch (sortKey) {
        case "date":
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case "customerName":
          return getDisplayName(a.user).localeCompare(getDisplayName(b.user))
        case "guestCount":
          return a.guestCount - b.guestCount
        case "yurt":
          return (a.yurt?.name || "").localeCompare(b.yurt?.name || "")
        case "status":
          return a.status.localeCompare(b.status)
        case "paymentDeadline": {
          const aD = a.paymentDeadline ? new Date(a.paymentDeadline).getTime() : Number.POSITIVE_INFINITY
          const bD = b.paymentDeadline ? new Date(b.paymentDeadline).getTime() : Number.POSITIVE_INFINITY
          return aD - bD
        }
        case "createdAt": {
          const aC = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bC = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return aC - bC
        }
      }
      return 0
    }
    return [...filtered].sort((a, b) => sign * cmp(a, b))
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="opacity-30 ml-1" />
    }
    return sortDir === "asc" ? (
      <ChevronUp size={12} className="ml-1" />
    ) : (
      <ChevronDown size={12} className="ml-1" />
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 bg-white rounded-xl border border-[#E8ECE4] overflow-hidden">
      {/* Search & filter bar */}
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#E8ECE4] bg-[#FAFAF7]">
        <div className="relative flex-1 min-w-[260px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7E6B]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full h-9 pl-9 pr-3 rounded-full text-sm bg-white border border-[#E8ECE4] outline-none focus:border-[#6B7F5E] transition-colors"
          />
        </div>

        <FilterChipGroup
          label={t("statusFilterLabel")}
          options={[
            { value: "all", label: t("statusAll") },
            { value: "pending", label: t("statusPending") },
            { value: "confirmed", label: t("statusConfirmed") },
            { value: "completed", label: t("statusCompleted") },
          ]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />

        <FilterChipGroup
          label={t("sourceFilterLabel")}
          options={[
            { value: "all", label: t("sourceAll") },
            { value: "self", label: t("sourceSelf") },
            { value: "admin", label: t("sourceAdmin") },
          ]}
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v as SourceFilter)}
        />

        <div className="ml-auto text-xs text-[#8A7E6B] flex items-center gap-1.5">
          <Filter size={12} />
          {t("countSummary", { count: sorted.length, total: reservations.length })}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#FAFAF7]">
            <tr className="text-left text-[11px] uppercase tracking-wider text-[#8A7E6B]">
              <SortableTh keyName="date" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.date")}
              </SortableTh>
              <SortableTh keyName="customerName" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.customer")}
              </SortableTh>
              <th className="px-3 py-2.5 font-semibold">{t("col.phone")}</th>
              <th className="px-3 py-2.5 font-semibold">{t("col.email")}</th>
              <SortableTh keyName="guestCount" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.guests")}
              </SortableTh>
              <SortableTh keyName="yurt" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.yurt")}
              </SortableTh>
              <SortableTh keyName="status" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.status")}
              </SortableTh>
              <SortableTh keyName="paymentDeadline" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.deadline")}
              </SortableTh>
              <th className="px-3 py-2.5 font-semibold">{t("col.notes")}</th>
              <th className="px-3 py-2.5 font-semibold">{t("col.source")}</th>
              <SortableTh keyName="createdAt" current={sortKey} onSort={toggleSort} sortIcon={sortIcon}>
                {t("col.createdAt")}
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-sm text-[#8A7E6B]">
                  {t("emptyState")}
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const badge = STATUS_BADGE[r.status] || STATUS_BADGE.PENDING_PAYMENT
                const deadline = formatDeadlineRelative(r.paymentDeadline)
                const isSelected = r.id === selectedId
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    className={`border-t border-[#F0EDE6] cursor-pointer transition-colors ${
                      isSelected ? "bg-[#F5F2ED]" : "hover:bg-[#FAFAF7]"
                    }`}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[#2C2416]">
                      {formatDateISO(r.date)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#2C2416]">
                      {getDisplayName(r.user)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#5A4F3F]">
                      {r.user.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate text-[#5A4F3F]" title={r.user.email}>
                      {r.user.email.endsWith("@placeholder.local") ? (
                        <span className="italic text-[#8A7E6B]">{t("placeholderEmail")}</span>
                      ) : (
                        r.user.email
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-[#2C2416]">
                      {r.guestCount}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#2C2416]">
                      {r.yurt?.name || (
                        <span className="italic text-[#8A7E6B]">{t("yurtPending")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.bg} ${badge.text}`}
                      >
                        {statusLabel(r.status, tCal)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.paymentDeadline ? (
                        <span
                          className={`text-xs font-semibold ${
                            deadline.tone === "overdue"
                              ? "text-[#C4453A]"
                              : deadline.tone === "soon"
                                ? "text-[#E67E22]"
                                : "text-[#8A7E6B]"
                          }`}
                        >
                          {deadline.label === "overdue" ? t("overdue") : deadline.label}
                        </span>
                      ) : (
                        <span className="text-xs text-[#8A7E6B]">—</span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2.5 max-w-[260px] truncate text-[#5A4F3F]"
                      title={r.specialRequests || ""}
                    >
                      {r.specialRequests ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={11} className="text-[#8B6914] shrink-0" />
                          <span className="truncate">{r.specialRequests}</span>
                        </span>
                      ) : (
                        <span className="text-[#C4C0B6]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.holdByAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#8B6914]">
                          <ShieldCheck size={11} />
                          {t("sourceAdmin")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#6B7F5E]">
                          <UserIcon size={11} />
                          {t("sourceSelf")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8A7E6B]">
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function SortableTh({
  keyName,
  current,
  onSort,
  sortIcon,
  children,
}: {
  keyName: SortKey
  current: SortKey
  onSort: (k: SortKey) => void
  sortIcon: (k: SortKey) => React.ReactNode
  children: React.ReactNode
}) {
  return (
    <th className="px-3 py-2.5 font-semibold">
      <button
        type="button"
        onClick={() => onSort(keyName)}
        className={`inline-flex items-center bg-transparent border-none p-0 cursor-pointer text-[11px] uppercase tracking-wider font-semibold transition-colors ${
          current === keyName ? "text-[#2C2416]" : "text-[#8A7E6B] hover:text-[#2C2416]"
        }`}
      >
        {children}
        {sortIcon(keyName)}
      </button>
    </th>
  )
}

function FilterChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8A7E6B]">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                active
                  ? "bg-[#6B7F5E] text-white border-[#6B7F5E]"
                  : "bg-white text-[#5A4F3F] border-[#E8ECE4] hover:border-[#6B7F5E]/40"
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
