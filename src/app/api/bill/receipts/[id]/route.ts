import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/bill/totals";
import { receiptInputSchema } from "@/lib/bill/validations";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.quickReceipt.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(r);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.quickReceipt.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = receiptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const menuIds = input.items.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, nameEn: true, nameZh: true, price: true },
  });
  const byId = new Map(menuItems.map(m => [m.id, m]));
  if (byId.size !== new Set(menuIds).size) {
    return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
  }

  const itemRows = input.items.map((i, idx) => {
    const m = byId.get(i.menuItemId)!;
    return {
      menuItemId: m.id,
      nameEnSnap: m.nameEn,
      nameZhSnap: m.nameZh,
      priceCents: Math.round(m.price * 100),
      quantity: i.quantity,
      sortOrder: idx,
    };
  });
  const totals = computeTotals(itemRows, input.discountCents, existing.taxRate);

  const updated = await prisma.$transaction(async tx => {
    await tx.quickReceiptItem.deleteMany({ where: { receiptId: id } });
    return tx.quickReceipt.update({
      where: { id },
      data: {
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        notes: input.notes ?? null,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        items: { create: itemRows },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.quickReceipt.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
