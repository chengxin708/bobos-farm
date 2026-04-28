#!/usr/bin/env tsx
/**
 * Migration readiness check.
 *
 * Wraps `prisma migrate status` so a single command tells you whether
 * the connected database is up to date with the migration files in
 * prisma/migrations. Returns non-zero if migrations are pending or the
 * DB drifted from the schema.
 *
 * Run: `npm run check:migrations`
 *
 * Use against production DATABASE_URL before deploying — this is the
 * "did Phase 1 ops actually land?" gate.
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import fs from "node:fs"

function listLocalMigrations(): string[] {
  const dir = path.resolve(__dirname, "..", "prisma", "migrations")
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("✗ DATABASE_URL is not set. Source your env first:")
    console.error("    vercel env pull .env.local && set -a && source .env.local")
    process.exit(2)
  }

  const local = listLocalMigrations()
  console.log(`Local migration folders: ${local.length}`)
  for (const m of local) console.log(`  • ${m}`)
  console.log("")

  console.log("Running `prisma migrate status`...")
  const res = spawnSync("npx", ["prisma", "migrate", "status"], {
    stdio: "inherit",
    env: process.env,
  })

  if (res.status !== 0) {
    console.error(
      `\n✗ prisma migrate status exited with code ${res.status}. Pending migrations or drift detected.`,
    )
    process.exit(res.status ?? 1)
  }

  console.log("\n✓ Database is in sync with migration files.")
}

main()
