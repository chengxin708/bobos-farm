import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const orderUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, "At least one item is required"),
  notes: z.string().nullish(),
  draft: z.boolean().optional(),
});

/** Shared include for returning full order details */
const orderIncludeAll = {
  items: {
    include: {
      menuItem: {
        select: {
          id: true,
          nameEn: true,
          nameZh: true,
          price: true,
          imageUrl: true,
        },
      },
    },
  },
  reservation: {
    select: {
      id: true,
      userId: true,
      date: true,
      guestCount: true,
      yurt: { select: { id: true, name: true } },
      user: {
        select: { id: true, name: true, email: true, phone: true, wechatId: true },
      },
    },
  },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                nameEn: true,
                nameZh: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
        reservation: {
          select: {
            userId: true,
            id: true,
            date: true,
            guestCount: true,
            yurt: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Auth check: only order owner or admin
    if (!isAdmin && order.reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Admin gets full reservation info; customer gets stripped response
    if (isAdmin) {
      return NextResponse.json(order);
    }

    const { reservation: _reservation, ...orderData } = order;
    return NextResponse.json(orderData);
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    // ── Admin lock/unlock actions ──────────────────────────────
    if (body.action === "lock" || body.action === "unlock") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (body.action === "lock") {
        if (order.status !== "SUBMITTED") {
          return NextResponse.json(
            { error: "Only submitted orders can be locked" },
            { status: 400 }
          );
        }

        const updated = await prisma.order.update({
          where: { id },
          data: { status: "LOCKED", lockedAt: new Date() },
          include: orderIncludeAll,
        });
        return NextResponse.json(updated);
      }

      if (body.action === "unlock") {
        if (order.status !== "LOCKED") {
          return NextResponse.json(
            { error: "Only locked orders can be unlocked" },
            { status: 400 }
          );
        }

        const updated = await prisma.order.update({
          where: { id },
          data: { status: "SUBMITTED", lockedAt: null },
          include: orderIncludeAll,
        });
        return NextResponse.json(updated);
      }
    }

    // ── Admin bill action ─────────────────────────────────────
    if (body.action === "bill") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              menuItem: { select: { price: true } },
            },
          },
        },
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (order.status !== "SUBMITTED" && order.status !== "LOCKED") {
        return NextResponse.json(
          { error: "Only submitted or locked orders can be billed" },
          { status: 400 }
        );
      }

      const discount = Number(body.discount ?? 0);
      const subtotal = order.items.reduce(
        (sum, item) => sum + item.quantity * item.menuItem.price,
        0
      );
      const finalTotal = Math.max(subtotal - discount, 0);

      const updated = await prisma.order.update({
        where: { id },
        data: {
          status: "BILLED",
          discount,
          finalTotal,
        },
        include: orderIncludeAll,
      });
      return NextResponse.json(updated);
    }

    // ── Admin pay action ──────────────────────────────────────
    if (body.action === "pay") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, status: true, reservationId: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (order.status !== "BILLED") {
        return NextResponse.json(
          { error: "Only billed orders can be marked as paid" },
          { status: 400 }
        );
      }

      if (!body.paymentMethod) {
        return NextResponse.json(
          { error: "paymentMethod is required" },
          { status: 400 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: body.paymentMethod,
          },
          include: orderIncludeAll,
        });

        // Mark reservation as completed
        await tx.reservation.update({
          where: { id: order.reservationId },
          data: { status: "COMPLETED" },
        });

        return updatedOrder;
      });

      return NextResponse.json(updated);
    }

    // ── Admin edit action ─────────────────────────────────────
    if (body.action === "admin-edit") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const adminEditSchema = z.object({
        action: z.literal("admin-edit"),
        items: z
          .array(
            z.object({
              menuItemId: z.string().min(1),
              quantity: z.number().int().min(1),
            })
          )
          .min(1, "At least one item is required"),
        notes: z.string().nullish(),
      });

      const parsed = adminEditSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, status: true, notes: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const editableStatuses = ["SUBMITTED", "LOCKED"];
      if (!editableStatuses.includes(order.status)) {
        return NextResponse.json(
          { error: "Order cannot be edited in its current status" },
          { status: 400 }
        );
      }

      const { items: editItems, notes: editNotes } = parsed.data;

      const menuItemIds = editItems.map((i) => i.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, price: true },
      });

      const priceMap = new Map(menuItems.map((mi) => [mi.id, mi.price]));
      const estimatedTotal = editItems.reduce((sum, item) => {
        const price = priceMap.get(item.menuItemId) || 0;
        return sum + price * item.quantity;
      }, 0);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        return tx.order.update({
          where: { id },
          data: {
            notes: editNotes !== undefined ? (editNotes || null) : order.notes,
            estimatedTotal,
            items: {
              create: editItems.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
              })),
            },
          },
          include: orderIncludeAll,
        });
      });

      return NextResponse.json(updated);
    }

    // ── Customer item update ──────────────────────────────────
    const parsed = orderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { items, notes, draft } = parsed.data;

    // Fetch order with reservation ownership
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        reservation: {
          select: { userId: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Auth check: only order owner or admin
    if (!isAdmin && order.reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only SUBMITTED orders can be modified (not LOCKED)
    if (order.status === "LOCKED") {
      return NextResponse.json(
        { error: "Order is locked and cannot be modified" },
        { status: 400 }
      );
    }

    // Calculate new estimated total
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

    // Transaction: delete old items, create new ones, update order
    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing order items
      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      // Update order and create new items
      return tx.order.update({
        where: { id },
        data: {
          notes: notes !== undefined ? (notes || null) : order.notes,
          estimatedTotal,
          ...(draft
            ? { status: order.status === "DRAFT" ? "DRAFT" : order.status }
            : { status: "SUBMITTED", submittedAt: new Date() }),
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
                select: {
                  id: true,
                  nameEn: true,
                  nameZh: true,
                  price: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
