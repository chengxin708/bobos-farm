import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { menuItemSchema } from "@/lib/validations/menu";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const activeOnly = searchParams.get("activeOnly");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (activeOnly === "true") where.isActive = true;

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
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
    const parsed = menuItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await prisma.menuCategory.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const item = await prisma.menuItem.create({
      data: parsed.data,
      include: { category: true },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Failed to create menu item:", error);
    return NextResponse.json(
      { error: "Failed to create menu item" },
      { status: 500 }
    );
  }
}
