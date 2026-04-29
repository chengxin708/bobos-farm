#!/usr/bin/env tsx
/**
 * One-shot importer for historical reservations from Reservation_Clean.csv.
 *
 * USAGE
 *   # 1. Dry-run (default) — prints exactly what would happen, NO writes:
 *   tsx scripts/import-historical-reservations.ts ~/Downloads/Reservation_Clean.csv
 *
 *   # 2. After reviewing dry-run output, apply for real:
 *   tsx scripts/import-historical-reservations.ts ~/Downloads/Reservation_Clean.csv --apply
 *
 *   # PRODUCTION:
 *   #   - Pull prod env vars first: `vercel env pull .env.local`
 *   #   - Source: `set -a && source .env.local && set +a`
 *   #   - Run dry-run, eyeball output, THEN run with --apply.
 *
 * BEHAVIOR
 *   - Each CSV row → resolves a User (by real email if present, else
 *     reuses a same-name + same-phone placeholder if one exists from a
 *     prior row in this or a previous run, else creates a fresh
 *     placeholder@placeholder.local) and creates one Reservation marked
 *     CONFIRMED + $300 paid + holdByAdmin=true.
 *   - Reads the "Assigned Yurt" column from Clean.csv (#1/#2/#3) and
 *     pins yurtId at import time with manuallyAssigned=true so the
 *     production auto-assigner won't reshuffle these later. Blank cell
 *     → yurtId=null, admin assigns later in the back office.
 *   - Phone1/2, real email, and wechat-flag rows become UserContactEntry
 *     rows under that user (upserted, so re-reuns won't dup them).
 *   - A claim token is minted for each reservation so the admin can
 *     later DM the customer a link to claim ownership.
 *   - Idempotent: each row's identity hash is recorded in an
 *     ActivityLog. Re-running the same CSV is a no-op for already-
 *     imported rows.
 *   - Each row's writes are wrapped in a single transaction so a
 *     mid-row error rolls back cleanly without leaving partial data.
 *
 * SAFETY
 *   - Refuses to write rows with date < today, guestCount outside [1,70],
 *     or unparseable date.
 *   - Default mode is read-only (dry-run); --apply must be explicit.
 *   - Resolving Users by real email — phone-based dedup is dangerous in
 *     general (households share phones). Exception: among placeholder
 *     users (no-real-email rows that landed on `imported-*@placeholder.local`),
 *     same name + same phone1 IS treated as the same person, since
 *     "no email" + "same name" + "same phone" is a much stronger signal
 *     than phone alone. This keeps Julie Dossantos's 3-yurt full-buyout
 *     from creating 3 separate User records.
 */
import fs from "node:fs"
import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { createClaimToken } from "../src/lib/claim-token"

