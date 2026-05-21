import crypto from "crypto";

interface IpEntry {
  fails: number;
  firstFailAt: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const attempts = new Map<string, IpEntry>();

export function resetThrottle(): void {
  attempts.clear();
}

function isThrottled(ip: string, now: number): boolean {
  const e = attempts.get(ip);
  if (!e) return false;
  if (now - e.firstFailAt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return e.fails >= MAX_FAILS;
}

function recordFail(ip: string, now: number): void {
  const e = attempts.get(ip);
  if (!e || now - e.firstFailAt > WINDOW_MS) {
    attempts.set(ip, { fails: 1, firstFailAt: now });
  } else {
    e.fails += 1;
  }
}

export function verifyBillPassword(
  input: string,
  ip: string,
): { ok: boolean; throttled?: boolean } {
  const now = Date.now();
  if (isThrottled(ip, now)) return { ok: false, throttled: true };

  const expected = process.env.BILL_PASSWORD;
  if (!expected) {
    recordFail(ip, now);
    return { ok: false };
  }

  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  const equalLength = a.length === b.length;
  // Constant-time compare on equal-length buffers; if lengths differ,
  // compare a against itself to keep timing similar then return false.
  const matched = equalLength
    ? crypto.timingSafeEqual(a, b)
    : (crypto.timingSafeEqual(a, a), false);

  if (matched) {
    attempts.delete(ip);
    return { ok: true };
  }
  recordFail(ip, now);
  return { ok: false };
}
