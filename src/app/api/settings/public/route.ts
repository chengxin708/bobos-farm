import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Keys safe to expose to unauthenticated/customer users
const PUBLIC_SETTING_KEYS = [
  "deposit_amount",
  "payment_timeout_hours",
  "max_advance_booking_days",
  "min_advance_booking_days",
  "guest_warning_threshold",
  "zelle_recipient",
  "zelle_recipient_name",
  "preorder_deadline_days",
  "cancellation_window_days",
  "business_name",
  "business_phone",
  "business_email",
  "business_address",
  // Master switch for "online booking under development" mode
  "booking_maintenance",
];

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });

    // Return as a key-value map for easy consumption
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return NextResponse.json(map);
  } catch (error) {
    console.error("Failed to fetch public settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
