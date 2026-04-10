import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const bulkAvailabilitySchema = z.object({
  yurtId: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isOpen: z.boolean(),
  note: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bulkAvailabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { yurtId, startDate, endDate, isOpen, note } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return NextResponse.json(
        { error: "startDate must be before or equal to endDate" },
        { status: 400 }
      );
    }

    // Limit date range to 90 days to prevent DoS via excessive DB operations
    const MAX_RANGE_DAYS = 90;
    const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
        { status: 400 }
      );
    }

    // Get target yurts
    let yurtIds: string[];
    if (yurtId) {
      const yurt = await prisma.yurt.findUnique({ where: { id: yurtId } });
      if (!yurt) {
        return NextResponse.json(
          { error: "Yurt not found" },
          { status: 404 }
        );
      }
      yurtIds = [yurtId];
    } else {
      const yurts = await prisma.yurt.findMany({ select: { id: true } });
      yurtIds = yurts.map((y) => y.id);
    }

    // Generate all dates in range
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Upsert availability for each yurt and date combination
    const operations = [];
    for (const targetYurtId of yurtIds) {
      for (const date of dates) {
        operations.push(
          prisma.yurtAvailability.upsert({
            where: { yurtId_date: { yurtId: targetYurtId, date } },
            update: { isOpen, note },
            create: { yurtId: targetYurtId, date, isOpen, note },
          })
        );
      }
    }

    const results = await prisma.$transaction(operations);

    return NextResponse.json(
      {
        success: true,
        count: results.length,
        message: `Updated availability for ${yurtIds.length} yurt(s) across ${dates.length} date(s)`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to bulk set availability:", error);
    return NextResponse.json(
      { error: "Failed to bulk set availability" },
      { status: 500 }
    );
  }
}
