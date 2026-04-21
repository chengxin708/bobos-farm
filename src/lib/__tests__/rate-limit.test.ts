import { rateLimit, __resetRateLimit } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("allows up to `limit` requests in the window", () => {
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("ip:1", opts, 1000 + i).ok).toBe(true);
    }
    const blocked = rateLimit("ip:1", opts, 1000 + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("lets requests through again after the window slides past", () => {
    const opts = { limit: 2, windowMs: 10_000 };
    expect(rateLimit("ip:2", opts, 0).ok).toBe(true);
    expect(rateLimit("ip:2", opts, 1_000).ok).toBe(true);
    expect(rateLimit("ip:2", opts, 2_000).ok).toBe(false);
    // Past the window — first two hits are expired.
    expect(rateLimit("ip:2", opts, 12_000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("ip:a", opts).ok).toBe(true);
    expect(rateLimit("ip:b", opts).ok).toBe(true);
    expect(rateLimit("ip:a", opts).ok).toBe(false);
    expect(rateLimit("ip:b", opts).ok).toBe(false);
  });
});
