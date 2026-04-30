import { prisma } from "@/lib/prisma";
import { OperatingDayMode } from "@prisma/client";
import { type OperatingDayMode as PureMode } from "./operating-day-pure";

// Compile-time guard: keep the pure-string union in sync with Prisma's enum.
// If Prisma adds a new variant (e.g. MAINTENANCE) without updating
// operating-day-pure.ts, this assertion will fail tsc.
const _modeParity: PureMode extends OperatingDayMode
  ? OperatingDayMode extends PureMode
    ? true
    : false
  : false = true;
void _modeParity;

/**
 * Derive a "YYYY-MM-DD" key from a Prisma `@db.Date` value.
 *
 * `OperatingDay.date` is `@db.Date`; Prisma materializes it as a JS Date at
 * midnight UTC for the stored calendar date (e.g. row `2026-05-04` →
 * `2026-05-04T00:00:00Z`). We must read the UTC parts directly here — using
 * `etDateKey` would format that instant in America/New_York, which lands at
 * 8pm the *previous* day during EDT and produces a key off by one. The pure
 * `etDateKey` helper is still correct for its other use case (formatting an
 * arbitrary UTC instant in ET to derive the lookup key from a noon-UTC probe
 * date), so we don't touch it — the bug is specifically here, in the
 * `@db.Date` readback path.
 */
function dbDateToCalendarKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadOperatingDayMap(
  startDate: Date,
  endDate: Date,
): Promise<Map<string, PureMode>> {
  const rows = await prisma.operatingDay.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { date: true, mode: true },
  });
  const map = new Map<string, PureMode>();
  for (const r of rows) {
    map.set(dbDateToCalendarKey(r.date), r.mode as PureMode);
  }
  return map;
}

export async function upsertOperatingDay(input: {
  date: Date;
  mode: OperatingDayMode;
  note?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  await prisma.operatingDay.upsert({
    where: { date: input.date },
    create: {
      date: input.date,
      mode: input.mode,
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
    },
    update: {
      mode: input.mode,
      note: input.note ?? undefined,
    },
  });
}
