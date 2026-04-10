import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const availabilitySchema = z.object({
  yurtId: z.string().min(1, "Yurt ID is required"),
  date: z.string().min(1, "Date is required"),
  isOpen: z.boolean(),
  note: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const yurtId = searchParams.get("yurtId");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (yurtId) where.yurtId = yurtId;

    const availability = await prisma.yurtAvailability.findMany({
      where,
      include: { yurt: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { yurtId: "asc" }],
    });

    return NextResponse.json(availability);
  } catch (error) {
    console.error("Failed to fetch availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = availabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { yurtId, date, isOpen, note } = parsed.data;
    const dateObj = new Date(date);

    // Verify yurt exists
    const yurt = await prisma.yurt.findUnique({ where: { id: yurtId } });
    if (!yurt) {
      return NextResponse.json({ error: "Yurt not found" }, { status: 404 });
    }

    // Upsert availability
    const availability = await prisma.yurtAvailability.upsert({
      where: { yurtId_date: { yurtId, date: dateObj } },
      update: { isOpen, note },
      create: { yurtId, date: dateObj, isOpen, note },
    });

    return NextResponse.json(availability, { status: 201 });
  } catch (error) {
    console.error("Failed to set availability:", error);
    return NextResponse.json(
      { error: "Failed to set availability" },
      { status: 500 }
    );
  }
}
