#!/usr/bin/env tsx
/**
 * One-off cleanup of the historical reservation spreadsheet.
 *
 * Reads the messy source CSV exported from Google Sheets and produces:
 *   - Clean.csv   — rows with unambiguous date + guest count, marked
 *                   $300 paid / CONFIRMED. Ready to import.
 *   - Review.csv  — everything else, with a `reason` column explaining
 *                   why it didn't make the clean cut. User decides what
 *                   to do with each.
 *
 * Run: `tsx scripts/process-historical-csv.ts <input.csv> <out-dir>`
 *
 * Conservative defaults: don't auto-fix year typos, don't guess guest
 * counts from package codes alone. Better to flag for review than to
 * commit wrong data.
 */
import fs from "node:fs"
import path from "node:path"

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

function escapeCsvCell(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function writeCsv(filePath: string, rows: string[][]): void {
  const lines = rows.map((r) => r.map(escapeCsvCell).join(","))
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8")
}

// ── Date parsing ───────────────────────────────────────────────────

function parseDate(raw: string): { iso: string | null; year: number | null; suspectYear: boolean } {
  const s = raw.trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return { iso: null, year: null, suspectYear: false }
  const month = parseInt(m[1], 10)
  const day = parseInt(m[2], 10)
  let year = parseInt(m[3], 10)
  if (year < 100) year = 2000 + year
  if (month < 1 || month > 12 || day < 1 || day > 31) return { iso: null, year: null, suspectYear: false }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  // The dataset spans late 2025 → late 2026. Anything outside that window
  // is suspect (likely typo like "1/24/25" meant "1/24/26").
  const suspectYear = year < 2025 || year > 2027
  return { iso, year, suspectYear }
}

// ── Guest-count parsing ────────────────────────────────────────────

interface GuestParse {
  count: number | null
  reason?: string
  raw: string
  flag?: string // optional note for the clean output (e.g. "range, took max")
}

/**
 * STRICT mode (per user 2026-04-28): only pure-integer guest counts
 * qualify for the clean tab. Anything with ranges, adult/kid splits,
 * package codes, "X up", Chinese qualifiers, or any other annotation
 * goes to review for manual handling.
 */
function parseGuestCount(raw: string): GuestParse {
  const s = raw.trim()
  if (!s) return { count: null, reason: "empty", raw }
  const intMatch = s.match(/^(\d+)$/)
  if (intMatch) return { count: parseInt(intMatch[1], 10), raw }
  return { count: null, reason: `non-integer guest count ("${s}")`, raw }
}

// ── Per-row classifier ─────────────────────────────────────────────

interface SourceRow {
  date: string
  time: string
  guests: string
  name: string
  email: string
  phone: string
  notes: string
}

interface CleanRow {
  iso: string
  guests: number
  guestsRaw: string
  guestsFlag: string
  time: string
  name: string
  email: string
  phone1: string
  phone2: string
  wechatFlag: number
  notes: string
}

/**
 * Treat the email column as "looks like a real email" only when it
 * contains "@". Anything else (e.g. "微信", "Wechat", "Bobo Farm 群",
 * "moved from X") is a note that landed in the wrong column and
 * should move to notes — emails sans @ are not deliverable.
 */
function emailLooksReal(rawEmail: string): boolean {
  return /@/.test(rawEmail)
}

/**
 * Per user 2026-04-28: 店主没有记录微信号的习惯。微信/wechat/群 markers
 * mean "we have a wechat contact path but no ID" — surface as a flag
 * column instead of trying to coerce them into an email/phone field.
 */
function detectWechatFlag(...fields: string[]): number {
  const blob = fields.filter(Boolean).join(" ")
  return /微信|wechat|群/i.test(blob) ? 1 : 0
}

/**
 * Strip trailing Chinese contact-method annotations from a name and
 * return them separately so they can be moved into the notes column.
 *
 * Catches patterns like:
 *   "Jeremy Regan波电话"        -> "Jeremy Regan", "波电话"
 *   "TSophia Li 手机 波"         -> "TSophia Li", "手机 波"
 *   "Holden Grupp(电话；波）"   -> "Holden Grupp", "(电话；波）"
 *   "William H Corman bo 波"    -> "William H Corman", "bo 波"
 *   "Mei Yee Char 微信"         -> "Mei Yee Char", "微信"
 *
 * Does NOT touch honorifics like "徐先生" — those are part of the
 * person's identifier, not a routing annotation.
 */
function extractNameAnnotation(rawName: string): { name: string; annotation: string | null } {
  const s = rawName.trim()
  const re =
    /[\s\u3000]*[(（]?\s*(?:[bB]o[\s\u3000]+)?(?:波|手机|电话|微信)(?:[\s\u3000,，；;]*(?:波|手机|电话|微信))*[\s\u3000]*[)）]?\s*$/
  const m = s.match(re)
  if (!m || m[0].trim() === "") return { name: s, annotation: null }
  const annotation = m[0].trim()
  const cleaned = s.slice(0, s.length - m[0].length).trim()
  // Defensive: don't strip if it would empty the name.
  if (!cleaned) return { name: s, annotation: null }
  return { name: cleaned, annotation }
}

/**
 * Pull all phone-shaped tokens out of a free-text field. Strips trailing
 * junk like "203-247-3880ΩAqawS" -> "203-247-3880" and splits multi-
 * phone fields like "631-525-3773 646-683-6276" -> ["631-...", "646-..."].
 *
 * Looks for 10-digit US-style phones with arbitrary separators. Returns
 * up to two phones (we expose phone1/phone2 columns); extras are
 * appended to a third field that the caller can route into notes.
 */
function extractPhones(rawPhone: string): { phone1: string; phone2: string; extras: string } {
  const s = rawPhone.trim()
  if (!s) return { phone1: "", phone2: "", extras: "" }
  // 10 digits with optional separators (-, space, dot, parens). 7+ digit
  // local numbers fall through this too (matches won't be 10 chars).
  const re = /\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/g
  const matches = (s.match(re) ?? []).map((p) => p.trim())
  const [phone1 = "", phone2 = "", ...rest] = matches
  return { phone1, phone2, extras: rest.join("; ") }
}

interface ReviewRow extends SourceRow {
  id: string
  reason: string
  parsedIso?: string
}

function looksCancelled(row: SourceRow): boolean {
  const blob = [row.name, row.notes].join(" ").toLowerCase()
  return /cancell?ed|cencell?ed|取消/i.test(blob)
}

function looksUnpaid(row: SourceRow): boolean {
  const blob = [row.notes, row.email, row.name].join(" ").toLowerCase()
  return /waiting for deposit|wait.*deposit/i.test(blob)
}

function looksMistake(row: SourceRow): boolean {
  return /mistake/i.test([row.notes, row.name].join(" "))
}

/**
 * A row has at least one usable contact path if it carries an email,
 * a phone, OR any "wechat" / "微信" marker (in any field). The marker
 * may live in the name itself ("Mei Yee Char 微信"), the email column
 * (used as a note for wechat-only contacts), or in the notes column.
 * If none of those exist the admin has no way to reach the customer
 * — push to review.
 */
function hasContact(row: SourceRow): boolean {
  if (row.email.trim() || row.phone.trim()) return true
  const blob = [row.name, row.email, row.phone, row.notes].join(" ")
  // 群 (wechat group) also counts — admin can reach via the group chat.
  return /wechat|微信|群/i.test(blob)
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const inputPath = process.argv[2] ?? "/Users/chengxin/Downloads/test Reservation n Deposit - Reservation.csv"
  const outDir = process.argv[3] ?? "/Users/chengxin/Downloads"

  const text = fs.readFileSync(inputPath, "utf8")
  const allRows = parseCsv(text)

  // Skip the two header rows (Ppl banner + column header)
  const dataRows = allRows.slice(2)

  const clean: CleanRow[] = []
  const review: ReviewRow[] = []
  const reasonCounts: Record<string, number> = {}
  // User instruction 2026-04-28:
  //   - Skip past dates entirely (already-happened, no need to re-import).
  //   - Skip empty rows entirely (placeholder rows in source).
  //   - Anything with special markers goes to review for manual handling.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  let pastDateSkipped = 0
  let emptySkipped = 0
  let reviewIdCounter = 0

  function nextReviewId(): string {
    reviewIdCounter++
    return `REV-${String(reviewIdCounter).padStart(3, "0")}`
  }

  function bumpReason(r: string) {
    reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
  }

  for (const cells of dataRows) {
    // Pad missing columns
    while (cells.length < 7) cells.push("")
    const src: SourceRow = {
      date: cells[0] ?? "",
      time: cells[1] ?? "",
      guests: cells[2] ?? "",
      name: cells[3] ?? "",
      email: cells[4] ?? "",
      phone: cells[5] ?? "",
      notes: cells[6] ?? "",
    }

    // Silently drop rows that look like CSV placeholders (no useful field)
    if (!src.date.trim() && !src.name.trim() && !src.guests.trim()) {
      emptySkipped++
      continue
    }

    const dateP = parseDate(src.date)
    if (!dateP.iso) {
      const reason = "invalid/missing date"
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason })
      continue
    }
    if (dateP.suspectYear) {
      const reason = `suspect year (${dateP.year}); likely typo`
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason, parsedIso: dateP.iso })
      continue
    }

    // Past dates: completely skip (no review entry, no clean entry).
    if (dateP.iso < todayIso) {
      pastDateSkipped++
      continue
    }

    if (looksCancelled(src)) {
      const reason = "marked cancelled"
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason, parsedIso: dateP.iso })
      continue
    }
    if (looksUnpaid(src)) {
      const reason = "waiting for deposit (not paid yet)"
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason, parsedIso: dateP.iso })
      continue
    }
    if (looksMistake(src)) {
      const reason = "marked as mistake"
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason, parsedIso: dateP.iso })
      continue
    }

    const guestP = parseGuestCount(src.guests)
    if (guestP.count == null) {
      // Empty guest count and no useful date row content → silently drop
      // so the review tab isn't drowned in placeholders.
      if (guestP.reason === "empty" && !src.name.trim() && !src.email.trim() && !src.phone.trim()) {
        emptySkipped++
        continue
      }
      const reason = guestP.reason ?? "no guest count"
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason, parsedIso: dateP.iso })
      continue
    }

    // Has a clean integer count but no way to reach the customer →
    // can't safely import (admin couldn't follow up if needed).
    if (!hasContact(src)) {
      const reason = "no contact info (email + phone + wechat all empty)"
      bumpReason(reason)
      review.push({ id: nextReviewId(), ...src, reason, parsedIso: dateP.iso })
      continue
    }

    // Made it through — clean row. Apply per-field hygiene:
    //   - Strip Chinese routing annotations from name (move to notes).
    //   - Split / dejunk phone column into phone1 + phone2.
    //   - Promote non-@ email content into notes (it's never a real email).
    //   - Flag wechat presence so the import script knows to treat the
    //     contact path as wechat-only.
    const { name: cleanedName, annotation } = extractNameAnnotation(src.name)
    const { phone1, phone2, extras: phoneExtras } = extractPhones(src.phone)

    const emailRaw = src.email.trim()
    const realEmail = emailLooksReal(emailRaw) ? emailRaw : ""
    const emailNote = emailLooksReal(emailRaw) ? "" : emailRaw

    const noteParts = [src.notes.trim(), annotation, phoneExtras, emailNote]
      .filter((p) => p && p.length > 0)
    const mergedNotes = noteParts.join("; ")

    const wechatFlag = detectWechatFlag(
      cleanedName,
      realEmail,
      mergedNotes,
      annotation ?? "",
      emailNote,
    )

    clean.push({
      iso: dateP.iso,
      guests: guestP.count,
      guestsRaw: src.guests,
      guestsFlag: guestP.flag ?? "",
      time: src.time,
      name: cleanedName,
      email: realEmail,
      phone1,
      phone2,
      wechatFlag,
      notes: mergedNotes,
    })
  }

  // ── Write outputs ────────────────────────────────────────────────

  const cleanRows: string[][] = [
    [
      "Date (ISO)",
      "Guest Count",
      "Status",
      "Deposit",
      "Customer Name",
      "Email",
      "Phone 1",
      "Phone 2",
      "Wechat Flag",
      "Original Time",
      "Original Guest Count",
      "Guest Parse Note",
      "Notes",
    ],
  ]
  for (const c of clean) {
    cleanRows.push([
      c.iso,
      String(c.guests),
      "CONFIRMED",
      "$300 paid",
      c.name.trim(),
      c.email.trim(),
      c.phone1,
      c.phone2,
      String(c.wechatFlag),
      c.time.trim(),
      c.guestsRaw.trim(),
      c.guestsFlag,
      c.notes,
    ])
  }

  const reviewRows: string[][] = [
    [
      "ID",
      "Reason",
      "Date (raw)",
      "Date (parsed)",
      "Time",
      "Guests (raw)",
      "Customer Name",
      "Email",
      "Phone",
      "Notes",
    ],
  ]
  for (const r of review) {
    reviewRows.push([
      r.id,
      r.reason,
      r.date,
      r.parsedIso ?? "",
      r.time,
      r.guests,
      r.name,
      r.email,
      r.phone,
      r.notes,
    ])
  }

  const cleanPath = path.join(outDir, "Reservation_Clean.csv")
  const reviewPath = path.join(outDir, "Reservation_Review.csv")
  writeCsv(cleanPath, cleanRows)
  writeCsv(reviewPath, reviewRows)

  // ── Summary ──────────────────────────────────────────────────────

  console.log("")
  console.log("📊 Historical reservation cleanup summary")
  console.log("─".repeat(60))
  console.log(`Source rows (excl. headers):       ${dataRows.length}`)
  console.log(`⏭️  Past dates skipped (<${todayIso}):  ${pastDateSkipped}`)
  console.log(`⏭️  Empty rows skipped:             ${emptySkipped}`)
  console.log(`✅ Clean (ready to import):        ${clean.length}`)
  console.log(`⚠️  Review needed (REV-001..):     ${review.length}`)
  console.log("")
  console.log("Review breakdown:")
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])
  for (const [reason, count] of sortedReasons) {
    console.log(`   ${count.toString().padStart(3)}  ${reason}`)
  }
  console.log("")
  console.log(`Clean CSV:  ${cleanPath}`)
  console.log(`Review CSV: ${reviewPath}`)
  console.log("")
  console.log("Sample of CLEAN rows (first 5):")
  for (const c of clean.slice(0, 5)) {
    console.log(
      `   ${c.iso}  ${String(c.guests).padStart(3)}p  ${c.name || "(no name)"}${c.guestsFlag ? `  [${c.guestsFlag}]` : ""}`,
    )
  }
}

main()
