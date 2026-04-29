#!/usr/bin/env tsx
/**
 * Post-processes Reservation_Clean.csv (and Reservation_Review.csv) after
 * `process-historical-csv.ts` has run.
 *
 *   1. Adds an "Assigned Yurt" column to Clean.csv. For every date,
 *      runs the same deterministic algorithm production uses
 *      (`computeDeterministicAssignment`):
 *        - Single capacity-fit (e.g. 25-30 → only #1 fits) → auto-assign
 *        - Right-size to #3 when ≤16 and #3 is free
 *        - Cascade: once a room is taken, re-check single candidates
 *        - Group determinism: when N pending rows fill exactly N
 *          remaining rooms, assign by size desc → cap desc
 *      Rows that stay ambiguous are left blank for manual handling.
 *
 *   2. Two override lists give the operator escape hatches:
 *        - FORCE_ASSIGN_DATES: when the algorithm leaves rows pending
 *          due to over-capacity, fall back to size-desc assignment to
 *          remaining rooms (拼桌/加位). Will surface as over-allocated.
 *        - MOVE_TO_REVIEW: yank the day's rows out of Clean and append
 *          them to Review.csv with a uniform reason. Re-running is
 *          idempotent — Review rows are matched by (date,name).
 *
 * Run:  npx tsx scripts/mark-yurt-assignments.ts [clean.csv] [review.csv]
 *       (defaults: ~/Downloads/Reservation_{Clean,Review}.csv)
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  computeDeterministicAssignment,
  type DeterministicReservationInput,
  type YurtInput,
} from "../src/lib/yurt-assignment-pure"

const YURTS: YurtInput[] = [
  { id: "room-1", name: "#1", capacity: 30 },
  { id: "room-2", name: "#2", capacity: 24 },
  { id: "room-3", name: "#3", capacity: 16 },
]
const YURTS_BY_CAP_DESC = [...YURTS].sort((a, b) => b.capacity - a.capacity)

/**
 * Dates where the operator has accepted over-capacity seating (拼桌/加位).
 * These bypass the cap check and still get auto-assigned by size desc → #1/#2/#3.
 * The reservation row will be flagged over-allocated in the admin calendar
 * once imported — that's expected.
 */
const FORCE_ASSIGN_DATES = new Set<string>([
  "2026-06-14", // 28/25/14 — middle 25 vs #2(24), accepted
  "2026-07-11", // 30/25/11 — middle 25 vs #2(24), accepted
])

/**
 * Dates whose Clean rows should be yanked out and re-filed under Review,
 * with the given uniform reason applied to every row of that day.
 */
const MOVE_TO_REVIEW: Record<string, string> = {
  "2026-06-27": "三桌 28/25/25 — 第三桌 25 人超 #3 容量 16,需调整人数或拼桌后手工分配",
  "2026-05-17": "5/17 整天待确认:同日有未付定金客户 + 包房指定但无人数客户,建议回访所有客人后统一处理",
  "2026-06-15": "6/15 整天待确认:伍太(24人)未付定金,等定金到位后统一处理当天 3 桌分配",
  "2026-09-12": "9/12 整天待确认:Ben Homrighausen(moved from 9/19)未填人数,需回访补人数后统一处理当天 3 桌分配",
}

/**
 * Hand-pinned yurt assignments. Key: `${ISO date}|${customer name}` (must
 * match Clean.csv exactly). Value: yurt name (#1/#2/#3). These are fed
 * to the algorithm as pre-locked yurtId — the algorithm honors them and
 * cascades the rest of the day around them. Use when the operator has
 * decided who goes where and we want it to survive re-runs.
 */
