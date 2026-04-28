import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { sendPushToAdmins } from "@/lib/push"

/**
 * Authorize a Vercel cron request via the CRON_SECRET bearer token.
 * Returns null on success, or a NextResponse to short-circuit on failure.
 * Uses timing-safe comparison to keep the secret out of side channels.
 */
export function authorizeCron(req: NextRequest): NextResponse | null {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const authHeader = req.headers.get("authorization")
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const a = Buffer.from(authHeader, "utf8")
    const b = Buffer.from(`Bearer ${configuredSecret}`, "utf8")
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

interface CronOk extends Record<string, unknown> {
  success: true
}

/**
 * Run a cron handler with structured logging + admin alert on failure.
 *
 * - On success: console.log a single line with name + duration + handler
 *   payload, returns 200 with { success: true, ...payload }.
 * - On failure: console.error with name + duration + error, fires a
 *   best-effort push notification to admins, returns 500.
 *
 * The handler should be the cron's *body* (skip auth — that's already
 * gated by authorizeCron). Throw anything to trigger the failure path;
 * Prisma errors propagate naturally.
 */
export async function runCron(
  name: string,
  handler: () => Promise<Record<string, unknown>>,
): Promise<NextResponse> {
  const startedAt = Date.now()
  try {
    const result = await handler()
    const duration = Date.now() - startedAt
    console.log(
      `[cron:${name}] ok duration=${duration}ms ${JSON.stringify(result)}`,
    )
    const payload: CronOk = { success: true, ...result }
    return NextResponse.json(payload)
  } catch (err) {
    const duration = Date.now() - startedAt
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[cron:${name}] FAILED duration=${duration}ms error=${message}`,
      err,
    )
    // Best-effort alert — never let a notification path crash the
    // response itself. Tag is unique per cron so multiple failures of
    // the same job collapse into one badge instead of spamming.
    sendPushToAdmins({
      title: `Cron failed: ${name}`,
      body: message.slice(0, 200),
      url: "/admin",
      tag: `cron-fail-${name}`,
    }).catch(() => {})
    return NextResponse.json(
      { success: false, error: "Cron failed", name, message },
      { status: 500 },
    )
  }
}
