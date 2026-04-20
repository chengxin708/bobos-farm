import { isYurtDateConflict } from "../reservation-errors";

describe("isYurtDateConflict", () => {
  it("matches Prisma P2002 on the active-unique partial index", () => {
    expect(
      isYurtDateConflict({
        code: "P2002",
        meta: { target: "reservation_yurt_date_active" },
      }),
    ).toBe(true);

    expect(
      isYurtDateConflict({
        code: "P2002",
        meta: { target: ["reservation_yurt_date_active"] },
      }),
    ).toBe(true);
  });

  it("rejects unrelated P2002 errors (e.g. confirmation code collision)", () => {
    expect(
      isYurtDateConflict({
        code: "P2002",
        meta: { target: ["confirmationCode"] },
      }),
    ).toBe(false);
  });

  it("rejects non-P2002 errors and non-error values", () => {
    expect(isYurtDateConflict({ code: "P2025" })).toBe(false);
    expect(isYurtDateConflict(new Error("boom"))).toBe(false);
    expect(isYurtDateConflict(null)).toBe(false);
    expect(isYurtDateConflict(undefined)).toBe(false);
    expect(isYurtDateConflict("P2002")).toBe(false);
  });
});
