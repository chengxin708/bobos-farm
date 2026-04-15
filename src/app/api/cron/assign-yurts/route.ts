import { NextRequest, NextResponse } from "next/server";
import { assignYurtsForDate } from "@/lib/yurt-assignment";
import { timingSafeEqual } from "crypto";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Target date = today + 7 days in America/New_York timezone (T-7 fallback)
  const etDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const etToday = new Date(etDateStr + "T00:00:00Z");
  const targetDate = new Date(etToday);
  targetDate.setUTCDate(targetDate.getUTCDate() + 7);

  const plan = await assignYurtsForDate(targetDate);

  return NextResponse.json({
    date: targetDate.toISOString().split("T")[0],
    assigned: plan.assignments.length,
    anomalies: plan.anomalies.length,
  });
}
