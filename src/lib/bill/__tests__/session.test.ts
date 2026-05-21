import { signSession, verifySession, SESSION_COOKIE_NAME } from "../session";

describe("session", () => {
  beforeEach(() => {
    process.env.BILL_SESSION_SECRET = "test-secret-do-not-use-in-prod";
  });

  it("signs a session with an expiresAt and verifies it back", () => {
    const expiresAt = Date.now() + 60_000;
    const cookie = signSession(expiresAt);
    expect(cookie.split(".")).toHaveLength(2);
    expect(verifySession(cookie).ok).toBe(true);
  });

  it("rejects tampered signature", () => {
    const cookie = signSession(Date.now() + 60_000);
    const [exp, sig] = cookie.split(".");
    const tampered = `${exp}.${sig.replace(/[A-Za-z]/, "X")}`;
    expect(verifySession(tampered).ok).toBe(false);
  });

  it("rejects expired session", () => {
    const cookie = signSession(Date.now() - 1_000);
    expect(verifySession(cookie).ok).toBe(false);
  });

  it("rejects malformed cookie", () => {
    expect(verifySession("garbage").ok).toBe(false);
    expect(verifySession("a.b.c").ok).toBe(false);
    expect(verifySession("").ok).toBe(false);
  });

  it("rejects when secret is unset", () => {
    delete process.env.BILL_SESSION_SECRET;
    expect(() => signSession(Date.now() + 60_000)).toThrow();
  });

  it("exposes a constant cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("bill_session");
  });
});
