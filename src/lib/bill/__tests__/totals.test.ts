import { computeTotals, dollarsToCents, centsToDollarString } from "../totals";

describe("computeTotals", () => {
  it("sums items and applies tax", () => {
    const r = computeTotals(
      [{ priceCents: 1000, quantity: 2 }, { priceCents: 500, quantity: 1 }],
      0,
      0.08,
    );
    expect(r.subtotalCents).toBe(2500);
    expect(r.discountCents).toBe(0);
    expect(r.taxCents).toBe(200);
    expect(r.totalCents).toBe(2700);
  });

  it("applies discount before tax", () => {
    const r = computeTotals([{ priceCents: 10000, quantity: 1 }], 500, 0.1);
    expect(r.subtotalCents).toBe(10000);
    expect(r.discountCents).toBe(500);
    expect(r.taxCents).toBe(950);
    expect(r.totalCents).toBe(10450);
  });

  it("clamps discount that exceeds subtotal", () => {
    const r = computeTotals([{ priceCents: 100, quantity: 1 }], 999, 0.08);
    expect(r.discountCents).toBe(100);
    expect(r.taxCents).toBe(0);
    expect(r.totalCents).toBe(0);
  });

  it("rejects negative discount by clamping to 0", () => {
    const r = computeTotals([{ priceCents: 100, quantity: 1 }], -50, 0);
    expect(r.discountCents).toBe(0);
  });

  it("rounds tax half-away-from-zero", () => {
    // 333 * 0.08 = 26.64 → 27
    const r = computeTotals([{ priceCents: 333, quantity: 1 }], 0, 0.08);
    expect(r.taxCents).toBe(27);
  });

  it("returns zero totals for empty items", () => {
    const r = computeTotals([], 0, 0.08);
    expect(r).toEqual({ subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe("dollarsToCents / centsToDollarString", () => {
  it("converts string '12.34' → 1234", () => {
    expect(dollarsToCents("12.34")).toBe(1234);
  });

  it("converts string '12' → 1200", () => {
    expect(dollarsToCents("12")).toBe(1200);
  });

  it("rejects invalid input (NaN-safe)", () => {
    expect(dollarsToCents("abc")).toBe(0);
    expect(dollarsToCents("")).toBe(0);
  });

  it("formats 1234 → '12.34'", () => {
    expect(centsToDollarString(1234)).toBe("12.34");
  });

  it("formats 0 → '0.00'", () => {
    expect(centsToDollarString(0)).toBe("0.00");
  });

  it("formats 5 → '0.05'", () => {
    expect(centsToDollarString(5)).toBe("0.05");
  });
});
