import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCron, runCron } from "@/lib/cron-runner";

async function readIntSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  const n = parseFloat(row.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Inquiries sitting in AWAITING_CUSTOMER past `inquiry_auto_expire_days`
 * (default 7) flip to EXPIRED. These are customer-facing inquiries that
 * the admin is waiting on — silence beyond a week means it's stale.
 */
export async function GET(req: NextRequest) {
  const authErr = authorizeCron(req);
  if (authErr) return authErr;

  return runCron("inquiry-auto-expire", async () => {
    const days = await readIntSetting("inquiry_auto_expire_days", 7);
    const cutoff = new Date(Date.now() - days * 24 * 3600_000);

    const stale = await prisma.inquiry.findMany({
      where: { status: "AWAITING_CUSTOMER", updatedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length === 0) {
      return { expired: 0 };
    }

    const ids = stale.map((s) => s.id);
    await prisma.inquiry.updateMany({
      where: { id: { in: ids } },
      data: { status: "EXPIRED", closedAt: new Date() },
    });

    await prisma.$transaction(
      ids.map((id) =>
        prisma.activityLog.create({
          data: {
            userId: null,
            action: "INQUIRY_AUTO_EXPIRED",
            targetType: "Inquiry",
            targetId: id,
            details: { afterDays: days },
          },
        }),
      ),
    );

    return { expired: ids.length };
  });
}
