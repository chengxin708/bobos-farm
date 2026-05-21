export const SESSION_COOKIE_NAME = "bill_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.BILL_SESSION_SECRET;
  if (!s) throw new Error("BILL_SESSION_SECRET is not set");
  return s;
}

const encoder = new TextEncoder();

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Constant-time string compare. Both strings must be the same length;
// the caller checks length before calling this.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacBase64Url(value: string): Promise<string> {
  const key = await importKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(sig);
}

export async function signSession(expiresAt: number): Promise<string> {
  const exp = String(expiresAt);
  const sig = await hmacBase64Url(exp);
  return `${exp}.${sig}`;
}

export async function verifySession(cookie: string | undefined): Promise<{ ok: boolean }> {
  if (!cookie) return { ok: false };
  const parts = cookie.split(".");
  if (parts.length !== 2) return { ok: false };
  const [exp, sig] = parts;
  if (!exp || !sig) return { ok: false };
  let expected: string;
  try {
    expected = await hmacBase64Url(exp);
  } catch {
    return { ok: false };
  }
  if (!timingSafeEqualStr(sig, expected)) return { ok: false };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() >= expNum) return { ok: false };
  return { ok: true };
}

export function newSessionExpiresAt(): number {
  return Date.now() + SESSION_TTL_MS;
}
