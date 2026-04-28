import { computeCustomerPaymentDeadline, resolveCustomerDeadlineHours } from "../customer-deadline";

describe("computeCustomerPaymentDeadline", () => {
  const now = new Date("2026-04-20T12:00:00Z");

  it("returns now + 24 hours by default semantics", () => {
    const deadline = computeCustomerPaymentDeadline({ now, hours: 24 });
    expect(deadline).toEqual(new Date("2026-04-21T12:00:00Z"));
  });

  it("honors a custom hours value", () => {
    const deadline = computeCustomerPaymentDeadline({ now, hours: 2 });
    expect(deadline.toISOString()).toBe("2026-04-20T14:00:00.000Z");
  });

  it("does not return null — customer self-serve always has a deadline", () => {
    const deadline = computeCustomerPaymentDeadline({ now, hours: 24 });
    expect(deadline).toBeInstanceOf(Date);
  });
});

describe("resolveCustomerDeadlineHours", () => {
  it("defaults to 24h when setting is missing", () => {
    expect(resolveCustomerDeadlineHours(undefined)).toBe(24);
  });

  it("parses a numeric string as hours", () => {
    expect(resolveCustomerDeadlineHours("12")).toBe(12);
    expect(resolveCustomerDeadlineHours("48")).toBe(48);
    expect(resolveCustomerDeadlineHours("0.5")).toBe(0.5);
  });

  it("falls back to 24 on garbage / non-positive values", () => {
    expect(resolveCustomerDeadlineHours("abc")).toBe(24);
    expect(resolveCustomerDeadlineHours("")).toBe(24);
    expect(resolveCustomerDeadlineHours("0")).toBe(24);
    expect(resolveCustomerDeadlineHours("-5")).toBe(24);
  });
});
