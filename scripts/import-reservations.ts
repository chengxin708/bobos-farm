/**
 * Import staged reservations from test-data/reservations-import-ready.json into the DB.
 *
 * Behavior per record:
 *   - Find or create User by email (real email or temp-{cuid}@placeholder.local)
 *   - Update name/phone if newly provided and User had them blank (no overwrites)
 *   - Create Reservation: status=CONFIRMED, deposit=$300 confirmed, no yurt assigned
 *   - Create one pinned ReservationNote (authored by chengxin708) with the staged note text
 *   - Record contact-history entries (source='admin', recordedBy=chengxin708)
 *   - Log ActivityLog: RESERVATION_CREATED with source='excel-import-2026-04-16'
 *   - DO NOT send emails / push / notifications
 *
 * Pre-flight: aborts unless reservation count is zero, OR --force passed.
 * Idempotency: if a reservation with the same date + name + import marker already exists, skip.
 *
 * Run:
 *   npx tsx scripts/import-reservations.ts --dry-run    # preview
 *   npx tsx scripts/import-reservations.ts              # commit
 */
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../src/lib/prisma";
import { recordContactsFromUser } from "../src/lib/contact-history";

const SOURCE_TAG = "excel-import-2026-04-16";
const ADMIN_EMAIL = "chengxin708@gmail.com";
const JSON_PATH = path.resolve(__dirname, "../../test-data/reservations-import-ready.json");

interface StagedRecord {
  rowIndex: number;
  flag: "green" | "yellow";
  date: string;
  user: { name: string; email: string; phone: string };
  reservation: { guestCount: number; depositAmount: number };
  note: string;
}

interface StagedFile {
  generatedAt: string;
  records: StagedRecord[];
}

async function generateConfirmationCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const existing = await prisma.reservation.findUnique({ where: { confirmationCode: code } });
    if (!existing) return code;
  }
  return `BF-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const force = args.has("--force");

  console.log(`── Import ${dryRun ? "(DRY RUN)" : ""} ──`);

  // Load staging
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Staging file not found: ${JSON_PATH}`);
    console.error(`Run: npx tsx scripts/parse-and-stage-reservations.ts first`);
    process.exit(1);
  }
  const staged = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as StagedFile;
  console.log(`Loaded ${staged.records.length} records from staging (generated ${staged.generatedAt})`);

  // Pre-flight: confirm DB state
  const existingResCount = await prisma.reservation.count();
  if (existingResCount > 0 && !force && !dryRun) {
    console.error(`Aborting: ${existingResCount} reservation(s) already exist in DB.`);
    console.error(`Use --force to import anyway (idempotency relies on import marker in ActivityLog).`);
    process.exit(1);
  }

  // Resolve admin user (recordedBy)
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  if (!admin) {
    console.error(`Admin user ${ADMIN_EMAIL} not found.`);
    process.exit(1);
  }
  const adminId = admin.id;
  console.log(`Recording as admin: ${ADMIN_EMAIL} (${adminId})`);
  if (dryRun) console.log("DRY RUN — no DB writes will be performed.\n");

  // Counters
  let created = 0;
  let skipped = 0;
  let userReused = 0;
  let userCreated = 0;
  const failures: { row: number; reason: string }[] = [];

  for (const r of staged.records) {
    const date = new Date(`${r.date}T00:00:00.000Z`);

    // Idempotency: skip if same row already imported
    const existingMarker = await prisma.activityLog.findFirst({
      where: {
        action: "RESERVATION_CREATED",
        targetType: "Reservation",
        details: { path: ["source"], equals: SOURCE_TAG },
        AND: { details: { path: ["rowIndex"], equals: r.rowIndex } },
      },
      select: { targetId: true },
    });
    if (existingMarker) {
      skipped++;
      continue;
    }

    if (dryRun) {
      const existingUser = await prisma.user.findUnique({ where: { email: r.user.email.toLowerCase() } });
      if (existingUser) userReused++; else userCreated++;
      created++;
      continue;
    }

    try {
      // Step 1: find or create User
      const emailLower = r.user.email.toLowerCase();
      let customer = await prisma.user.findUnique({ where: { email: emailLower } });
      if (!customer) {
        customer = await prisma.user.create({
          data: {
            email: emailLower,
            name: r.user.name,
            phone: r.user.phone || null,
            role: "CUSTOMER",
          },
        });
        userCreated++;
      } else {
        // Backfill name/phone only if blank — don't overwrite existing real-account data
        const updates: { name?: string; phone?: string } = {};
        if (!customer.name && r.user.name) updates.name = r.user.name;
        if (!customer.phone && r.user.phone) updates.phone = r.user.phone;
        if (Object.keys(updates).length > 0) {
          customer = await prisma.user.update({ where: { id: customer.id }, data: updates });
        }
        userReused++;
      }

      // Step 2: contact history (source='admin', recordedBy=chengxin708)
      await recordContactsFromUser(prisma, customer, "admin", adminId);

      // Step 3: create Reservation
      const code = await generateConfirmationCode();
      const reservation = await prisma.reservation.create({
        data: {
          confirmationCode: code,
          userId: customer.id,
          yurtId: null,
          date,
          guestCount: r.reservation.guestCount,
          status: "CONFIRMED",
          depositAmount: r.reservation.depositAmount,
          depositStatus: "CONFIRMED",
          depositConfirmedAt: new Date(),
          holdByAdmin: false,
          manuallyAssigned: false,
          // No specialRequests — note captures all context.
          // No paymentDeadline — fully paid.
        },
      });

      // Step 4: pinned note authored by admin
      await prisma.reservationNote.create({
        data: {
          reservationId: reservation.id,
          userId: adminId,
          content: r.note,
          pinned: true,
        },
      });

      // Step 5: ActivityLog with import marker
      await prisma.activityLog.create({
        data: {
          userId: adminId,
          action: "RESERVATION_CREATED",
          targetType: "Reservation",
          targetId: reservation.id,
          details: {
            source: SOURCE_TAG,
            rowIndex: r.rowIndex,
            flag: r.flag,
            date: r.date,
            guestCount: r.reservation.guestCount,
          },
        },
      });

      created++;
      if (created % 25 === 0) console.log(`  ... ${created} created`);
    } catch (err) {
      failures.push({
        row: r.rowIndex,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("");
  console.log("─── Summary ───");
  console.log(`Created:       ${created}`);
  console.log(`Skipped (already imported): ${skipped}`);
  console.log(`Users reused:  ${userReused}`);
  console.log(`Users created: ${userCreated}`);
  console.log(`Failures:      ${failures.length}`);
  if (failures.length > 0) {
    console.log("\nFailure details:");
    failures.forEach((f) => console.log(`  Row ${f.row}: ${f.reason}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
