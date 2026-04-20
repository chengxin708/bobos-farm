import type { Prisma, PrismaClient, ReservationStatus } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const CLAIMABLE_STATUSES: ReservationStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "CONFIRMED",
];

const TERMINAL_STATUSES: ReservationStatus[] = [
  "CANCELLED",
  "CANCELLED_PENDING_REFUND",
  "EXPIRED",
];

export const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.local";

export type ClaimError =
  | "NOT_FOUND"
  | "ADMIN_CANNOT_CLAIM"
  | "ALREADY_CLAIMED"
  | "STATUS_NOT_CLAIMABLE"
  | "INVALID_TOKEN"
  | "AMBIGUOUS";

export type ClaimResult =
  | {
      ok: true;
      alreadyOwned: boolean;
      reservation: ClaimedReservationSummary;
      mergedReservationIds: string[];
    }
  | { ok: false; error: ClaimError };

export interface ClaimedReservationSummary {
  id: string;
  confirmationCode: string;
  date: Date;
  guestCount: number;
  status: ReservationStatus;
  yurtName: string | null;
}

export interface ClaimInput {
  /** Current session user's id (must not be an admin — check before calling). */
  userId: string;
  /** True if the session's user has role=ADMIN. Used to 403 before any DB work. */
  isAdmin: boolean;
  /** Reservation confirmation code, case-insensitive. */
  code: string;
  /** Opaque claim token (base64url). Omitted → "weak path". */
  token?: string | null;
}

/**
 * Claim a reservation for the current user, merging the placeholder
 * account (that created it) into the user's account. Runs in a single
 * serializable transaction so that concurrent claim attempts can only
 * produce one winner.
 *
 * The function is pure-ish w.r.t. the session: caller passes userId +
 * isAdmin, which keeps the helper usable from both the `/api/...claim`
 * route and the register+claim combined endpoint added in phase 3.
 */
