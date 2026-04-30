#!/usr/bin/env tsx
/**
 * One-shot: backfill OperatingDay rows for existing weekday reservations.
 *
 * For every active (non-cancelled, non-expired) Reservation whose date is
 * a Mon-Fri and has no OperatingDay row yet, insert
 * `OperatingDay { date, mode: PRIVATE_EVENT, note: 'backfill: weekday with
 * existing reservation' }`. Idempotent via `createMany({ skipDuplicates: true })`
 * + the @unique date index.
 *
 * Usage:
 *   vercel env pull --environment=production .env.local
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/backfill-operating-days.ts
 *   # add --apply to actually write
 */
import "dotenv/config";
import { PrismaClient, OperatingDayMode } from "@prisma/client";

const WEEKDAY_DOWS = new Set([1, 2, 3, 4, 5]); // Mon-Fri

// Reservation.date and OperatingDay.date are Postgres `date` columns
// (Prisma `@db.Date`). Prisma materializes those as a JS Date pinned to
// midnight UTC — the calendar date is preserved in the UTC components,
// not in the local/ET clock. Formatting with timeZone: 'America/New_York'
// would shift midnight UTC to 8pm ET the previous day, turning every
// Mon-Fri reservation into Sun-Thu and silently dropping it from the
// weekday set. So compute DOW with timeZone: 'UTC'.
function etDayOfWeek(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  });
  const wk = fmt.format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wk] ?? -1;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
      },
      select: { date: true },
    });

    const weekdayDates = new Set<string>();
    for (const r of reservations) {
      if (WEEKDAY_DOWS.has(etDayOfWeek(r.date))) {
        weekdayDates.add(r.date.toISOString().slice(0, 10));
      }
    }

    if (weekdayDates.size === 0) {
      console.log("No weekday reservations found. Nothing to backfill.");
      return;
    }

    if (!apply) {
      // Dry-run path: query existing rows so we can show an accurate diff.
      const existing = await prisma.operatingDay.findMany({
        where: { date: { in: [...weekdayDates].map((d) => new Date(`${d}T00:00:00Z`)) } },
        select: { date: true },
      });
      const existingSet = new Set(existing.map((r) => r.date.toISOString().slice(0, 10)));
      const toInsert = [...weekdayDates].filter((d) => !existingSet.has(d));

      console.log(`Weekday reservation dates: ${weekdayDates.size}`);
      console.log(`Already have OperatingDay row: ${existingSet.size}`);
      console.log(`Will insert: ${toInsert.length}`);
      for (const d of toInsert) console.log(`  ${d}`);
      console.log("\nDry-run. Re-run with --apply to write.");
      return;
    }

    // Apply path: let createMany + skipDuplicates handle idempotency atomically
    // (OperatingDay.date has a @unique index). One round-trip, race-safe.
    const result = await prisma.operatingDay.createMany({
      data: [...weekdayDates].map((d) => ({
        date: new Date(`${d}T00:00:00Z`),
        mode: OperatingDayMode.PRIVATE_EVENT,
        note: "backfill: weekday with existing reservation",
      })),
      skipDuplicates: true,
    });
    console.log(`Weekday reservation dates: ${weekdayDates.size}`);
    console.log(`Inserted ${result.count} OperatingDay rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
