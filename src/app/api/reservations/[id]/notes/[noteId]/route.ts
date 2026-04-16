import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateNoteSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, noteId } = await params;
    const body = await req.json();
    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const result = await prisma.reservationNote.updateMany({
      where: { id: noteId, reservationId: id },
      data: parsed.data,
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const note = await prisma.reservationNote.findUnique({
      where: { id: noteId },
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error("Failed to update reservation note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, noteId } = await params;
    const result = await prisma.reservationNote.deleteMany({
      where: { id: noteId, reservationId: id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reservation note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
