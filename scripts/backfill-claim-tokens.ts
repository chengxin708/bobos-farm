/**
 * One-off backfill: issue a claim token for every admin-created
 * (holdByAdmin=true) reservation in an active state that doesn't already
 * have one. Run once after 20260421000001_add_reservation_claim_tokens
 * lands so admins can hand out links for existing proxy bookings.
 *
 * Idempotent: re-running skips reservations that already have an active
 * token.
 *
 * Run: npx tsx scripts/backfill-claim-tokens.ts
 */
import { prisma } from "../src/lib/prisma";
import { createClaimToken, getActiveClaimToken } from "../src/lib/claim-token";

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: {
      holdByAdmin: true,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED"] },
    },
    select: { id: true, confirmationCode: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  for (const r of reservations) {
    const existing = await getActiveClaimToken(prisma, r.id);
    if (existing) {
      skipped++;
      continue;
    }
    await createClaimToken(prisma, r.id);
    created++;
    if ((created + skipped) % 50 === 0) {
      console.log(`  processed ${created + skipped}/${reservations.length}`);
    }
  }

  console.log(`Proxy reservations scanned: ${reservations.length}`);
  console.log(`Tokens created:             ${created}`);
  console.log(`Already had active token:   ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
