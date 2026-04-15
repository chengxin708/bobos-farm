import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPreOrderReminder } from "@/lib/email";
import { timingSafeEqual } from "crypto";
import type { Lang } from "@/lib/email-template";

export async function GET(req: NextRequest) {
  // Auth check
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

  try {
    // Read reminder days from settings (default: 8)
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "preorder_reminder_days" },
    });
    const reminderDays = setting?.value ? parseInt(setting.value, 10) : 8;

    // Calculate target date: today + reminderDays
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + reminderDays);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    // Start and end of target date
    const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

    // Find confirmed reservations on that date where order is missing or DRAFT
    const reservations = await prisma.reservation.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        status: "CONFIRMED",
      },
      include: {
        user: { select: { email: true, name: true, preferredLanguage: true } },
        yurt: { select: { name: true } },
        order: {
          include: {
            items: {
              include: {
                menuItem: { select: { nameEn: true, nameZh: true, price: true } },
              },
            },
          },
        },
      },
    });

    // Filter: no order, or order is DRAFT (not yet submitted)
    const needsReminder = reservations.filter(
      (r) => !r.order || r.order.status === "DRAFT"
    );

    let sent = 0;
    for (const r of needsReminder) {
      if (!r.user.email) continue;

      const lang: Lang = r.user.preferredLanguage === "ZH" ? "zh" : "en";
      const orderItems = r.order?.items.map((item) => ({
        name: lang === "zh" && item.menuItem.nameZh ? item.menuItem.nameZh : item.menuItem.nameEn,
        quantity: item.quantity,
        price: item.menuItem.price,
      })) || [];

      await sendPreOrderReminder(r.user.email, {
        date: r.date,
        yurtName: r.yurt?.name || "TBD",
        guestCount: r.guestCount,
        reservationId: r.id,
        orderStatus: !r.order ? "NONE" : "DRAFT",
        orderItems,
        estimatedTotal: r.order?.estimatedTotal || 0,
      });
      sent++;
    }

    return NextResponse.json({
      success: true,
      checked: reservations.length,
      reminded: sent,
      reminderDays,
      targetDate: targetDateStr,
    });
  } catch (error) {
    console.error("Failed to send pre-order reminders:", error);
    return NextResponse.json(
      { error: "Failed to send pre-order reminders" },
      { status: 500 }
    );
  }
}
