import { validateYurtSelection } from "../yurt-selection";

describe("validateYurtSelection", () => {
  const yurtA = { id: "yurt-a", capacity: 16, status: "ACTIVE" };
  const yurtB = { id: "yurt-b", capacity: 25, status: "ACTIVE" };
  const yurtClosed = { id: "yurt-c", capacity: 30, status: "INACTIVE" };

  it("rejects an empty selection", () => {
    expect(
      validateYurtSelection({
        requestedYurtIds: [],
        foundYurts: [],
        guestCount: 10,
      }),
    ).toEqual({ ok: false, error: "At least one yurt is required" });
  });

  it("rejects when one of the requested yurts wasn't found", () => {
    expect(
      validateYurtSelection({
        requestedYurtIds: ["yurt-a", "yurt-missing"],
        foundYurts: [yurtA],
        guestCount: 10,
      }),
    ).toEqual({ ok: false, error: "One or more yurts not found" });
  });

  it("rejects when any selected yurt is not ACTIVE", () => {
    expect(
      validateYurtSelection({
        requestedYurtIds: ["yurt-a", "yurt-c"],
        foundYurts: [yurtA, yurtClosed],
        guestCount: 10,
      }),
    ).toEqual({ ok: false, error: "Selected yurt is not active" });
  });

  it("rejects when guestCount exceeds combined capacity", () => {
    expect(
      validateYurtSelection({
        requestedYurtIds: ["yurt-a"],
        foundYurts: [yurtA],
        guestCount: 50,
      }),
    ).toEqual({
      ok: false,
      error: "Guest count exceeds combined capacity of selected yurts",
    });
  });

  it("accepts a single yurt that fits", () => {
    const res = validateYurtSelection({
      requestedYurtIds: ["yurt-a"],
      foundYurts: [yurtA],
      guestCount: 10,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.uniqueRequestedIds).toEqual(["yurt-a"]);
      expect(res.totalCapacity).toBe(16);
    }
  });

  it("accepts a multi-yurt selection that sums to >= guestCount", () => {
    const res = validateYurtSelection({
      requestedYurtIds: ["yurt-a", "yurt-b"],
      foundYurts: [yurtA, yurtB],
      guestCount: 35,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.uniqueRequestedIds).toEqual(["yurt-a", "yurt-b"]);
      expect(res.totalCapacity).toBe(41);
    }
  });

  it("dedupes accidental duplicates in the requested list", () => {
    const res = validateYurtSelection({
      requestedYurtIds: ["yurt-a", "yurt-a", "yurt-b"],
      foundYurts: [yurtA, yurtB],
      guestCount: 35,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.uniqueRequestedIds).toHaveLength(2);
    }
  });

  it("treats exact-fit (guestCount == totalCapacity) as valid", () => {
    expect(
      validateYurtSelection({
        requestedYurtIds: ["yurt-a"],
        foundYurts: [yurtA],
        guestCount: 16,
      }).ok,
    ).toBe(true);
  });

  it("treats over-by-one as invalid", () => {
    const res = validateYurtSelection({
      requestedYurtIds: ["yurt-a"],
      foundYurts: [yurtA],
      guestCount: 17,
    });
    expect(res.ok).toBe(false);
  });
});
