import { NextRequest, NextResponse } from "next/server";
import { checkAvailabilityForDate } from "@/lib/yurt-assignment";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const guestsStr = searchParams.get("guests");

  if (!dateStr || !ISO_DATE.test(dateStr)) {
    return NextResponse.json(
      { error: "missing_or_invalid_date", expected: "YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const guestCount = guestsStr ? parseInt(guestsStr, 10) : NaN;
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 200) {
    return NextResponse.json(
      { error: "missing_or_invalid_guests", expected: "integer 1-200" },
      { status: 400 },
    );
  }

  try {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const probe = await checkAvailabilityForDate(date, guestCount);
    return NextResponse.json({
      date: dateStr,
      guests: guestCount,
      canFit: probe.canFit,
      hypotheticalYurtId: probe.hypotheticalYurtId,
      allYurtsFullForCount: probe.allYurtsFullForCount,
      // anomalyReason: 'exceeds_max_capacity' | 'no_yurt_available' |
      // 'closed_day' | null. 'closed_day' means the date isn't an
      // operating day (default-closed weekday or admin-set
      // CLOSED/PRIVATE_EVENT override) — UI should still redirect to
      // /inquiries/new via shouldInquire.
      anomalyReason: probe.anomalyReason ?? null,
      /** UI hint: should the booking flow redirect to /inquiries/new? */
      shouldInquire: !probe.canFit,
    });
  } catch (error) {
    console.error("Failed to check availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 },
    );
  }
}
