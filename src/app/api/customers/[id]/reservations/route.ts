import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const reservations = await prisma.reservation.findMany({
      where: { userId: id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        yurt: { select: { id: true, name: true, alias: true, capacity: true } },
        order: { select: { id: true, status: true, estimatedTotal: true, finalTotal: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ user, reservations });
  } catch (error) {
    console.error("Failed to fetch customer reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer reservations" },
      { status: 500 }
    );
  }
}
