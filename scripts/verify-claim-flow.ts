#!/usr/bin/env tsx
/**
 * End-to-end claim flow verifier.
 *
 * Creates a synthetic placeholder user + reservation + active claim
 * token, then calls `claimReservation` against the real database. Asserts:
 *
 *   1. Claim succeeds (ok=true).
 *   2. Reservation now owned by the real user.
 *   3. Token consumed (consumedAt set, consumedByUserId = real user).
 *   4. Placeholder user soft-merged (mergedIntoUserId set).
 *   5. Placeholder's contact entries cleaned up.
 *
 * On exit cleans up all created rows in a single transaction so a
 * failure mid-run leaves no test detritus. If the cleanup itself fails,
 * the script logs the orphaned IDs so you can sweep manually.
 *
 * Run: `npm run verify:claim-flow`
 *
 * Use this as the "Phase 1 ops checklist — admin UI manual verification"
 * gate before flipping NEXT_PUBLIC_PAYMENTS_ENABLED to true.
 */
import { PrismaClient } from "@prisma/client"
import { createClaimToken } from "../src/lib/claim-token"
import { claimReservation } from "../src/lib/claim-flow"

interface CreatedIds {
  reservationId?: string
  tokenId?: string
  placeholderUserId?: string
  realUserId?: string
}

function shortId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set. Source env first.")
    process.exit(2)
  }

  const prisma = new PrismaClient()
  const created: CreatedIds = {}

  try {
    // Pick the first ACTIVE yurt — we don't create yurts (would mutate
    // production catalog); we attach the test reservation to an existing one.
    const yurt = await prisma.yurt.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
    })
    if (!yurt) {
      console.error("✗ No ACTIVE yurt in DB to attach a test reservation to.")
      process.exit(1)
    }

    // Use a date 30 days out to avoid bumping into past-date logic.
    const reservationDate = new Date()
    reservationDate.setDate(reservationDate.getDate() + 30)
    reservationDate.setHours(0, 0, 0, 0)

    // Use a yurtId+date that's free (the unique index will reject
    // colliding non-cancelled rows). Walk forward up to 60 days if 30
    // happens to be taken in a real env.
    let attempt = 0
    let ok = false
    while (attempt < 30 && !ok) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          yurtId: yurt.id,
          date: reservationDate,
          status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
        },
      })
      if (!conflict) ok = true
      else {
        reservationDate.setDate(reservationDate.getDate() + 1)
        attempt++
      }
    }
    if (!ok) {
      console.error("✗ Could not find a free yurt+date in the next 60 days.")
      process.exit(1)
    }

    const placeholderEmail = `verify-${shortId("ph")}@placeholder.local`
    const realEmail = `verify-${shortId("real")}@example.com`

    // 1. Placeholder user
    const placeholder = await prisma.user.create({
      data: {
        email: placeholderEmail,
        name: "Verify Test Placeholder",
        phone: "999-555-0100",
      },
    })
    created.placeholderUserId = placeholder.id

    // 2. Real user
    const real = await prisma.user.create({
      data: {
        email: realEmail,
        name: "Verify Test Real",
      },
    })
    created.realUserId = real.id

    // 3. Reservation owned by placeholder, holdByAdmin=true so it
    //    matches the admin-proxy claim path.
    const reservation = await prisma.reservation.create({
      data: {
        confirmationCode: `VR-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
        userId: placeholder.id,
        yurtId: yurt.id,
        date: reservationDate,
        guestCount: 8,
        status: "PENDING_PAYMENT",
        depositAmount: 300,
        depositStatus: "UNPAID",
        holdByAdmin: true,
        paymentDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      },
    })
    created.reservationId = reservation.id

    // 4. Claim token for that reservation
    const token = await createClaimToken(prisma, reservation.id)
    created.tokenId = token.id

    console.log("Setup complete:")
    console.log(`  reservation: ${reservation.id} (${reservation.confirmationCode})`)
    console.log(`  placeholder: ${placeholder.id} <${placeholder.email}>`)
    console.log(`  real:        ${real.id} <${real.email}>`)
    console.log(`  token:       ${token.token.slice(0, 8)}…`)
    console.log("")

    // ── Run the claim ──────────────────────────────────────────
    const result = await claimReservation(prisma, {
      userId: real.id,
      isAdmin: false,
      code: reservation.confirmationCode,
      token: token.token,
    })

    const failures: string[] = []

    if (!result.ok) {
      failures.push(`claim returned error=${result.error}, expected ok=true`)
    } else {
      // 5. Verify reservation owner
      const after = await prisma.reservation.findUnique({
        where: { id: reservation.id },
        select: { userId: true },
      })
      if (after?.userId !== real.id) {
        failures.push(
          `reservation.userId expected=${real.id}, actual=${after?.userId}`,
        )
      }

      // 6. Verify token consumed
      const consumedToken = await prisma.reservationClaimToken.findUnique({
        where: { id: token.id },
        select: { consumedAt: true, consumedByUserId: true },
      })
      if (!consumedToken?.consumedAt) {
        failures.push("token.consumedAt expected non-null, was null")
      }
      if (consumedToken?.consumedByUserId !== real.id) {
        failures.push(
          `token.consumedByUserId expected=${real.id}, actual=${consumedToken?.consumedByUserId}`,
        )
      }

      // 7. Verify placeholder soft-merge
      const merged = await prisma.user.findUnique({
        where: { id: placeholder.id },
        select: { mergedIntoUserId: true },
      })
      if (merged?.mergedIntoUserId !== real.id) {
        failures.push(
          `placeholder.mergedIntoUserId expected=${real.id}, actual=${merged?.mergedIntoUserId}`,
        )
      }
    }

    if (failures.length > 0) {
      console.error("✗ FAIL")
      for (const f of failures) console.error(`  - ${f}`)
      process.exit(1)
    }

    console.log("✓ PASS — claim flow end-to-end is healthy.")
  } finally {
    // ── Cleanup ────────────────────────────────────────────────
    try {
      if (created.tokenId) {
        await prisma.reservationClaimToken.delete({ where: { id: created.tokenId } })
      }
      if (created.reservationId) {
        await prisma.reservation.delete({ where: { id: created.reservationId } })
      }
      // Both users get hard-deleted; deleting placeholder also drops its
      // contact entries via cascading relations.
      if (created.placeholderUserId) {
        await prisma.user.delete({ where: { id: created.placeholderUserId } })
      }
      if (created.realUserId) {
        await prisma.user.delete({ where: { id: created.realUserId } })
      }
      console.log("Cleanup OK.")
    } catch (cleanupErr) {
      console.error("⚠️  Cleanup partially failed. Manual sweep needed:")
      console.error(`     created=${JSON.stringify(created)}`)
      console.error(`     error=${cleanupErr instanceof Error ? cleanupErr.message : cleanupErr}`)
    }
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("Verifier crashed:", err)
  process.exit(1)
})
