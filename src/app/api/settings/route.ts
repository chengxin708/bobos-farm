import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { resetEmailClient } from "@/lib/email";
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
  "preorder_deadline_days",
  "email_from_name",
  "email_booking_confirmation",
  "email_payment_reminder",
  "email_admin_new_booking",
  "resend_api_key",
  // Legacy seed keys (kept for backward compatibility with existing DB rows)
  "max_advance_months",
  "min_advance_days",
  "cancel_refund_days",
  "payment_memo_format",
  "order_deadline_days",
  "paymentMethods",
] as const;

// Accept any string keys, but only process allowed ones
const settingsUpdateSchema = z.record(z.string(), z.string().max(500));

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
        { error: "Invalid request format. Expected key-value pairs with string values.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Filter to only process recognized keys (silently ignore unknown ones)
    const allowedSet = new Set<string>(ALLOWED_SETTING_KEYS);
    const allowedEntries = Object.entries(parsed.data).filter(([key]) => allowedSet.has(key));

    if (allowedEntries.length === 0) {
      return NextResponse.json({ error: "No recognized settings to update" }, { status: 400 });
    }

    const operations = allowedEntries.map(([key, value]) =>
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
        details: { updatedKeys: allowedEntries.map(([k]) => k) },
      },
    });

    // Reset email client cache if email-related settings changed
    const emailKeys = ['resend_api_key', 'email_from_name'];
    if (Object.keys(parsed.data).some(k => emailKeys.includes(k))) {
      resetEmailClient();
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
