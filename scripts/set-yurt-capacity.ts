#!/usr/bin/env tsx
/**
 * One-off: bump yurt #1 capacity from 28 → 30.
 *
 * Read-then-update against whatever DATABASE_URL is set in `.env.local`
 * (loaded directly here so shell variable expansion can't mangle a
 * password that contains `$`, `!`, etc.).
 *
 * Safe-by-default: prints the current row, requires --apply to write,
 * and verifies the row after the update.
 *
 * Usage:
 *   vercel env pull --environment=production .env.local
 *   npx tsx scripts/set-yurt-capacity.ts          # dry-run
 *   npx tsx scripts/set-yurt-capacity.ts --apply  # actually write
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const TARGETS: { id: string; newCapacity: number }[] = [
  { id: "room-1", newCapacity: 30 },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const prisma = new PrismaClient()
  try {
    for (const t of TARGETS) {
      const current = await prisma.yurt.findUnique({ where: { id: t.id } })
      if (!current) {
        console.error(`✘ ${t.id} not found`)
        continue
      }
      console.log(
        `${t.id}  name=${current.name}  alias=${current.alias}  capacity=${current.capacity} → ${t.newCapacity}`,
      )
      if (current.capacity === t.newCapacity) {
        console.log(`  (already at ${t.newCapacity}, skip)`)
        continue
      }
      if (!apply) {
        console.log(`  (dry-run, not written; pass --apply to commit)`)
        continue
      }
      await prisma.yurt.update({
        where: { id: t.id },
        data: { capacity: t.newCapacity },
      })
      const verify = await prisma.yurt.findUnique({ where: { id: t.id } })
      if (verify?.capacity === t.newCapacity) {
        console.log(`  ✓ updated to ${verify.capacity}`)
      } else {
        console.error(`  ✘ verify failed (got ${verify?.capacity})`)
        process.exitCode = 1
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
