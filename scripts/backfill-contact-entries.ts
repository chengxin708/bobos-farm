/**
 * Backfill UserContactEntry rows from existing User records.
 *
 * For each User: write entries for non-null email/phone/wechatId.
 *  - Real account (email not @placeholder.local) → source='self'
 *  - Placeholder account                          → source='admin'
 * recordedById is null (system migration, no specific actor).
 *
 * Idempotent: helper skips on unique-violation. Safe to re-run.
 *
 * Run: npx tsx scripts/backfill-contact-entries.ts
 */
import { prisma } from "../src/lib/prisma";
import { recordContactsFromUser } from "../src/lib/contact-history";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, phone: true, wechatId: true },
  });

  let written = 0;
  let skipped = 0;
  for (const u of users) {
    const isPlaceholder = u.email.endsWith("@placeholder.local");
    const source = isPlaceholder ? "admin" : "self";

    const before = await prisma.userContactEntry.count({ where: { userId: u.id } });
    await recordContactsFromUser(prisma, u, source, null);
    const after = await prisma.userContactEntry.count({ where: { userId: u.id } });
    written += after - before;
    if (after - before === 0) skipped++;
  }

  console.log(`Users scanned:  ${users.length}`);
  console.log(`Entries added:  ${written}`);
  console.log(`Users skipped (already have entries): ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
