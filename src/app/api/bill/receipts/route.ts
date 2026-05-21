import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/bill/totals";
import { generateReceiptToken } from "@/lib/bill/token";
import { receiptInputSchema } from "@/lib/bill/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const rawLimit = Number(searchParams.get("limit") ?? 50);
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50), 100);

  const rows = await prisma.quickReceipt.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      customerName: true,
      customerPhone: true,
      totalCents: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const nextCursor = rows.length > limit ? rows[limit].id : null;
  return NextResponse.json({ items: rows.slice(0, limit), nextCursor });
}

export async function POST(req: NextRequest) {
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

  // Look up tax_rate setting.
  const taxSetting = await prisma.systemSetting.findUnique({ where: { key: "tax_rate" } });
  const taxRate = taxSetting ? Number(taxSetting.value) : 0.08;

  // Fetch menu items being referenced.
  const menuIds = input.items.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, nameEn: true, nameZh: true, price: true },
  });
  const byId = new Map(menuItems.map(m => [m.id, m]));
  if (byId.size !== new Set(menuIds).size) {
    return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
  }

  // Build snapshot rows.
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

  const totals = computeTotals(itemRows, input.discountCents, taxRate);

  const created = await prisma.quickReceipt.create({
    data: {
      token: generateReceiptToken(),
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      notes: input.notes ?? null,
      taxRate,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      items: { create: itemRows },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(created, { status: 201 });
}
