/**
 * GDPR data-deletion script. Removes a user's personal information
 * while preserving the business/financial records the farm needs to
 * keep (Reservation, Order, ActivityLog).
 *
 * Usage:
 *   npx tsx scripts/delete-user-data.ts --user-id=<id>           # dry run
 *   npx tsx scripts/delete-user-data.ts --user-id=<id> --confirm # apply
 *
 * The dry run prints exactly what would be deleted / anonymized so you
 * can eyeball it before re-running with --confirm.
 */
import { prisma } from "../src/lib/prisma";

function parseArgs() {
  const args = process.argv.slice(2);
  let userId: string | null = null;
  let confirm = false;
  for (const a of args) {
    if (a.startsWith("--user-id=")) userId = a.slice("--user-id=".length);
    else if (a === "--confirm") confirm = true;
  }
  return { userId, confirm };
}

async function main() {
  const { userId, confirm } = parseArgs();
  if (!userId) {
    console.error("Missing --user-id=<id>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      wechatId: true,
      role: true,
      mergedIntoUserId: true,
    },
  });
  if (!user) {
    console.error(`User ${userId} not found`);
    process.exit(1);
  }
  if (user.role === "ADMIN") {
    console.error("Refusing to delete an ADMIN account via this script");
    process.exit(1);
  }
  if (user.email.startsWith("deleted-")) {
    console.error("User already marked deleted");
    process.exit(0);
  }

  const [contactCount, pushCount, accountCount, reservationCount, inquiryCount] = await Promise.all([
    prisma.userContactEntry.count({ where: { userId } }),
    prisma.pushSubscription.count({ where: { userId } }),
    prisma.account.count({ where: { userId } }),
    prisma.reservation.count({ where: { userId } }),
    prisma.inquiry.count({ where: { userId } }),
  ]);

  console.log("=== GDPR deletion plan ===");
  console.log(`User:                    ${user.id}  (${user.email})`);
  console.log(`Name / phone / wechat:   ${user.name ?? "-"} / ${user.phone ?? "-"} / ${user.wechatId ?? "-"}`);
  console.log("Actions:");
  console.log(`  - Soft-delete User (email → deleted-${user.id}@deleted.local, identifiers nulled)`);
  console.log(`  - Delete UserContactEntry:  ${contactCount}`);
  console.log(`  - Delete PushSubscription:  ${pushCount}`);
  console.log(`  - Delete Account (OAuth):   ${accountCount}`);
  console.log(`  - Preserve Reservation (x${reservationCount}) — business record; specialRequests blanked`);
  console.log(`  - Preserve Inquiry      (x${inquiryCount}) — audit record; note blanked`);
  console.log("  - Preserve ActivityLog entirely (audit trail)");

  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm to apply.");
    await prisma.$disconnect();
    return;
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.userContactEntry.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.reservation.updateMany({
      where: { userId },
      data: { specialRequests: null },
    });
    await tx.inquiry.updateMany({
      where: { userId },
      data: { note: null },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.local`,
        name: null,
        phone: null,
        wechatId: null,
        image: null,
        passwordHash: null,
        unsubscribeToken: null,
      },
    });
    await tx.activityLog.create({
      data: {
        userId: null,
        action: "USER_DATA_DELETED",
        targetType: "User",
        targetId: userId,
        details: {
          deletedAt: now.toISOString(),
          contactEntries: contactCount,
          pushSubscriptions: pushCount,
          accounts: accountCount,
          reservationsPreserved: reservationCount,
          inquiriesPreserved: inquiryCount,
        },
      },
    });
  });

  console.log(`\n✔ User ${userId} anonymized.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
