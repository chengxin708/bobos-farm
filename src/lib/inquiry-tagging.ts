import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export type InquiryTag = "big_order" | "full_booking" | "urgent" | "vip";

export interface InquiryTagInput {
  userId: string;
  userCreatedAt: Date;
  guestCountMax: number;
  preferredDate: Date;
}

export interface InquiryTagResult {
  tags: InquiryTag[];
  priority: "NORMAL" | "HIGH" | "URGENT";
}

/**
 * Compute the auto-tags + priority for a new inquiry based on admin-
 * configurable thresholds. Reading the 4 settings in one query keeps
 * the hot path to a single round-trip.
 *
 * The VIP count is scoped to the *post-claim* reservation history: we
 * only count reservations created AFTER the user was first created
 * so that a placeholder being merged into a real account doesn't
 * retroactively mint a VIP tag off the placeholder's bookings.
 */
export async function computeInquiryTags(
  db: PrismaLike,
  input: InquiryTagInput,
): Promise<InquiryTagResult> {
  const settings = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          "inquiry_big_order_threshold",
          "inquiry_full_booking_threshold",
          "inquiry_urgent_days",
          "inquiry_vip_confirmed_count",
        ],
      },
    },
  });
  const asNumber = (key: string, fallback: number): number => {
    const s = settings.find((r) => r.key === key);
    if (!s) return fallback;
    const n = parseFloat(s.value);
    return Number.isFinite(n) ? n : fallback;
  };

  const bigOrderThreshold = asNumber("inquiry_big_order_threshold", 30);
  const fullBookingThreshold = asNumber("inquiry_full_booking_threshold", 55);
  const urgentDays = asNumber("inquiry_urgent_days", 7);
  const vipConfirmedCount = asNumber("inquiry_vip_confirmed_count", 3);

  const tags: InquiryTag[] = [];
  let priority: InquiryTagResult["priority"] = "NORMAL";

  if (input.guestCountMax >= fullBookingThreshold) tags.push("full_booking");
  else if (input.guestCountMax >= bigOrderThreshold) tags.push("big_order");

  const daysToDate = Math.floor(
    (input.preferredDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (daysToDate <= urgentDays) {
    tags.push("urgent");
    priority = "URGENT";
  }

  const confirmedCount = await db.reservation.count({
    where: {
      userId: input.userId,
      status: { in: ["CONFIRMED", "COMPLETED"] },
      createdAt: { gte: input.userCreatedAt },
    },
  });
  if (confirmedCount >= vipConfirmedCount) tags.push("vip");

  return { tags, priority };
}