export async function claimReservation(
  db: PrismaLike,
  input: ClaimInput,
): Promise<ClaimResult> {
  if (input.isAdmin) return { ok: false, error: "ADMIN_CANNOT_CLAIM" };

  const code = input.code.trim().toUpperCase();
  const token = input.token?.trim() || null;

  const reservation = await db.reservation.findUnique({
    where: { confirmationCode: code },
    include: {
      user: { select: { id: true, email: true } },
      yurt: { select: { name: true } },
    },
  });

  if (!reservation) return { ok: false, error: "NOT_FOUND" };

  const ownerIsPlaceholder = reservation.user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX);
  const alreadyOwnedBySelf = reservation.userId === input.userId;

  if (alreadyOwnedBySelf) {
    return {
      ok: true,
      alreadyOwned: true,
      reservation: toSummary(reservation),
      mergedReservationIds: [],
    };
  }

  if (!ownerIsPlaceholder) return { ok: false, error: "ALREADY_CLAIMED" };

  if (!CLAIMABLE_STATUSES.includes(reservation.status)) {
    return { ok: false, error: "STATUS_NOT_CLAIMABLE" };
  }

  if (token) {
    // Strict path: confirm the token is scoped to THIS reservation and
    // still active. Doing the lookup first gives a clean error shape;
    // the transaction below does the atomic consume.
    const now = new Date();
    const match = await db.reservationClaimToken.findFirst({
      where: {
        token,
        reservationId: reservation.id,
        consumedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (!match) return { ok: false, error: "INVALID_TOKEN" };
  } else {
    // Weak path: allowed only when the placeholder has a single active
    // reservation — avoids an attacker using a guessed 6-char code to
    // hijack a placeholder that owns multiple bookings.
    const activeCount = await db.reservation.count({
      where: {
        userId: reservation.userId,
        status: { in: CLAIMABLE_STATUSES },
      },
    });
    if (activeCount !== 1) return { ok: false, error: "AMBIGUOUS" };
  }

  const placeholderId = reservation.userId;
  const realUserId = input.userId;
  const now = new Date();

  let mergedReservationIds: string[];
  try {
    mergedReservationIds = await runMerge(db, {
      placeholderId,
      realUserId,
      originalPlaceholderEmail: reservation.user.email,
      token,
      now,
    });
  } catch (err) {
    if (err instanceof ClaimConflictError) {
      return { ok: false, error: err.claimError };
    }
    throw err;
  }

  const refreshed = await db.reservation.findUniqueOrThrow({
    where: { id: reservation.id },
    include: { yurt: { select: { name: true } } },
  });

  return {
    ok: true,
    alreadyOwned: false,
    reservation: toSummary(refreshed),
    mergedReservationIds,
  };
}

function toSummary(r: {
  id: string;
  confirmationCode: string;
  date: Date;
  guestCount: number;
  status: ReservationStatus;
  yurt: { name: string } | null;
}): ClaimedReservationSummary {
  return {
    id: r.id,
    confirmationCode: r.confirmationCode,
    date: r.date,
    guestCount: r.guestCount,
    status: r.status,
    yurtName: r.yurt?.name ?? null,
  };
}

async function runMerge(
  db: PrismaLike,
  args: {
    placeholderId: string;
    realUserId: string;
    originalPlaceholderEmail: string;
    token: string | null;
    now: Date;
  },
): Promise<string[]> {
  const { placeholderId, realUserId, originalPlaceholderEmail, token, now } = args;

  // Prisma's transaction API differs: on a PrismaClient we can request
  // Serializable isolation; on a TransactionClient we're already inside
  // a tx and just reuse it.
  const runner = async (tx: Prisma.TransactionClient): Promise<string[]> => {
    if (token) {
      const consumed = await tx.reservationClaimToken.updateMany({
        where: {
          token,
          consumedAt: null,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { consumedAt: now, consumedByUserId: realUserId },
      });
      if (consumed.count !== 1) {
        // Another concurrent claim beat us to it.
        throw new ClaimConflictError("INVALID_TOKEN");
      }
    }

    const reservationIds = (
      await tx.reservation.findMany({
        where: { userId: placeholderId },
        select: { id: true },
      })
    ).map((r) => r.id);

    await tx.reservation.updateMany({
      where: { userId: placeholderId },
      data: { userId: realUserId },
    });

    const inquiryIds = (
      await tx.inquiry.findMany({
        where: { userId: placeholderId },
        select: { id: true },
      })
    ).map((i) => i.id);

    if (inquiryIds.length) {
      await tx.inquiry.updateMany({
        where: { id: { in: inquiryIds } },
        data: { userId: realUserId },
      });
    }

    const placeholderEntries = await tx.userContactEntry.findMany({
      where: { userId: placeholderId },
    });
    for (const e of placeholderEntries) {
      await tx.userContactEntry.upsert({
        where: { userId_type_value: { userId: realUserId, type: e.type, value: e.value } },
        update: {},
        create: {
          userId: realUserId,
          type: e.type,
          value: e.value,
          source: e.source,
          recordedById: e.recordedById,
        },
      });
    }
    if (placeholderEntries.length) {
      await tx.userContactEntry.deleteMany({ where: { userId: placeholderId } });
    }

    await tx.pushSubscription.deleteMany({ where: { userId: placeholderId } });

    await tx.user.update({
      where: { id: placeholderId },
      data: {
        email: `merged-${placeholderId}@deleted.local`,
        mergedIntoUserId: realUserId,
        name: null,
        phone: null,
        wechatId: null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: realUserId,
        action: "ACCOUNT_MERGED",
        targetType: "User",
        targetId: placeholderId,
        details: {
          mergedReservationIds: reservationIds,
          mergedInquiryIds: inquiryIds,
          placeholderEmail: originalPlaceholderEmail,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: realUserId,
        action: "RESERVATION_CLAIMED",
        targetType: "Reservation",
        targetId: reservationIds[0] ?? placeholderId,
        details: {
          mergedReservationIds: reservationIds,
          previousUserId: placeholderId,
          withToken: !!token,
        },
      },
    });

    return reservationIds;
  };

  if ("$transaction" in db) {
    return db.$transaction(runner, { isolationLevel: "Serializable" });
  }
  return runner(db as Prisma.TransactionClient);
}

export class ClaimConflictError extends Error {
  readonly claimError: ClaimError;
  constructor(claimError: ClaimError) {
    super(`Claim conflict: ${claimError}`);
    this.claimError = claimError;
  }
}
