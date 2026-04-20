import { EXTEND_HOURS, computeExtendedDeadline } from "../extend-hold";

describe("computeExtendedDeadline", () => {
  const now = new Date("2026-04-20T12:00:00Z");

  it("adds EXTEND_HOURS to a future deadline", () => {
    const current = new Date("2026-04-21T00:00:00Z");
    const next = computeExtendedDeadline(current, now);
    expect(next.getTime() - current.getTime()).toBe(EXTEND_HOURS * 3600 * 1000);
  });

  it("extends from now when the current deadline is null", () => {
    const next = computeExtendedDeadline(null, now);
    expect(next.getTime() - now.getTime()).toBe(EXTEND_HOURS * 3600 * 1000);
  });

  it("extends from now when the current deadline is already overdue", () => {
    const past = new Date("2026-04-19T00:00:00Z");
    const next = computeExtendedDeadline(past, now);
    expect(next.getTime() - now.getTime()).toBe(EXTEND_HOURS * 3600 * 1000);
  });

  it("accepts ISO string input (Prisma serialized Date)", () => {
    const next = computeExtendedDeadline("2026-04-21T00:00:00.000Z", now);
    expect(next.toISOString()).toBe("2026-04-22T00:00:00.000Z");
  });
});
