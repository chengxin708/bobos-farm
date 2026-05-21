import { receiptInputSchema } from "../validations";

describe("receiptInputSchema", () => {
  it("accepts a well-formed payload", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      customerPhone: "+15551234567",
      notes: "table 3",
      discountCents: 500,
      items: [{ menuItemId: "abc", quantity: 2 }],
    });
    expect(r.success).toBe(true);
  });

  it("requires customerName", () => {
    const r = receiptInputSchema.safeParse({
      discountCents: 0,
      items: [{ menuItemId: "abc", quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one item", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      discountCents: 0,
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-positive quantity", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      discountCents: 0,
      items: [{ menuItemId: "abc", quantity: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative discount", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      discountCents: -1,
      items: [{ menuItemId: "abc", quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });
});