const MANUAL_ASSIGNMENTS: Record<string, string> = {
  "2026-05-10|Amit Kooner": "#3",   // 客人指定 #3,优先
  "2026-05-10|Dan Goldberg": "#2",  // 让出 #3 给 Amit,9 人放 #2
  "2026-05-16|Aaron Shiu": "#2",    // 让 #1 给 Zanna,Aaron 25 进 #2 (over-cap by 1, accepted)
  "2026-05-16|Zanna Nason": "#1",   // 29 人 + 4 buffer,占 #1
  "2026-07-04|Chiao Yin Hsu": "#2", // 14 人,#3 被 Bing 占,固定到 #2(#1 留给可能的 Yong)
  "2026-07-19|Sophie Phillips": "#1",  // 20 → #1(自然结果,显式锁定)
  "2026-07-19|Daniel Smith": "#2",     // 10 让出 #3 给 Sara,放 #2
  "2026-07-19|Sara Schiavone": "#3",   // 9 人,客人 8-9 范围,放 #3 右适配
  "2026-07-26|Lucy Zhang": "#2",       // 15 人,#3 被 Amanda 占,固定到 #2(#1 留给可能的 Sam)
  "2026-08-02|Stanley Wang": "#2",     // 24 人,#3 被 Rebecca 占,固定到 #2(#1 留给可能的 I Hsing)
  "2026-09-12|Kellie Hart": "#2",      // 16 人放 #2(cap 24),#3 留给 8 人小桌
  "2026-09-12|McKenzie (paid by LAUREN RALEY)": "#3",  // 8 人小桌,右适配 #3(cap 16,8 人留 buffer)
}
const YURT_ID_BY_NAME = new Map(YURTS.map((y) => [y.name, y.id]))

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
      if (c === '"') inQuote = true
      else if (c === ",") {
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

function isoToRawDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${parseInt(m[2], 10)}/${parseInt(m[3], 10)}/${m[1].slice(2)}`
}

function moveDateToReview(
  date: string,
  reason: string,
  cleanRows: string[][],
  cleanIdx: { date: number; guest: number; name: number; email: number; phone1: number; phone2: number; time: number; notes: number },
  reviewPath: string,
): { moved: number; alreadyThere: number; reasonRewritten: number } {
  if (!fs.existsSync(reviewPath)) return { moved: 0, alreadyThere: 0, reasonRewritten: 0 }

  const reviewText = fs.readFileSync(reviewPath, "utf8")
  const reviewRows = parseCsv(reviewText).filter(
    (r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""),
  )
  if (reviewRows.length === 0) return { moved: 0, alreadyThere: 0, reasonRewritten: 0 }
  const reviewHeader = reviewRows[0]
  const reviewData = reviewRows.slice(1)

  const rIdIdx = reviewHeader.indexOf("ID")
  const rReasonIdx = reviewHeader.indexOf("Reason")
  const rDateRawIdx = reviewHeader.indexOf("Date (raw)")
  const rDateParsedIdx = reviewHeader.indexOf("Date (parsed)")
  const rTimeIdx = reviewHeader.indexOf("Time")
  const rGuestsIdx = reviewHeader.indexOf("Guests (raw)")
  const rNameIdx = reviewHeader.indexOf("Customer Name")
  const rEmailIdx = reviewHeader.indexOf("Email")
  const rPhoneIdx = reviewHeader.indexOf("Phone")
  const rNotesIdx = reviewHeader.indexOf("Notes")

  // Determine next REV-NNN id
  let maxId = 0
  for (const r of reviewData) {
    const m = r[rIdIdx]?.match(/^REV-(\d+)$/)
    if (m) maxId = Math.max(maxId, parseInt(m[1], 10))
  }

  // Append the day-level reason to existing Review rows for the same date.
  // We KEEP the original per-row reason (e.g. "waiting for deposit",
  // "non-integer guest count") and add the day-level note after a `|`
  // separator — operator still sees both pieces of context. Idempotent:
  // skips rows that already contain the new reason.
  let reasonRewritten = 0
  for (const r of reviewData) {
    if (r[rDateParsedIdx] !== date) continue
    const existing = r[rReasonIdx] ?? ""
    if (existing.includes(reason)) continue
    r[rReasonIdx] = existing ? `${existing} | ${reason}` : reason
    reasonRewritten++
  }

  // Snapshot the rows we're about to move and remove them from cleanRows.
  const movingRows: string[][] = []
  for (let i = cleanRows.length - 1; i >= 0; i--) {
    if (cleanRows[i][cleanIdx.date]?.trim() === date) {
      movingRows.unshift(cleanRows[i])
      cleanRows.splice(i, 1)
    }
  }

  let moved = 0
  let alreadyThere = 0
  const dateRaw = isoToRawDate(date)
  for (const row of movingRows) {
    const name = row[cleanIdx.name] ?? ""
    const dup = reviewData.some(
      (r) => r[rDateParsedIdx] === date && r[rNameIdx] === name,
    )
    if (dup) {
      alreadyThere++
      continue
    }
    maxId++
    const newRow: string[] = new Array(reviewHeader.length).fill("")
    newRow[rIdIdx] = `REV-${String(maxId).padStart(3, "0")}`
    newRow[rReasonIdx] = reason
    newRow[rDateRawIdx] = dateRaw
    newRow[rDateParsedIdx] = date
    newRow[rTimeIdx] = row[cleanIdx.time] ?? ""
    newRow[rGuestsIdx] = row[cleanIdx.guest] ?? ""
    newRow[rNameIdx] = name
    newRow[rEmailIdx] = row[cleanIdx.email] ?? ""
    const phones = [row[cleanIdx.phone1], row[cleanIdx.phone2]].filter(Boolean).join(" / ")
    newRow[rPhoneIdx] = phones
    newRow[rNotesIdx] = row[cleanIdx.notes] ?? ""
    reviewData.push(newRow)
    moved++
  }

  if (moved > 0 || reasonRewritten > 0) {
    writeCsv(reviewPath, [reviewHeader, ...reviewData])
  }
  return { moved, alreadyThere, reasonRewritten }
}

function main() {
  const inPath = process.argv[2] || path.join(os.homedir(), "Downloads", "Reservation_Clean.csv")
  const reviewPath = process.argv[3] || path.join(os.homedir(), "Downloads", "Reservation_Review.csv")
  if (!fs.existsSync(inPath)) {
    console.error(`Input file not found: ${inPath}`)
    process.exit(1)
  }
  const text = fs.readFileSync(inPath, "utf8")
  const rows = parseCsv(text).filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""))
  if (rows.length === 0) {
    console.error("Empty CSV.")
    process.exit(1)
  }
  const header = rows[0]
  const dataRows = rows.slice(1)

  if (header.indexOf("Date (ISO)") < 0 || header.indexOf("Guest Count") < 0) {
    console.error("Missing required columns: Date (ISO) and Guest Count")
    process.exit(1)
  }

  // Insert "Assigned Yurt" column right after Guest Count if missing.
  // We do this BEFORE caching indexes so all subsequent lookups are correct.
  let assignedIdx = header.indexOf("Assigned Yurt")
  if (assignedIdx < 0) {
    const guestPos = header.indexOf("Guest Count")
    assignedIdx = guestPos + 1
    header.splice(assignedIdx, 0, "Assigned Yurt")
    for (const r of dataRows) {
      while (r.length < header.length - 1) r.push("")
      r.splice(assignedIdx, 0, "")
    }
  } else {
    // Reset prior values so re-runs are deterministic
    for (const r of dataRows) {
      if (assignedIdx < r.length) r[assignedIdx] = ""
    }
  }

  const dateIdx = header.indexOf("Date (ISO)")
  const guestIdx = header.indexOf("Guest Count")
  const nameIdx = header.indexOf("Customer Name")
  const emailIdx = header.indexOf("Email")
  const phone1Idx = header.indexOf("Phone 1")
  const phone2Idx = header.indexOf("Phone 2")
  const timeIdx = header.indexOf("Original Time")
  const notesIdx = header.indexOf("Notes")

  // Group rows by date, preserving original index for stable ordering.
  const byDate = new Map<string, { row: string[]; origIdx: number }[]>()
  dataRows.forEach((r, i) => {
    const d = r[dateIdx]?.trim() || ""
    if (!d) return
    const arr = byDate.get(d) ?? []
    arr.push({ row: r, origIdx: i })
    byDate.set(d, arr)
  })

  const yurtById = new Map(YURTS.map((y) => [y.id, y]))
  const partialDates: { date: string; assigned: number; total: number }[] = []
  const overCap: { date: string; sizes: number[] }[] = []
  let assignedRows = 0
  let fullyAssignedDays = 0

  for (const [date, items] of byDate) {
    if (MOVE_TO_REVIEW[date]) continue // leave alone, will be moved out later

    // Skip if any row already has a manual assignment in the CSV (re-runs).
    // (We reset Assigned Yurt above when the column already existed, so this
    // is just a safety net.)
    const inputs: DeterministicReservationInput[] = items.map((it, i) => {
      const name = it.row[nameIdx] ?? ""
      const manualYurtName = MANUAL_ASSIGNMENTS[`${date}|${name}`]
      const manualYurtId = manualYurtName ? YURT_ID_BY_NAME.get(manualYurtName) ?? null : null
      return {
        id: `${date}#${it.origIdx}`,
        guestCount: parseInt(it.row[guestIdx], 10) || 0,
        yurtId: manualYurtId,
        manuallyAssigned: manualYurtId !== null,
        // Synthetic createdAt preserves CSV order for FIFO tiebreaks.
        createdAt: new Date(2026, 0, 1, 0, 0, 0, i),
      }
    })

    const result = computeDeterministicAssignment(YURTS, inputs)

    // Apply algorithm's assignments back to the CSV rows.
    const assignedIds = new Set<string>()
    for (const a of result.assignments) {
      const target = items.find((it) => `${date}#${it.origIdx}` === a.reservationId)
      const yurt = yurtById.get(a.yurtId)
      if (target && yurt) {
        target.row[assignedIdx] = yurt.name
        assignedIds.add(a.reservationId)
      }
    }

    // FORCE_ASSIGN_DATES escape hatch: fill remaining rooms by size desc
    // for any pending/anomaly rows on accepted-over-cap days.
    const stillUnassigned = items.filter(
      (it) => !assignedIds.has(`${date}#${it.origIdx}`),
    )
    if (stillUnassigned.length > 0 && FORCE_ASSIGN_DATES.has(date)) {
      const usedYurtIds = new Set(result.assignments.map((a) => a.yurtId))
      const freeYurts = YURTS_BY_CAP_DESC.filter((y) => !usedYurtIds.has(y.id))
      const sortedPending = [...stillUnassigned].sort((a, b) => {
        const ga = parseInt(a.row[guestIdx], 10) || 0
        const gb = parseInt(b.row[guestIdx], 10) || 0
        if (gb !== ga) return gb - ga
        return a.origIdx - b.origIdx
      })
      for (let i = 0; i < Math.min(sortedPending.length, freeYurts.length); i++) {
        sortedPending[i].row[assignedIdx] = freeYurts[i].name
        assignedIds.add(`${date}#${sortedPending[i].origIdx}`)
      }
    }

    const assignedCount = assignedIds.size
    assignedRows += assignedCount
    if (assignedCount === items.length) {
      fullyAssignedDays++
    } else if (assignedCount > 0) {
      partialDates.push({ date, assigned: assignedCount, total: items.length })
    }
    if (result.anomalies.length > 0 && !FORCE_ASSIGN_DATES.has(date)) {
      const sizes = items.map((it) => parseInt(it.row[guestIdx], 10) || 0)
      overCap.push({ date, sizes })
    }
  }

  // Yank explicitly-routed dates out of Clean and append to Review.
  const movedReport: { date: string; moved: number; alreadyThere: number; reasonRewritten: number }[] = []
  for (const [date, reason] of Object.entries(MOVE_TO_REVIEW)) {
    const result = moveDateToReview(
      date,
      reason,
      dataRows,
      {
        date: dateIdx,
        guest: guestIdx,
        name: nameIdx,
        email: emailIdx,
        phone1: phone1Idx,
        phone2: phone2Idx,
        time: timeIdx,
        notes: notesIdx,
      },
      reviewPath,
    )
    movedReport.push({ date, ...result })
    // Drop the date from byDate so the report counts post-move.
    byDate.delete(date)
  }

  writeCsv(inPath, [header, ...dataRows])

  // ── Report ───────────────────────────────────────────────────────
  const totalDays = byDate.size
  const counts = { 1: 0, 2: 0, 3: 0, more: 0 }
  for (const items of byDate.values()) {
    if (items.length === 1) counts[1]++
    else if (items.length === 2) counts[2]++
    else if (items.length === 3) counts[3]++
    else counts.more++
  }
  console.log(`Wrote: ${inPath}`)
  console.log(`Total dates: ${totalDays}  (1-row: ${counts[1]}, 2-row: ${counts[2]}, 3-row: ${counts[3]}, >3: ${counts.more})`)
  console.log(`Fully auto-assigned days: ${fullyAssignedDays} / total rows assigned: ${assignedRows}`)
  if (partialDates.length > 0) {
    console.log("\nPartially-assigned days (some rows still pending):")
    for (const p of partialDates) {
      const items = byDate.get(p.date) ?? []
      const detail = items
        .map((it) => `${parseInt(it.row[guestIdx], 10) || 0}→${it.row[assignedIdx] || "?"}`)
        .join(", ")
      console.log(`  ${p.date}  (${p.assigned}/${p.total})  ${detail}`)
    }
  }
  if (movedReport.length > 0) {
    console.log("\nMoved Clean → Review:")
    for (const m of movedReport) {
      console.log(`  ${m.date}: ${m.moved} moved, ${m.alreadyThere} already there, ${m.reasonRewritten} existing rows re-tagged`)
    }
  }
  const movedSet = new Set(movedReport.map((m) => m.date))
  const remainingOverCap = overCap.filter((o) => !movedSet.has(o.date))
  if (remainingOverCap.length > 0) {
    console.log("\nOver-capacity days (some/all rows left blank):")
    for (const o of remainingOverCap) console.log(`  ${o.date}  sizes ${o.sizes.join("/")}`)
  }
  if (counts.more > 0) {
    console.log("\nDays with >3 reservations (manual review):")
    for (const [date, items] of byDate) {
      if (items.length > 3) {
        const sizes = items.map((i) => i.row[guestIdx]).join(", ")
        const names = nameIdx >= 0 ? items.map((i) => i.row[nameIdx]).join(" / ") : ""
        console.log(`  ${date}  (${items.length} rows, sizes ${sizes})  ${names}`)
      }
    }
  }
}

main()
