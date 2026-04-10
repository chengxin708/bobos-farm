import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: Record<string, string> = await req.json();

    if (typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Body must be an object of key-value pairs" },
        { status: 400 }
      );
    }

    const operations = Object.entries(body).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    const results = await prisma.$transaction(operations);

    await prisma.activityLog.create({
      data: {
        userId: session.user?.id,
        action: "SETTINGS_UPDATED",
        targetType: "SystemSetting",
        details: { updatedKeys: Object.keys(body) },
      },
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
