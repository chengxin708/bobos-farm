import { signSession, verifySession, SESSION_COOKIE_NAME } from "../session";

const SECRET = "test-secret-do-not-use-in-prod";

// Reproduce the legacy 2-part cookie scheme (exp.sig where sig = HMAC(exp))
// to assert backward compatibility against the current verifySession.
async function signLegacySession(expiresAt: number): Promise<string> {
  const exp = String(expiresAt);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(exp));
  const arr = new Uint8Array(sigBytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  const sig = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${exp}.${sig}`;
}

describe("session", () => {
  beforeEach(() => {
    process.env.BILL_SESSION_SECRET = SECRET;
  });

  it("signs an AI session and verifies it back with ai=true", async () => {
    const expiresAt = Date.now() + 60_000;
    const cookie = await signSession(expiresAt, true);
    expect(cookie.split(".")).toHaveLength(3);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(true);
    expect(r.ai).toBe(true);
  });

  it("signs a non-AI session and verifies it back with ai=false", async () => {
    const expiresAt = Date.now() + 60_000;
    const cookie = await signSession(expiresAt, false);
    expect(cookie.split(".")).toHaveLength(3);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(true);
    expect(r.ai).toBe(false);
  });

  it("accepts a legacy 2-part cookie as ok without AI", async () => {
    const cookie = await signLegacySession(Date.now() + 60_000);
    expect(cookie.split(".")).toHaveLength(2);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(true);
    expect(r.ai).toBe(false);
  });

  it("rejects a tampered AI flag", async () => {
    const cookie = await signSession(Date.now() + 60_000, false);
    const [exp, , sig] = cookie.split(".");
    const tampered = `${exp}.1.${sig}`;
    const r = await verifySession(tampered);
    expect(r.ok).toBe(false);
    expect(r.ai).toBe(false);
  });

  it("rejects tampered signature", async () => {
    const cookie = await signSession(Date.now() + 60_000, true);
    const [exp, ai, sig] = cookie.split(".");
    const tampered = `${exp}.${ai}.${sig.replace(/[A-Za-z]/, "X")}`;
    const r = await verifySession(tampered);
    expect(r.ok).toBe(false);
  });

  it("rejects a tampered legacy signature", async () => {
    const cookie = await signLegacySession(Date.now() + 60_000);
    const [exp, sig] = cookie.split(".");
    const tampered = `${exp}.${sig.replace(/[A-Za-z]/, "X")}`;
    const r = await verifySession(tampered);
    expect(r.ok).toBe(false);
  });

  it("rejects expired session", async () => {
    const cookie = await signSession(Date.now() - 1_000, true);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(false);
  });

  it("rejects an expired legacy session", async () => {
    const cookie = await signLegacySession(Date.now() - 1_000);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(false);
  });

  it("rejects malformed cookie", async () => {
    expect((await verifySession("garbage")).ok).toBe(false);
    expect((await verifySession("a.b.c.d")).ok).toBe(false);
    expect((await verifySession("")).ok).toBe(false);
  });

  it("rejects when secret is unset", async () => {
    delete process.env.BILL_SESSION_SECRET;
    await expect(signSession(Date.now() + 60_000, false)).rejects.toThrow();
  });

  it("exposes a constant cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("bill_session");
  });
});
