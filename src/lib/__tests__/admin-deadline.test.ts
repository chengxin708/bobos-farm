import { computeAdminPaymentDeadline, resolveAdminDeadlineHours } from "../admin-deadline";

describe("computeAdminPaymentDeadline", () => {
  const now = new Date("2026-04-20T12:00:00Z");

  it("returns now + hours for a future paying reservation", () => {
    const deadline = computeAdminPaymentDeadline({
      now,
      hours: 48,
      isPastDate: false,
      skipPayment: false,
    });
    expect(deadline).toEqual(new Date("2026-04-22T12:00:00Z"));
  });

  it("returns null for past-date historical records", () => {
    expect(
      computeAdminPaymentDeadline({ now, hours: 48, isPastDate: true, skipPayment: false }),
    ).toBeNull();
  });

  it("returns null when the deposit is $0 (skipPayment)", () => {
    expect(
      computeAdminPaymentDeadline({ now, hours: 48, isPastDate: false, skipPayment: true }),
    ).toBeNull();
  });

  it("honors a custom hours value", () => {
    const deadline = computeAdminPaymentDeadline({
      now,
      hours: 2,
      isPastDate: false,
      skipPayment: false,
    });
    expect(deadline?.toISOString()).toBe("2026-04-20T14:00:00.000Z");
  });
});

describe("resolveAdminDeadlineHours", () => {
  it("defaults to 48h when setting is missing", () => {
    expect(resolveAdminDeadlineHours(undefined)).toBe(48);
  });

  it("parses a numeric string", () => {
    expect(resolveAdminDeadlineHours("24")).toBe(24);
    expect(resolveAdminDeadlineHours("0.5")).toBe(0.5);
  });

  it("falls back to 48 on garbage / non-positive values", () => {
    expect(resolveAdminDeadlineHours("abc")).toBe(48);
    expect(resolveAdminDeadlineHours("")).toBe(48);
    expect(resolveAdminDeadlineHours("0")).toBe(48);
    expect(resolveAdminDeadlineHours("-5")).toBe(48);
  });
});
