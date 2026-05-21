import { signSession, verifySession, SESSION_COOKIE_NAME } from "../session";

describe("session", () => {
  beforeEach(() => {
    process.env.BILL_SESSION_SECRET = "test-secret-do-not-use-in-prod";
  });

  it("signs a session with an expiresAt and verifies it back", async () => {
    const expiresAt = Date.now() + 60_000;
    const cookie = await signSession(expiresAt);
    expect(cookie.split(".")).toHaveLength(2);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(true);
  });

  it("rejects tampered signature", async () => {
    const cookie = await signSession(Date.now() + 60_000);
    const [exp, sig] = cookie.split(".");
    const tampered = `${exp}.${sig.replace(/[A-Za-z]/, "X")}`;
    const r = await verifySession(tampered);
    expect(r.ok).toBe(false);
  });

  it("rejects expired session", async () => {
    const cookie = await signSession(Date.now() - 1_000);
    const r = await verifySession(cookie);
    expect(r.ok).toBe(false);
  });

  it("rejects malformed cookie", async () => {
    expect((await verifySession("garbage")).ok).toBe(false);
    expect((await verifySession("a.b.c")).ok).toBe(false);
    expect((await verifySession("")).ok).toBe(false);
  });

  it("rejects when secret is unset", async () => {
    delete process.env.BILL_SESSION_SECRET;
    await expect(signSession(Date.now() + 60_000)).rejects.toThrow();
  });

  it("exposes a constant cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("bill_session");
  });
});
