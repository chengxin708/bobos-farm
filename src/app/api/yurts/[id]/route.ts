import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const yurtUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const yurt = await prisma.yurt.findUnique({
      where: { id },
    });

    if (!yurt) {
      return NextResponse.json({ error: "Yurt not found" }, { status: 404 });
    }

    // Get availability for the next 3 months
    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const availability = await prisma.yurtAvailability.findMany({
      where: {
        yurtId: id,
        date: {
          gte: now,
          lte: threeMonthsLater,
        },
      },
      orderBy: { date: "asc" },
    });

    // Get existing reservations for the next 3 months
    // Only return dates (not statuses) for unauthenticated/customer users to prevent info leaks
    const reservations = await prisma.reservation.findMany({
      where: {
        yurtId: id,
        date: {
          gte: now,
          lte: threeMonthsLater,
        },
        status: {
          notIn: ["CANCELLED", "EXPIRED"],
        },
      },
      select: { date: true },
      orderBy: { date: "asc" },
    });

    // Only return booked dates, not status details
    const bookedDates = reservations.map((r) => r.date);

    return NextResponse.json({
      ...yurt,
      availability,
      bookedDates,
    });
  } catch (error) {
    console.error("Failed to fetch yurt:", error);
    return NextResponse.json(
      { error: "Failed to fetch yurt" },
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
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.yurt.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Yurt not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = yurtUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const yurt = await prisma.yurt.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(yurt);
  } catch (error) {
    console.error("Failed to update yurt:", error);
    return NextResponse.json(
      { error: "Failed to update yurt" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.yurt.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Yurt not found" }, { status: 404 });
    }

    // Check for active reservations
    const activeReservations = await prisma.reservation.count({
      where: {
        yurtId: id,
        status: { notIn: ["CANCELLED", "EXPIRED"] },
      },
    });

    if (activeReservations > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete yurt with ${activeReservations} active reservation(s). Cancel or complete them first.`,
        },
        { status: 400 }
      );
    }

    // Delete related availability entries first
    await prisma.yurtAvailability.deleteMany({ where: { yurtId: id } });

    // Delete the yurt
    await prisma.yurt.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete yurt:", error);
    return NextResponse.json(
      { error: "Failed to delete yurt" },
      { status: 500 }
    );
  }
}
