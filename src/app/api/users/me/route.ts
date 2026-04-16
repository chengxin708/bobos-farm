import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { recordContactEntry } from "@/lib/contact-history";

const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().min(1, "Phone number is required").optional(),
  preferredLanguage: z.enum(["EN", "ZH"]).optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        preferredLanguage: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        preferredLanguage: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Track phone changes (self-edit on settings page).
    if (parsed.data.phone) {
      await recordContactEntry(prisma, {
        userId: user.id,
        type: "phone",
        value: parsed.data.phone,
        source: "self",
        recordedById: user.id,
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update user profile:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}
