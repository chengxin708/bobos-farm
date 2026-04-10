import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const noteSchema = z.object({
  note: z.string().max(2000),
});

function settingKey(customerId: string) {
  return `customer_note_${customerId}`;
}

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
    const key = settingKey(id);

    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });

    return NextResponse.json({ note: setting?.value ?? "" });
  } catch (error) {
    console.error("Failed to fetch customer note:", error);
    return NextResponse.json(
      { error: "Failed to fetch note" },
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
    const body = await req.json();
    const parsed = noteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const key = settingKey(id);

    // If note is empty, delete the setting; otherwise upsert
    if (parsed.data.note.trim() === "") {
      await prisma.systemSetting.deleteMany({ where: { key } });
      return NextResponse.json({ note: "" });
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: parsed.data.note },
      create: {
        key,
        value: parsed.data.note,
        description: `Admin note for customer ${id}`,
      },
    });

    return NextResponse.json({ note: setting.value });
  } catch (error) {
    console.error("Failed to save customer note:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}
