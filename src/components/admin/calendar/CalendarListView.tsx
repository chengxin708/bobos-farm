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
  Calendar as CalendarIcon,
  ClipboardList,
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

export interface ListInquiry {
  id: string
  preferredDate: string
  guestCountMin: number
  guestCountMax: number
  note: string | null
  status: "PENDING" | "IN_PROGRESS" | "AWAITING_CUSTOMER" | "CONVERTED" | "CLOSED" | "EXPIRED"
  priority: "NORMAL" | "HIGH" | "URGENT"
  tags: string[]
  reservationId: string | null
  createdAt: string
  user: ReservationUser
}

type ListRowKind = "reservation" | "inquiry"

type ListRow =
  | ({ __kind: "reservation" } & ListReservation)
  | ({ __kind: "inquiry" } & ListInquiry)

const ACTIVE_INQUIRY_STATUSES = new Set(["PENDING", "IN_PROGRESS", "AWAITING_CUSTOMER"])

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
type KindFilter = "all" | ListRowKind

interface Props {
  reservations: ListReservation[]
  inquiries?: ListInquiry[]
  onSelectReservation: (id: string) => void
  onSelectInquiry?: (id: string) => void
  selectedReservationId?: string | null
  selectedInquiryId?: string | null
}

// ── Status badge config ───────────────────────────────────────────

const RESERVATION_STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING_PAYMENT:   { bg: "bg-[#E67E22]/10", text: "text-[#E67E22]" },
  PAYMENT_SUBMITTED: { bg: "bg-[#E67E22]/10", text: "text-[#E67E22]" },
  CONFIRMED:         { bg: "bg-[#2980B9]/10", text: "text-[#2980B9]" },
  COMPLETED:         { bg: "bg-[#8C8478]/10", text: "text-[#8C8478]" },
  CANCELLED:         { bg: "bg-red-50",        text: "text-red-400" },
  EXPIRED:           { bg: "bg-gray-50",       text: "text-gray-400" },
}

const INQUIRY_STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  PENDING:           { bg: "bg-[#C4A45C]/10", text: "text-[#8B6914]" },
  IN_PROGRESS:       { bg: "bg-[#6B7F5E]/10", text: "text-[#6B7F5E]" },
  AWAITING_CUSTOMER: { bg: "bg-[#8B6914]/10", text: "text-[#8B6914]" },
  CONVERTED:         { bg: "bg-[#2980B9]/10", text: "text-[#2980B9]" },
  CLOSED:            { bg: "bg-gray-50",       text: "text-gray-500" },
  EXPIRED:           { bg: "bg-gray-50",       text: "text-gray-400" },
}

