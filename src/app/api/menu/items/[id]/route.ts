import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { menuItemSchema } from "@/lib/validations/menu";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch menu item:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu item" },
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
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = menuItemSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.menuItem.update({
      where: { id },
      data: parsed.data,
      include: { category: true },
    });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update menu item:", error);
    return NextResponse.json(
      { error: "Failed to update menu item" },
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
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 }
      );
    }

    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete menu item:", error);
    return NextResponse.json(
      { error: "Failed to delete menu item" },
      { status: 500 }
    );
  }
}
