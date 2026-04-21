/**
 * Tiny in-memory per-key sliding-window rate limiter.
 *
 * Intentionally dependency-free — this app runs on a single Vercel
 * function pool with modest traffic, so a Map-based limiter is enough.
 * Swap for Upstash/Redis when we need cross-instance coordination.
 *
 * Keys are arbitrary strings (typically `${scope}:${ip}`). Each entry
 * stores the timestamps of recent hits inside the window; requests past
 * `limit` within `windowMs` are rejected.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const store = new Map<string, number[]>();

// Best-effort cleanup so the Map doesn't grow unbounded across many IPs.
const MAX_KEYS = 5000;

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const cutoff = now - opts.windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= opts.limit) {
    const oldest = hits[0];
    store.set(key, hits);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((oldest + opts.windowMs - now) / 1000),
    };
  }

  hits.push(now);
  store.set(key, hits);

  if (store.size > MAX_KEYS) {
    // Drop half the keys (LRU-ish: whichever iteration order Map gives).
    const toDelete = store.size - MAX_KEYS / 2;
    let i = 0;
    for (const k of store.keys()) {
      if (i++ >= toDelete) break;
      store.delete(k);
    }
  }

  return {
    ok: true,
    remaining: opts.limit - hits.length,
    retryAfterSeconds: 0,
  };
}

/** Extract a best-guess client IP from a Next.js request. */
export function ipFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Test helper — not exported via public entry points. */
export function __resetRateLimit(): void {
  store.clear();
}