function reservationStatusLabel(status: string, t: ReturnType<typeof useTranslations>): string {
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

export default function CalendarListView({
  reservations,
  inquiries = [],
  onSelectReservation,
  onSelectInquiry,
  selectedReservationId,
  selectedInquiryId,
}: Props) {
  const t = useTranslations("admin.calendar.listView")
  const tCal = useTranslations("admin.calendar")
  const tInq = useTranslations("adminInquiries.status")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [showArchivedInquiries, setShowArchivedInquiries] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const todayKey = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  // ── Helpers ────────────────────────────────────────────────────
  function rowDate(row: ListRow): string {
    return row.__kind === "reservation" ? row.date : row.preferredDate
  }
  function rowGuestCount(row: ListRow): number {
    return row.__kind === "reservation" ? row.guestCount : row.guestCountMax
  }

  // ── Filter ─────────────────────────────────────────────────────
  const filtered = useMemo<ListRow[]>(() => {
    const q = search.trim().toLowerCase()

    const reservationRows: ListRow[] = reservations
      .filter((r) => {
        if (
          r.status === "CANCELLED" ||
          r.status === "CANCELLED_PENDING_REFUND" ||
          r.status === "EXPIRED"
        ) {
          return false
        }
        const dateMs = new Date(r.date).getTime()
        if (Number.isNaN(dateMs) || dateMs < todayKey) return false

        if (kindFilter === "inquiry") return false

        if (statusFilter === "pending") {
          if (r.status !== "PENDING_PAYMENT" && r.status !== "PAYMENT_SUBMITTED") return false
        } else if (statusFilter === "confirmed") {
          if (r.status !== "CONFIRMED") return false
        } else if (statusFilter === "completed") {
          if (r.status !== "COMPLETED") return false
        }

        if (sourceFilter === "admin" && !r.holdByAdmin) return false
        if (sourceFilter === "self" && r.holdByAdmin) return false

        if (q) {
          const inName = (r.user.name || "").toLowerCase().includes(q)
          const inEmail = (r.user.email || "").toLowerCase().includes(q)
          const inPhone = (r.user.phone || "").toLowerCase().includes(q)
          if (!inName && !inEmail && !inPhone) return false
        }
        return true
      })
      .map((r): ListRow => ({ __kind: "reservation", ...r }))

    const inquiryRows: ListRow[] = inquiries
      .filter((i) => {
        if (kindFilter === "reservation") return false
        // Already converted = a reservation already exists, skip to
        // avoid double-display.
        if (i.status === "CONVERTED") return false
        if (!showArchivedInquiries && !ACTIVE_INQUIRY_STATUSES.has(i.status)) return false

        const dateMs = new Date(i.preferredDate).getTime()
        if (Number.isNaN(dateMs) || dateMs < todayKey) return false

        if (q) {
          const inName = (i.user.name || "").toLowerCase().includes(q)
          const inEmail = (i.user.email || "").toLowerCase().includes(q)
          const inPhone = (i.user.phone || "").toLowerCase().includes(q)
          if (!inName && !inEmail && !inPhone) return false
        }
        return true
      })
      .map((i): ListRow => ({ __kind: "inquiry", ...i }))

    return [...reservationRows, ...inquiryRows]
  }, [
    reservations,
    inquiries,
    search,
    statusFilter,
    sourceFilter,
    kindFilter,
    showArchivedInquiries,
    todayKey,
  ])

  // ── Sort ───────────────────────────────────────────────────────
  const sorted = useMemo<ListRow[]>(() => {
    const sign = sortDir === "asc" ? 1 : -1
    const cmp = (a: ListRow, b: ListRow): number => {
      switch (sortKey) {
        case "date":
          return new Date(rowDate(a)).getTime() - new Date(rowDate(b)).getTime()
        case "customerName":
          return getDisplayName(a.user).localeCompare(getDisplayName(b.user))
        case "guestCount":
          return rowGuestCount(a) - rowGuestCount(b)
        case "yurt": {
          const aY = a.__kind === "reservation" ? a.yurt?.name || "" : ""
          const bY = b.__kind === "reservation" ? b.yurt?.name || "" : ""
          return aY.localeCompare(bY)
        }
        case "status":
          return a.status.localeCompare(b.status)
        case "paymentDeadline": {
          const aD =
            a.__kind === "reservation" && a.paymentDeadline
              ? new Date(a.paymentDeadline).getTime()
              : Number.POSITIVE_INFINITY
          const bD =
            b.__kind === "reservation" && b.paymentDeadline
              ? new Date(b.paymentDeadline).getTime()
              : Number.POSITIVE_INFINITY
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
          label={t("kindFilterLabel")}
          options={[
            { value: "all", label: t("kindAll") },
            { value: "reservation", label: t("kindReservation") },
            { value: "inquiry", label: t("kindInquiry") },
          ]}
          value={kindFilter}
          onChange={(v) => setKindFilter(v as KindFilter)}
        />

        {kindFilter !== "inquiry" && (
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
        )}

        {kindFilter !== "inquiry" && (
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
        )}

        {kindFilter !== "reservation" && (
          <label className="flex items-center gap-1.5 text-xs text-[#5A4F3F] cursor-pointer">
            <input
              type="checkbox"
              checked={showArchivedInquiries}
              onChange={(e) => setShowArchivedInquiries(e.target.checked)}
              className="cursor-pointer"
            />
            {t("includeArchivedInquiries")}
          </label>
        )}

        <div className="ml-auto text-xs text-[#8A7E6B] flex items-center gap-1.5">
          <Filter size={12} />
          {t("countSummary", {
            count: sorted.length,
            total: reservations.length + inquiries.length,
          })}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-[#FAFAF7]">
            <tr className="text-left text-[11px] uppercase tracking-wider text-[#8A7E6B]">
              <th className="px-3 py-2.5 font-semibold w-12">{t("col.type")}</th>
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
                <td colSpan={12} className="px-3 py-12 text-center text-sm text-[#8A7E6B]">
                  {t("emptyState")}
                </td>
              </tr>
            ) : (
              sorted.map((row) =>
                row.__kind === "reservation"
                  ? renderReservationRow(row, {
                      t,
                      tCal,
                      isSelected: row.id === selectedReservationId,
                      onClick: () => onSelectReservation(row.id),
                    })
                  : renderInquiryRow(row, {
                      t,
                      tInq,
                      isSelected: row.id === selectedInquiryId,
                      onClick: () => onSelectInquiry?.(row.id),
                    }),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Row renderers ─────────────────────────────────────────────────

interface ReservationRowCtx {
  t: ReturnType<typeof useTranslations>
  tCal: ReturnType<typeof useTranslations>
  isSelected: boolean
  onClick: () => void
}

function renderReservationRow(
  r: { __kind: "reservation" } & ListReservation,
  ctx: ReservationRowCtx,
) {
  const { t, tCal, isSelected, onClick } = ctx
  const badge = RESERVATION_STATUS_BADGE[r.status] || RESERVATION_STATUS_BADGE.PENDING_PAYMENT
  const deadline = formatDeadlineRelative(r.paymentDeadline)
  return (
    <tr
      key={`r-${r.id}`}
      onClick={onClick}
      className={`border-t border-[#F0EDE6] cursor-pointer transition-colors ${
        isSelected ? "bg-[#F5F2ED]" : "hover:bg-[#FAFAF7]"
      }`}
    >
      <td className="px-3 py-2.5">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2980B9]/10 text-[#2980B9]"
          title={t("kindReservation")}
          aria-label={t("kindReservation")}
        >
          <CalendarIcon size={12} />
        </span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[#2C2416]">
        {formatDateISO(r.date)}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-[#2C2416]">{getDisplayName(r.user)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-[#5A4F3F]">{r.user.phone || "—"}</td>
      <td className="px-3 py-2.5 max-w-[220px] truncate text-[#5A4F3F]" title={r.user.email}>
        {r.user.email.endsWith("@placeholder.local") ? (
          <span className="italic text-[#8A7E6B]">{t("placeholderEmail")}</span>
        ) : (
          r.user.email
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-[#2C2416]">{r.guestCount}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-[#2C2416]">
        {r.yurt?.name || <span className="italic text-[#8A7E6B]">{t("yurtPending")}</span>}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.bg} ${badge.text}`}
        >
          {reservationStatusLabel(r.status, tCal)}
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
}

interface InquiryRowCtx {
  t: ReturnType<typeof useTranslations>
  tInq: ReturnType<typeof useTranslations>
  isSelected: boolean
  onClick: () => void
}

function renderInquiryRow(
  i: { __kind: "inquiry" } & ListInquiry,
  ctx: InquiryRowCtx,
) {
  const { t, tInq, isSelected, onClick } = ctx
  const badge = INQUIRY_STATUS_BADGE[i.status] || INQUIRY_STATUS_BADGE.PENDING
  return (
    <tr
      key={`i-${i.id}`}
      onClick={onClick}
      className={`border-t border-[#F0EDE6] cursor-pointer transition-colors ${
        isSelected ? "bg-[#FEFBF4]" : "hover:bg-[#FEFBF4]/40"
      }`}
    >
      <td className="px-3 py-2.5">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#C4A45C]/15 text-[#8B6914]"
          title={t("kindInquiry")}
          aria-label={t("kindInquiry")}
        >
          <ClipboardList size={12} />
        </span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-[#2C2416]">
        {formatDateISO(i.preferredDate)}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-[#2C2416]">{getDisplayName(i.user)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-[#5A4F3F]">{i.user.phone || "—"}</td>
      <td className="px-3 py-2.5 max-w-[220px] truncate text-[#5A4F3F]" title={i.user.email}>
        {i.user.email.endsWith("@placeholder.local") ? (
          <span className="italic text-[#8A7E6B]">{t("placeholderEmail")}</span>
        ) : (
          i.user.email
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-[#2C2416]">
        {i.guestCountMin === i.guestCountMax
          ? i.guestCountMax
          : `${i.guestCountMin}–${i.guestCountMax}`}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-[#8A7E6B] italic">
        {t("yurtNotApplicable")}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.bg} ${badge.text}`}
        >
          {tInq(i.status)}
        </span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8A7E6B]">—</td>
      <td className="px-3 py-2.5 max-w-[260px] truncate text-[#5A4F3F]" title={i.note || ""}>
        {i.note ? (
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} className="text-[#8B6914] shrink-0" />
            <span className="truncate">{i.note}</span>
          </span>
        ) : (
          <span className="text-[#C4C0B6]">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {i.priority !== "NORMAL" ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              i.priority === "URGENT" ? "text-[#C4453A]" : "text-[#8B6914]"
            }`}
          >
            {i.priority}
          </span>
        ) : (
          <span className="text-xs text-[#8A7E6B]">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[#8A7E6B]">
        {formatDateTime(i.createdAt)}
      </td>
    </tr>
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
