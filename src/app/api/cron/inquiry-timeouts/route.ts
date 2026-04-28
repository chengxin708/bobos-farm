import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToAdmins } from "@/lib/push";
import { authorizeCron, runCron } from "@/lib/cron-runner";

async function readIntSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  const n = parseFloat(row.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * PENDING inquiries still untouched after the warn/escalate thresholds
 * get a push nudge to admins. We deduplicate via ActivityLog — once
 * per inquiry per threshold — so repeat cron ticks don't spam.
 */
export async function GET(req: NextRequest) {
  const authErr = authorizeCron(req);
  if (authErr) return authErr;

  return runCron("inquiry-timeouts", async () => {
    const now = new Date();
    const warnHours = await readIntSetting("inquiry_timeout_warn_hours", 24);
    const escalateHours = await readIntSetting("inquiry_timeout_escalate_hours", 48);

    const warnCutoff = new Date(now.getTime() - warnHours * 3600_000);
    const escalateCutoff = new Date(now.getTime() - escalateHours * 3600_000);

    const stalePending = await prisma.inquiry.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: warnCutoff },
      },
      select: { id: true, createdAt: true, user: { select: { email: true, name: true } } },
    });

    let warnsSent = 0;
    let escalationsSent = 0;

    for (const inq of stalePending) {
      const isEscalation = inq.createdAt < escalateCutoff;
      const action = isEscalation ? "INQUIRY_UNCLAIMED_48H" : "INQUIRY_UNCLAIMED_24H";
      const already = await prisma.activityLog.findFirst({
        where: { targetType: "Inquiry", targetId: inq.id, action },
        select: { id: true },
      });
      if (already) continue;

      await prisma.activityLog.create({
        data: {
          userId: null,
          action,
          targetType: "Inquiry",
          targetId: inq.id,
          details: {
            hoursSinceCreation: Math.floor((now.getTime() - inq.createdAt.getTime()) / 3600_000),
          },
        },
      });
      if (isEscalation) escalationsSent++;
      else warnsSent++;
    }

    if (warnsSent + escalationsSent > 0) {
      await sendPushToAdmins({
        title: "Inquiries need attention",
        body: `${warnsSent + escalationsSent} pending inquiry${warnsSent + escalationsSent === 1 ? "" : "s"} past deadline`,
        url: "/admin/inquiries?status=PENDING",
        tag: "inquiry-timeout",
      }).catch(() => {});
    }

    return { warnsSent, escalationsSent, scanned: stalePending.length };
  });
}
