import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const depositStatus = searchParams.get("depositStatus");

    const where: Record<string, unknown> = {};
    const validDepositStatuses = ["UNPAID", "PENDING", "CONFIRMED", "REFUNDED"];
    if (depositStatus && validDepositStatuses.includes(depositStatus)) {
      where.depositStatus = depositStatus;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
        yurt: { select: { id: true, name: true, capacity: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Failed to fetch deposits:", error);
    return NextResponse.json(
      { error: "Failed to fetch deposits" },
      { status: 500 }
    );
  }
}
