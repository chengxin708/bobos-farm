import { z } from "zod";

export const receiptInputSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  discountCents: z.number().int().min(0).default(0),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1),
});

export type ReceiptInput = z.infer<typeof receiptInputSchema>;
