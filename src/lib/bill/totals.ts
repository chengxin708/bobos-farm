export interface ReceiptItemInput {
  priceCents: number;
  quantity: number;
}

export interface ComputedTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export function computeTotals(
  items: ReceiptItemInput[],
  discountCents: number,
  taxRate: number,
): ComputedTotals {
  const subtotalCents = items.reduce(
    (acc, i) => acc + i.priceCents * i.quantity,
    0,
  );
  const clampedDiscount = Math.max(0, Math.min(discountCents, subtotalCents));
  const taxableCents = subtotalCents - clampedDiscount;
  const taxCents = Math.round(taxableCents * taxRate);
  const totalCents = taxableCents + taxCents;
  return { subtotalCents, discountCents: clampedDiscount, taxCents, totalCents };
}

export function dollarsToCents(input: string): number {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToDollarString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}