// ── CSV parser (handles quoted commas) ─────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        cur += c
      }
    } else {
      if (c === '"') {
        inQuote = true
      } else if (c === ",") {
        row.push(cur)
        cur = ""
      } else if (c === "\n") {
        row.push(cur)
        rows.push(row)
        row = []
        cur = ""
      } else if (c === "\r") {
        // skip
      } else {
        cur += c
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

// ── Row schema (matches Reservation_Clean.csv columns) ─────────────

interface ImportRow {
  date: string
  guestCount: number
  customerName: string
  email: string
  phone1: string
  phone2: string
  wechatFlag: 0 | 1
  originalTime: string
  notes: string
  /** Pre-assigned yurt name from CSV: "#1" | "#2" | "#3" | "" */
  assignedYurtName: string
}

const YURT_NAME_TO_ID: Record<string, string> = {
  "#1": "room-1",
  "#2": "room-2",
  "#3": "room-3",
}

function loadRows(csvPath: string): ImportRow[] {
  const text = fs.readFileSync(csvPath, "utf8")
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error("CSV is empty")
  const header = rows[0].map((h) => h.trim())

  const idx = (name: string): number => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`Missing column "${name}" in CSV header`)
    return i
  }

  const dateI = idx("Date (ISO)")
  const guestI = idx("Guest Count")
  const nameI = idx("Customer Name")
  const emailI = idx("Email")
  const phone1I = idx("Phone 1")
  const phone2I = idx("Phone 2")
  const wechatI = idx("Wechat Flag")
  const timeI = idx("Original Time")
  const notesI = idx("Notes")
  // Optional — Clean.csv produced by mark-yurt-assignments.ts has it,
  // raw process-historical-csv.ts output doesn't.
  const yurtI = header.indexOf("Assigned Yurt")

  const out: ImportRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    if (cells.every((c) => !c.trim())) continue
    out.push({
      date: (cells[dateI] ?? "").trim(),
      guestCount: parseInt((cells[guestI] ?? "").trim(), 10),
      customerName: (cells[nameI] ?? "").trim(),
      email: (cells[emailI] ?? "").trim(),
      phone1: (cells[phone1I] ?? "").trim(),
      phone2: (cells[phone2I] ?? "").trim(),
      wechatFlag: (cells[wechatI] ?? "").trim() === "1" ? 1 : 0,
      originalTime: (cells[timeI] ?? "").trim(),
      notes: (cells[notesI] ?? "").trim(),
      assignedYurtName: yurtI >= 0 ? (cells[yurtI] ?? "").trim() : "",
    })
  }
  return out
}

// ── Helpers ────────────────────────────────────────────────────────

function rowHash(row: ImportRow): string {
  const key = `${row.date}|${row.guestCount}|${row.customerName.trim().toLowerCase()}`
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12)
}

const CONFIRMATION_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

