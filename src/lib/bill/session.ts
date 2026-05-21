import crypto from "crypto";

export const SESSION_COOKIE_NAME = "bill_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.BILL_SESSION_SECRET;
  if (!s) throw new Error("BILL_SESSION_SECRET is not set");
  return s;
}

function hmac(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function signSession(expiresAt: number): string {
  const exp = String(expiresAt);
  return `${exp}.${hmac(exp)}`;
}

export function verifySession(cookie: string | undefined): { ok: boolean } {
  if (!cookie) return { ok: false };
  const parts = cookie.split(".");
  if (parts.length !== 2) return { ok: false };
  const [exp, sig] = parts;
  if (!exp || !sig) return { ok: false };
  let expected: string;
  try {
    expected = hmac(exp);
  } catch {
    return { ok: false };
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() >= expNum) return { ok: false };
  return { ok: true };
}

export function newSessionExpiresAt(): number {
  return Date.now() + SESSION_TTL_MS;
}
