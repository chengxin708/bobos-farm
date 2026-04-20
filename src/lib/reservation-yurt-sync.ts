import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Reconcile ReservationYurt rows for a single-yurt reservation.
 *
 * Called whenever `Reservation.yurtId` changes so that the link table
 * stays in sync. In 1:1 mode we keep at most one row per reservation and
 * update its yurtId in place (instead of deleting + recreating) so that
 * any Order.reservationYurtId FK stays valid.
 *
 * Multi-yurt (phase 2+) should use a different helper; this one assumes
 * at most one ReservationYurt per reservation.
 */
export async function syncReservationYurt(
  db: PrismaLike,
  reservationId: string,
  newYurtId: string | null,
): Promise<void> {
  const existing = await db.reservationYurt.findFirst({
    where: { reservationId },
    orderBy: { sortOrder: "asc" },
  });

  if (newYurtId === null) {
    if (existing) {
      await db.reservationYurt.delete({ where: { id: existing.id } });
    }
    return;
  }

  if (!existing) {
    await db.reservationYurt.create({
      data: { reservationId, yurtId: newYurtId, sortOrder: 0 },
    });
    return;
  }

  if (existing.yurtId !== newYurtId) {
    await db.reservationYurt.update({
      where: { id: existing.id },
      data: { yurtId: newYurtId },
    });
  }
}
