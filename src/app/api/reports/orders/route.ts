import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

// GET /api/reports/orders — Admin only: order analytics data
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Top ordered items ────────────────────────────────────────
    const topItemsRaw = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    const menuItemIds = topItemsRaw.map((r) => r.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, nameEn: true, nameZh: true, price: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    const topItems = topItemsRaw.map((r) => {
      const mi = menuMap.get(r.menuItemId);
      const totalQuantity = r._sum.quantity ?? 0;
      return {
        nameEn: mi?.nameEn ?? "Unknown",
        nameZh: mi?.nameZh ?? null,
        totalQuantity,
        totalRevenue: totalQuantity * (mi?.price ?? 0),
      };
    });

    // ── Order stats ──────────────────────────────────────────────
    const [totalOrders, submittedOrders, lockedOrders, revenueAgg] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: "SUBMITTED" } }),
        prisma.order.count({ where: { status: "LOCKED" } }),
        prisma.order.aggregate({
          _sum: { estimatedTotal: true },
        }),
      ]);

    const stats = {
      totalOrders,
      submittedOrders,
      lockedOrders,
      totalRevenue: revenueAgg._sum.estimatedTotal ?? 0,
    };

    // ── Monthly orders (last 6 months) ───────────────────────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentOrders = await prisma.order.findMany({
      where: {
        submittedAt: { gte: sixMonthsAgo },
      },
      select: {
        submittedAt: true,
        estimatedTotal: true,
      },
    });

    const monthMap = new Map<
      string,
      { count: number; revenue: number }
    >();
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthMap.set(key, { count: 0, revenue: 0 });
    }

    recentOrders.forEach((o) => {
      if (!o.submittedAt) return;
      const d = new Date(o.submittedAt);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const existing = monthMap.get(key);
      if (existing) {
        existing.count++;
        existing.revenue += o.estimatedTotal ?? 0;
      }
    });

    const monthlyOrders = Array.from(monthMap.entries()).map(
      ([month, data]) => ({
        month,
        count: data.count,
        revenue: Math.round(data.revenue * 100) / 100,
      })
    );

    // ── Category breakdown ───────────────────────────────────────
    const categoryData = await prisma.orderItem.findMany({
      select: {
        quantity: true,
        menuItem: {
          select: {
            price: true,
            category: {
              select: { nameEn: true },
            },
          },
        },
      },
    });

    const catMap = new Map<
      string,
      { itemCount: number; revenue: number }
    >();
    categoryData.forEach((oi) => {
      const cat = oi.menuItem.category.nameEn;
      const existing = catMap.get(cat) || { itemCount: 0, revenue: 0 };
      existing.itemCount += oi.quantity;
      existing.revenue += oi.quantity * oi.menuItem.price;
      catMap.set(cat, existing);
    });

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, data]) => ({
        category,
        itemCount: data.itemCount,
        revenue: Math.round(data.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      topItems,
      stats,
      monthlyOrders,
      categoryBreakdown,
    });
  } catch (error) {
    console.error("Failed to fetch order reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch order reports" },
      { status: 500 }
    );
  }
}
