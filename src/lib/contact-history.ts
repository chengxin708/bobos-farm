import { prisma } from "./prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

export type ContactType = "phone" | "email" | "wechat";
export type ContactSource = "self" | "admin";

type DbClient = PrismaClient | Prisma.TransactionClient;

const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.local";

function normalize(type: ContactType, value: string): string {
  const v = value.trim();
  if (type === "email") return v.toLowerCase();
  return v;
}

function isMeaningful(type: ContactType, value: string): boolean {
  const v = normalize(type, value);
  if (!v) return false;
  if (type === "email" && v.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return false;
  return true;
}

/**
 * Idempotent: writes a contact entry if (userId, type, value) does not already exist.
 * Skips empty / placeholder values silently.
 */
export async function recordContactEntry(
  db: DbClient,
  args: {
    userId: string;
    type: ContactType;
    value: string | null | undefined;
    source: ContactSource;
    recordedById?: string | null;
  }
): Promise<void> {
  if (args.value === null || args.value === undefined) return;
  const normalized = normalize(args.type, args.value);
  if (!isMeaningful(args.type, normalized)) return;

  try {
    await db.userContactEntry.create({
      data: {
        userId: args.userId,
        type: args.type,
        value: normalized,
        source: args.source,
        recordedById: args.recordedById ?? null,
      },
    });
  } catch (err) {
    // P2002 unique violation = entry already exists, idempotent skip.
    if ((err as { code?: string }).code === "P2002") return;
    throw err;
  }
}

/**
 * Convenience: record all 3 contact fields from a User-shaped object.
 */
export async function recordContactsFromUser(
  db: DbClient,
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    wechatId?: string | null;
  },
  source: ContactSource,
  recordedById?: string | null
): Promise<void> {
  await Promise.all([
    recordContactEntry(db, { userId: user.id, type: "email", value: user.email, source, recordedById }),
    recordContactEntry(db, { userId: user.id, type: "phone", value: user.phone, source, recordedById }),
    recordContactEntry(db, { userId: user.id, type: "wechat", value: user.wechatId, source, recordedById }),
  ]);
}

/** Re-export for callers that need the default prisma client. */
export { prisma };
