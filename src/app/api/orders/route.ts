import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const orderCreateSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = orderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { reservationId, items, notes } = parsed.data;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, userId: true, status: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Reservation does not belong to you" },
        { status: 403 }
      );
    }

    if (reservation.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Reservation must be confirmed to place an order" },
        { status: 400 }
      );
    }

    // Calculate estimated total
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, price: true },
    });

    const priceMap = new Map(menuItems.map((mi) => [mi.id, mi.price]));
    const estimatedTotal = items.reduce((sum, item) => {
      const price = priceMap.get(item.menuItemId) || 0;
      return sum + price * item.quantity;
    }, 0);

    const order = await prisma.order.create({
      data: {
        reservationId,
        notes,
        estimatedTotal,
        status: "SUBMITTED",
        submittedAt: new Date(),
        items: {
          create: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            menuItem: {
              select: { id: true, nameEn: true, nameZh: true, price: true },
            },
          },
        },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
