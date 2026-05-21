import { generateReceiptToken } from "../token";

describe("generateReceiptToken", () => {
  it("is url-safe base64 of expected length", () => {
    // 16 random bytes → 22 base64url chars (no padding)
    const t = generateReceiptToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("never collides across many draws", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateReceiptToken());
    expect(set.size).toBe(1000);
  });
});
