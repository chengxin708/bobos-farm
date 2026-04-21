import { computeInquiryTags } from "../inquiry-tagging";

function makeFakeDb(init: {
  settings?: Record<string, string>;
  confirmedCount?: number;
} = {}) {
  const settingRows = Object.entries(init.settings ?? {}).map(([key, value]) => ({
    key,
    value,
  }));
  return {
    systemSetting: {
      async findMany({ where }: { where: { key: { in: string[] } } }) {
        return settingRows.filter((r) => where.key.in.includes(r.key));
      },
    },
    reservation: {
      async count() {
        return init.confirmedCount ?? 0;
      },
    },
  };
}

describe("computeInquiryTags", () => {
  const userCreatedAt = new Date("2026-01-01T00:00:00Z");

  it("tags big_order when guests reach the big-order threshold", async () => {
    const db = makeFakeDb({
      settings: {
        inquiry_big_order_threshold: "30",
        inquiry_full_booking_threshold: "55",
        inquiry_urgent_days: "7",
        inquiry_vip_confirmed_count: "3",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await computeInquiryTags(db as any, {
      userId: "u",
      userCreatedAt,
      guestCountMax: 35,
      preferredDate: new Date(Date.now() + 30 * 86400_000),
    });
    expect(res.tags).toContain("big_order");
    expect(res.tags).not.toContain("full_booking");
    expect(res.tags).not.toContain("urgent");
    expect(res.priority).toBe("NORMAL");
  });

  it("prefers full_booking over big_order when crossing both thresholds", async () => {
    const db = makeFakeDb({
      settings: {
        inquiry_big_order_threshold: "30",
        inquiry_full_booking_threshold: "55",
        inquiry_urgent_days: "7",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await computeInquiryTags(db as any, {
      userId: "u",
      userCreatedAt,
      guestCountMax: 60,
      preferredDate: new Date(Date.now() + 30 * 86400_000),
    });
    expect(res.tags).toContain("full_booking");
    expect(res.tags).not.toContain("big_order");
  });

  it("flags urgent and bumps priority when date is within N days", async () => {
    const db = makeFakeDb({
      settings: {
        inquiry_big_order_threshold: "30",
        inquiry_full_booking_threshold: "55",
        inquiry_urgent_days: "7",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await computeInquiryTags(db as any, {
      userId: "u",
      userCreatedAt,
      guestCountMax: 10,
      preferredDate: new Date(Date.now() + 2 * 86400_000),
    });
    expect(res.tags).toEqual(["urgent"]);
    expect(res.priority).toBe("URGENT");
  });

  it("adds vip when past-claim confirmed count reaches threshold", async () => {
    const db = makeFakeDb({
      settings: {
        inquiry_big_order_threshold: "30",
        inquiry_full_booking_threshold: "55",
        inquiry_urgent_days: "7",
        inquiry_vip_confirmed_count: "3",
      },
      confirmedCount: 4,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await computeInquiryTags(db as any, {
      userId: "u",
      userCreatedAt,
      guestCountMax: 10,
      preferredDate: new Date(Date.now() + 30 * 86400_000),
    });
    expect(res.tags).toEqual(["vip"]);
  });

  it("falls back to defaults when settings are missing", async () => {
    const db = makeFakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await computeInquiryTags(db as any, {
      userId: "u",
      userCreatedAt,
      guestCountMax: 100,
      preferredDate: new Date(Date.now() + 1 * 86400_000),
    });
    expect(res.tags).toContain("full_booking");
    expect(res.tags).toContain("urgent");
  });
});
