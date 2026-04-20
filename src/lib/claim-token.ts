import crypto from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Generate an unguessable claim token. base64url-encoded 32 random bytes
 * (256 bits of entropy, 43 url-safe chars) — comfortably above brute-force.
 */
export function generateClaimToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Create a new active claim token for a reservation. Revokes any prior
 * unconsumed, unrevoked tokens on the same reservation so only the most
 * recently issued link is valid (admins may regenerate to invalidate a
 * link that was shared to the wrong customer).
 */
export async function createClaimToken(
  db: PrismaLike,
  reservationId: string,
  opts: { expiresAt?: Date | null } = {},
): Promise<{ id: string; token: string; expiresAt: Date | null }> {
  const now = new Date();
  await db.reservationClaimToken.updateMany({
    where: {
      reservationId,
      consumedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  const token = generateClaimToken();
  const row = await db.reservationClaimToken.create({
    data: {
      reservationId,
      token,
      expiresAt: opts.expiresAt ?? null,
    },
    select: { id: true, token: true, expiresAt: true },
  });
  return row;
}

/**
 * Find the currently active (unconsumed, unrevoked, unexpired) claim
 * token for a reservation, if any. Returns the most recently created.
 */
export async function getActiveClaimToken(
  db: PrismaLike,
  reservationId: string,
): Promise<{ id: string; token: string; expiresAt: Date | null } | null> {
  const now = new Date();
  const row = await db.reservationClaimToken.findFirst({
    where: {
      reservationId,
      consumedAt: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, expiresAt: true },
  });
  return row;
}
