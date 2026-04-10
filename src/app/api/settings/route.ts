import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

// Allowlist of valid setting keys to prevent arbitrary key injection
const ALLOWED_SETTING_KEYS = [
  "deposit_amount",
  "payment_timeout_hours",
  "business_name",
  "business_email",
  "business_phone",
  "business_address",
  "cancellation_policy_days",
  "cancellation_window_days",
  "max_guest_count",
  "booking_advance_days",
  "max_advance_booking_days",
  "min_advance_booking_days",
  "guest_warning_threshold",
  "notification_email",
  "venmo_handle",
  "zelle_email",
  "zelle_recipient",
  "zelle_recipient_name",
] as const;

const settingsUpdateSchema = z.record(
  z.enum(ALLOWED_SETTING_KEYS),
  z.string().max(500)
);

export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed. Only recognized setting keys with string values are allowed.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const operations = Object.entries(parsed.data).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    const results = await prisma.$transaction(operations);

    await prisma.activityLog.create({
      data: {
        userId: session.user?.id,
        action: "SETTINGS_UPDATED",
        targetType: "SystemSetting",
        details: { updatedKeys: Object.keys(parsed.data) },
      },
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
