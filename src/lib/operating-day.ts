import { prisma } from "@/lib/prisma";
import { OperatingDayMode } from "@prisma/client";
import { etDateKey, type OperatingDayMode as PureMode } from "./operating-day-pure";

// Compile-time guard: keep the pure-string union in sync with Prisma's enum.
// If Prisma adds a new variant (e.g. MAINTENANCE) without updating
// operating-day-pure.ts, this assertion will fail tsc.
const _modeParity: PureMode extends OperatingDayMode
  ? OperatingDayMode extends PureMode
    ? true
    : false
  : false = true;
void _modeParity;

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
    map.set(etDateKey(r.date), r.mode as PureMode);
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
