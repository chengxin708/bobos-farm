/**
 * Seed script: parse Excel reservation data and insert into DB.
 * Run: npx tsx scripts/seed-reservations.ts
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

// ─── Excel date serial → JS Date ───────────────────────────────────
function excelDateToJS(serial: number): Date {
  // Excel epoch: Jan 0, 1900 (with the 1900 leap year bug)
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899
  const d = new Date(epoch.getTime() + serial * 86400000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Parse guest count from messy strings ──────────────────────────
function parseGuestCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    // Filter out accidental Excel date serials (> 1000 is clearly wrong)
    if (raw > 1000) return null;
    return Math.round(raw);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // "18大6小" → 18 + 6 = 24
  const bigSmall = s.match(/(\d+)\s*大\s*(\d+)\s*小/);
  if (bigSmall) return parseInt(bigSmall[1]) + parseInt(bigSmall[2]);

  // "24大2小" variant
  const bigSmall2 = s.match(/(\d+)\s*大\s*(\d+)/);
  if (bigSmall2 && s.includes("小"))
    return parseInt(bigSmall2[1]) + parseInt(bigSmall2[2]);

  // "24 2 号包" or "24 2号包" → 24 guests
  const withYurt = s.match(/^(\d+)\s+[#\d号]/);
  if (withYurt) return parseInt(withYurt[1]);

  // "23 #3bao" → 23
  const withBao = s.match(/^(\d+)\s+#?\d/);
  if (withBao) return parseInt(withBao[1]);

  // "3号bao" or "3 号包" → yurt request only, no guest count
  if (/^\d\s*号/.test(s)) return null;

  // "around 20 people" → 20
  const around = s.match(/around\s+(\d+)/i);
  if (around) return parseInt(around[1]);

  // "20 to 30" → 25 (midpoint)
  const range = s.match(/(\d+)\s*(?:to|-)\s*(\d+)/);
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2);

  // "19 up" → 19
  const up = s.match(/^(\d+)\s*up/i);
  if (up) return parseInt(up[1]);

  // Plain number in string
  const plain = s.match(/^(\d+)/);
  if (plain) {
    const n = parseInt(plain[1]);
    if (n > 0 && n <= 50) return n;
  }

  return null;
}

// ─── Parse yurt request from guest count field ─────────────────────
function parseYurtRequest(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();

  // "24 2 号包" → room-2
  const match = s.match(/(\d+)\s*号\s*(?:包|bao)/i);
  if (match) {
    const num = parseInt(match[1]);
    if (num >= 1 && num <= 3) return `room-${num}`;
  }

  // "#3bao" or "3号bao"
  const match2 = s.match(/#(\d)\s*bao/i);
  if (match2) return `room-${match2[1]}`;

  // "3号包"
  const match3 = s.match(/^(\d)\s*号/);
  if (match3) return `room-${match3[1]}`;

  return null;
}

// ─── Parse phone from various formats ──────────────────────────────
function parsePhone(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  // Extract first phone-like pattern
  const m = s.match(/[\d\-\(\)\s]{10,}/);
  return m ? m[0].replace(/\s+/g, "").trim() : "";
}

// ─── Parse contact info ────────────────────────────────────────────
function parseEmail(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (s.includes("@")) return s;
  return "";
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const wb = XLSX.readFile("../test-data/appointment-data.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  // Skip header rows (0 and 1)
  const dataRows = rows.slice(2).filter((r) => r.length > 0 && r[0]);

  // Parse reservations
  interface ParsedRes {
    date: Date;
    guestCount: number;
    name: string;
    email: string;
    phone: string;
    yurtRequest: string | null;
    notes: string;
  }

  const reservations: ParsedRes[] = [];

  for (const row of dataRows) {
    const dateSerial = row[0] as number;
    if (!dateSerial || typeof dateSerial !== "number") continue;

    const name = row[3] as string;
    if (!name || typeof name !== "string" || !name.trim()) continue;

    const date = excelDateToJS(dateSerial);
    let guestCount = parseGuestCount(row[2]);
    const yurtRequest = parseYurtRequest(row[2]);

    // If no guest count, assign a reasonable default based on yurt request
    if (!guestCount) {
      if (yurtRequest === "room-3") guestCount = 12;
      else if (yurtRequest === "room-2") guestCount = 20;
      else if (yurtRequest === "room-1") guestCount = 25;
      else guestCount = 15; // default
    }

    // Cap at 28 (max yurt capacity)
    guestCount = Math.min(guestCount, 28);

    // Parse contact
    const emailCol = row[4] as string | undefined;
    const phoneCol = row[5] as string | number | undefined;
    const email = parseEmail(emailCol);
    const phone = parsePhone(phoneCol) || parsePhone(emailCol);

    // Clean name (remove notes like "微信", "波电话", etc.)
    const cleanName = name
      .replace(/\s*微信\s*/g, "")
      .replace(/\s*Wechat\s*/gi, "")
      .replace(/\s*波电话\s*/g, "")
      .replace(/\s*\(paid by.*\)/gi, "")
      .replace(/\s*\(contact.*\)/gi, "")
      .trim();

    // Collect notes
    const notes: string[] = [];
    if (row[1] && typeof row[1] === "string") notes.push(row[1]);
    if (row[6] && typeof row[6] === "string") notes.push(row[6]);
    if (emailCol === "微信" || emailCol === "Wechat") notes.push("Contact: WeChat");
    if (emailCol === "moved from 5/16/26") notes.push("Moved from 5/16/26");

    reservations.push({
      date,
      guestCount,
      name: cleanName,
      email: email || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@guest.bobos.farm`,
      phone,
      yurtRequest,
      notes: notes.join("; "),
    });
  }

  console.log(`Parsed ${reservations.length} reservations from Excel\n`);

  // Group by date for summary
  const byDate = new Map<string, ParsedRes[]>();
  for (const r of reservations) {
    const key = r.date.toISOString().split("T")[0];
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r);
  }

  console.log("── Date Summary ──");
  for (const [date, recs] of [...byDate.entries()].sort()) {
    const total = recs.reduce((s, r) => s + r.guestCount, 0);
    const names = recs.map((r) => `${r.name}(${r.guestCount})`).join(", ");
    console.log(`${date}: ${recs.length} res, ${total} guests → ${names}`);
  }

  // Insert into DB
  console.log("\n── Inserting into DB ──");

  let inserted = 0;
  for (const r of reservations) {
    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: r.email },
          ...(r.phone ? [{ phone: r.phone }] : []),
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: r.name,
          email: r.email,
          phone: r.phone || null,
          role: "CUSTOMER",
        },
      });
    }

    // Create reservation (CONFIRMED status, deposit paid)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "BF-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

    await prisma.reservation.create({
      data: {
        confirmationCode: code,
        userId: user.id,
        yurtId: r.yurtRequest, // null if no specific request
        date: r.date,
        guestCount: r.guestCount,
        status: "CONFIRMED",
        depositAmount: 300,
        depositStatus: "CONFIRMED",
        depositConfirmedAt: new Date(),
        specialRequests: r.notes || null,
        manuallyAssigned: r.yurtRequest ? true : false,
        yurtAssignedAt: r.yurtRequest ? new Date() : null,
      },
    });

    inserted++;
  }

  console.log(`\nInserted ${inserted} reservations.`);

  // Now run deterministic assignment for each date
  console.log("\n── Running Assignment Algorithm ──");

  const { tryDeterministicAssignment } = await import("../src/lib/yurt-assignment");

  for (const [dateStr] of [...byDate.entries()].sort()) {
    const date = new Date(dateStr + "T00:00:00Z");
    const result = await tryDeterministicAssignment(date);

    const assigned = result.assignments.map(
      (a) => `${a.yurtName}←${a.guestCount}人`
    );
    const pending = result.pending.length;
    const anomalies = result.anomalies.length;

    console.log(
      `${dateStr}: [${assigned.join(", ")}] pending=${pending} anomalies=${anomalies}`
    );
  }

  console.log("\nDone!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
