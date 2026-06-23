import { prisma } from "@/lib/prisma";

/**
 * Whether online booking + inquiry submission is paused for customers
 * ("under development" mode), toggled from Admin → Settings → Booking.
 *
 * Defaults to false (normal operation) when the flag has never been set,
 * so a fresh database keeps accepting bookings. Admin-side proxy bookings
 * are intentionally NOT gated by this — staff can still create reservations
 * for customers who call in.
 */
export async function isBookingMaintenance(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "booking_maintenance" },
    select: { value: true },
  });
  return row?.value === "true";
}
