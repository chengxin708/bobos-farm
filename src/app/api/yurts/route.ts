import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const yurtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  capacity: z.number().int().positive("Capacity must be a positive integer"),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).default("ACTIVE"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  try {
    const yurts = await prisma.yurt.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(yurts);
  } catch (error) {
    console.error("Failed to fetch yurts:", error);
    return NextResponse.json(
      { error: "Failed to fetch yurts" },
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
    const parsed = yurtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const yurt = await prisma.yurt.create({ data: parsed.data });
    return NextResponse.json(yurt, { status: 201 });
  } catch (error) {
    console.error("Failed to create yurt:", error);
    return NextResponse.json(
      { error: "Failed to create yurt" },
      { status: 500 }
    );
  }
}