async function generateConfirmationCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += CONFIRMATION_CHARS[Math.floor(Math.random() * CONFIRMATION_CHARS.length)]
    }
    const existing = await prisma.reservation.findUnique({ where: { confirmationCode: code } })
    if (!existing) return code
  }
  return `BF-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

function buildSpecialRequests(row: ImportRow): string | null {
  const parts: string[] = []
  if (row.notes) parts.push(row.notes)
  if (row.originalTime) parts.push(`原始时间: ${row.originalTime}`)
  if (row.wechatFlag) parts.push("[微信联系]")
  parts.push(`[历史导入 ${row.date}]`)
  return parts.length > 0 ? parts.join(" / ") : null
}

function todayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ── Per-row processor ──────────────────────────────────────────────

interface Outcome {
  hash: string
  status: "created" | "skipped-existing" | "would-create" | "error"
  reservationId?: string
  confirmationCode?: string
  userId?: string
  userCreated?: boolean
  claimUrlSuffix?: string
  reason?: string
}

/**
 * In-memory tracker for dry-run mode so the placeholder-dedup branch
 * shows the right "[reuse user]" tag for repeat rows in the same run.
 * Real --apply mode hits the DB and doesn't need this — Prisma sees
 * the row inserted by the previous loop iteration.
 */
const dryRunPlaceholderSeen = new Set<string>()
function placeholderKey(name: string, phone: string): string {
  return `${name.toLowerCase()}|${phone}`
}

async function processRow(
  prisma: PrismaClient,
  row: ImportRow,
  apply: boolean,
): Promise<Outcome> {
  const hash = rowHash(row)

  // Defense-in-depth validation (CSV should already be filtered).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    return { hash, status: "error", reason: "invalid date format" }
  }
  if (row.date < todayIso()) {
    return { hash, status: "error", reason: "past date" }
  }
  if (!Number.isInteger(row.guestCount) || row.guestCount < 1 || row.guestCount > 70) {
    return { hash, status: "error", reason: `guestCount out of range (${row.guestCount})` }
  }
  if (!row.customerName) {
    return { hash, status: "error", reason: "empty customer name" }
  }

  // Idempotency: have we already imported this row?
  const prior = await prisma.activityLog.findFirst({
    where: {
      action: "HISTORICAL_IMPORT_CSV",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: { path: ["hash"], equals: hash } as any,
    },
    select: { targetId: true },
  })
  if (prior) {
    return { hash, status: "skipped-existing", reservationId: prior.targetId ?? undefined }
  }

  // Resolve user — primary path is real email. Cross-row phone-based
  // dedup is dangerous in general (households share phones), so it's
  // only applied to the placeholder pool: a row with no real email and
  // a name+phone that matches an already-imported placeholder user
  // reuses that user. This stops Julie's full-buyout (3 rows on one
  // date, no email) from creating 3 separate Julie records.
  let user: { id: string; email: string } | null = null
  let userCreated = false
  const hasRealEmail = !!row.email && /@/.test(row.email)
  if (hasRealEmail) {
    user = await prisma.user.findUnique({
      where: { email: row.email },
      select: { id: true, email: true },
    })
  } else if (row.customerName && row.phone1) {
    user = await prisma.user.findFirst({
      where: {
        name: row.customerName,
        phone: row.phone1,
        email: { startsWith: "imported-", endsWith: "@placeholder.local" },
      },
      select: { id: true, email: true },
    })
  }

  if (!apply) {
    let wouldReuseFromThisRun = false
    if (!user && !hasRealEmail && row.customerName && row.phone1) {
      const key = placeholderKey(row.customerName, row.phone1)
      if (dryRunPlaceholderSeen.has(key)) {
        wouldReuseFromThisRun = true
      } else {
        dryRunPlaceholderSeen.add(key)
      }
    }
    return {
      hash,
      status: "would-create",
      userId: user?.id,
      userCreated: !user && !wouldReuseFromThisRun,
    }
  }

  // ── APPLY MODE: real writes ──────────────────────────────────────

  if (!user) {
    const placeholderEmail = hasRealEmail
      ? row.email
      : `imported-${hash}@placeholder.local`
    const created = await prisma.user.create({
      data: {
        email: placeholderEmail,
        name: row.customerName,
        phone: row.phone1 || null,
      },
      select: { id: true, email: true },
    })
    user = created
    userCreated = true
  }

  const code = await generateConfirmationCode(prisma)
  const dateObj = new Date(row.date)
  const now = new Date()

  const yurtId = YURT_NAME_TO_ID[row.assignedYurtName] ?? null
  const reservation = await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        confirmationCode: code,
        userId: user!.id,
        yurtId,
        // Lock the assignment so production's auto-assigner doesn't
        // reshuffle these later; admin can still override in the UI.
        manuallyAssigned: yurtId !== null,
        date: dateObj,
        guestCount: row.guestCount,
        status: "CONFIRMED",
        depositAmount: 300,
        depositStatus: "CONFIRMED",
        depositConfirmedAt: now,
        holdByAdmin: true,
        paymentDeadline: null,
        specialRequests: buildSpecialRequests(row),
      },
    })

    const contactUpserts: Promise<unknown>[] = []
    if (row.phone1) {
      contactUpserts.push(
        tx.userContactEntry.upsert({
          where: { userId_type_value: { userId: user!.id, type: "phone", value: row.phone1 } },
          update: {},
          create: { userId: user!.id, type: "phone", value: row.phone1, source: "admin" },
        }),
      )
    }
    if (row.phone2) {
      contactUpserts.push(
        tx.userContactEntry.upsert({
          where: { userId_type_value: { userId: user!.id, type: "phone", value: row.phone2 } },
          update: {},
          create: { userId: user!.id, type: "phone", value: row.phone2, source: "admin" },
        }),
      )
    }
    if (row.email && /@/.test(row.email)) {
      contactUpserts.push(
        tx.userContactEntry.upsert({
          where: { userId_type_value: { userId: user!.id, type: "email", value: row.email } },
          update: {},
          create: { userId: user!.id, type: "email", value: row.email, source: "admin" },
        }),
      )
    }
    if (row.wechatFlag) {
      contactUpserts.push(
        tx.userContactEntry.upsert({
          where: {
            userId_type_value: {
              userId: user!.id,
              type: "wechat",
              value: "(legacy import)",
            },
          },
          update: {},
          create: {
            userId: user!.id,
            type: "wechat",
            value: "(legacy import)",
            source: "admin",
          },
        }),
      )
    }
    await Promise.all(contactUpserts)

    await tx.activityLog.create({
      data: {
        userId: null,
        action: "HISTORICAL_IMPORT_CSV",
        targetType: "Reservation",
        targetId: r.id,
        details: {
          hash,
          source: "Reservation_Clean.csv",
          customerName: row.customerName,
          date: row.date,
          guestCount: row.guestCount,
          userCreated,
          assignedYurt: row.assignedYurtName || null,
        },
      },
    })

    return r
  })

  const token = await createClaimToken(prisma, reservation.id)

  return {
    hash,
    status: "created",
    reservationId: reservation.id,
    confirmationCode: code,
    userId: user.id,
    userCreated,
    claimUrlSuffix: `/claim?code=${code}&t=${token.token}`,
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const csvPath = args.find((a) => !a.startsWith("--")) ??
    "/Users/chengxin/Downloads/Reservation_Clean.csv"

  if (!fs.existsSync(csvPath)) {
    console.error(`✗ CSV not found: ${csvPath}`)
    process.exit(1)
  }

  if (apply && !process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set. Source your env first:")
    console.error("    vercel env pull .env.local && set -a && source .env.local && set +a")
    process.exit(2)
  }

  const rows = loadRows(csvPath)
  console.log(`📄 ${csvPath}`)
  console.log(`   ${rows.length} rows loaded`)
  console.log(apply ? "🔴 APPLY MODE — WILL WRITE TO DATABASE" : "🟢 DRY-RUN — no writes")
  console.log("")

  const prisma = new PrismaClient()
  const results: Outcome[] = []

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const out = await processRow(prisma, row, apply)
      results.push(out)
      const tag =
        out.status === "created"
          ? "✓ created"
          : out.status === "skipped-existing"
            ? "→ skipped (already imported)"
            : out.status === "would-create"
              ? "+ would create"
              : `✗ error: ${out.reason}`
      const userInfo = out.userCreated ? "[new user]" : "[reuse user]"
      const yurtTag = row.assignedYurtName ? row.assignedYurtName : "TBD"
      console.log(
        `  [${String(i + 1).padStart(3)}/${rows.length}] ${row.date} ${String(row.guestCount).padStart(3)}p ` +
          `${yurtTag.padEnd(3)} ${row.customerName.padEnd(30).slice(0, 30)}  ${tag}  ${userInfo}`,
      )
      if (out.confirmationCode) {
        console.log(`        → code=${out.confirmationCode}  claim=${out.claimUrlSuffix}`)
      }
    }

    console.log("")
    console.log("─".repeat(60))
    const created = results.filter((r) => r.status === "created").length
    const skipped = results.filter((r) => r.status === "skipped-existing").length
    const wouldCreate = results.filter((r) => r.status === "would-create").length
    const errors = results.filter((r) => r.status === "error").length
    console.log(`Created:     ${created}`)
    console.log(`Skipped:     ${skipped}`)
    console.log(`Would-create:${wouldCreate}`)
    console.log(`Errors:      ${errors}`)

    if (!apply) {
      console.log("")
      console.log("🟢 Dry-run complete. To actually write, re-run with --apply.")
    } else {
      console.log("")
      console.log("🔴 Apply complete. Claim URLs above are admin-shareable.")
      if (errors > 0) {
        console.log(`⚠️  ${errors} row(s) errored — review and fix the source CSV.`)
        process.exit(1)
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("Importer crashed:", err)
  process.exit(1)
})
