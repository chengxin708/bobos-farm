import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const DEFAULT_PAYMENT_METHODS = ["Zelle", "Cash"];
const SETTING_KEY = "paymentMethods";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!setting) {
      return NextResponse.json(DEFAULT_PAYMENT_METHODS);
    }

    try {
      const methods = JSON.parse(setting.value);
      return NextResponse.json(Array.isArray(methods) ? methods : DEFAULT_PAYMENT_METHODS);
    } catch {
      return NextResponse.json(DEFAULT_PAYMENT_METHODS);
    }
  } catch (error) {
    console.error("Failed to fetch payment methods:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}

const paymentMethodsSchema = z
  .array(z.string().min(1).max(50))
  .min(1, "At least one payment method is required")
  .max(20);

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = paymentMethodsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(parsed.data) },
      create: {
        key: SETTING_KEY,
        value: JSON.stringify(parsed.data),
        description: "Available payment methods for order checkout",
      },
    });

    return NextResponse.json(JSON.parse(setting.value));
  } catch (error) {
    console.error("Failed to update payment methods:", error);
    return NextResponse.json(
      { error: "Failed to update payment methods" },
      { status: 500 }
    );
  }
}
