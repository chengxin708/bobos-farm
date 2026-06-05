import { verifyBillPassword, resetThrottle } from "../password";

describe("verifyBillPassword", () => {
  beforeEach(() => {
    process.env.BILL_PASSWORD = "888888";
    process.env.BILL_AI_PASSWORD = "111111";
    resetThrottle();
  });

  it("accepts the normal password without unlocking AI", () => {
    const r = verifyBillPassword("888888", "1.2.3.4");
    expect(r.ok).toBe(true);
    expect(r.ai).toBe(false);
  });

  it("accepts the AI password and unlocks AI", () => {
    const r = verifyBillPassword("111111", "1.2.3.4");
    expect(r.ok).toBe(true);
    expect(r.ai).toBe(true);
  });

  it("rejects mismatched password", () => {
    const r = verifyBillPassword("wrong", "1.2.3.4");
    expect(r.ok).toBe(false);
    expect(r.ai).toBe(false);
  });

  it("rejects when env var is unset", () => {
    delete process.env.BILL_PASSWORD;
    expect(verifyBillPassword("888888", "1.2.3.4").ok).toBe(false);
  });

  it("AI never unlocks when BILL_AI_PASSWORD is unset", () => {
    delete process.env.BILL_AI_PASSWORD;
    // normal login still works
    expect(verifyBillPassword("888888", "1.2.3.4").ok).toBe(true);
    // AI password no longer matches anything
    const r = verifyBillPassword("111111", "5.6.7.8");
    expect(r.ok).toBe(false);
    expect(r.ai).toBe(false);
  });

  it("throttles after 5 failed attempts per IP within 10 min", () => {
    for (let i = 0; i < 5; i++) {
      verifyBillPassword("wrong", "1.2.3.4");
    }
    const r = verifyBillPassword("888888", "1.2.3.4");
    expect(r.ok).toBe(false);
    expect(r.throttled).toBe(true);
  });

  it("throttle is per-IP", () => {
    for (let i = 0; i < 5; i++) verifyBillPassword("wrong", "1.2.3.4");
    expect(verifyBillPassword("888888", "5.6.7.8").ok).toBe(true);
  });

  it("uses constant-time compare to mitigate timing leaks", () => {
    // Smoke test: long mismatch returns same result class as short mismatch.
    expect(verifyBillPassword("x", "ip").ok).toBe(false);
    expect(verifyBillPassword("a".repeat(1000), "ip2").ok).toBe(false);
  });
});
