import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { OperatingDayMode } from "@prisma/client";

const VALID_MODES: OperatingDayMode[] = ["OPEN", "PRIVATE_EVENT", "CLOSED"];

type AdminUser = { id: string; role?: string };

async function requireAdmin(): Promise<
  | { ok: true; user: AdminUser }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin only" }, { status: 403 }),
    };
  }
  return { ok: true, user: session.user as AdminUser };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id } = await params;

  let body: { mode?: string; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const updateData: { mode?: OperatingDayMode; note?: string | null } = {};
  if (body.mode !== undefined) {
    if (!VALID_MODES.includes(body.mode as OperatingDayMode)) {
      return NextResponse.json(
        { error: "invalid_mode", expected: VALID_MODES },
        { status: 400 },
      );
    }
    updateData.mode = body.mode as OperatingDayMode;
  }
  if (body.note !== undefined) updateData.note = body.note;
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  try {
    const row = await prisma.$transaction(async (tx) => {
      const existing = await tx.operatingDay.findUnique({
        where: { id },
        select: { mode: true, note: true },
      });
      if (!existing) return null;
      const updated = await tx.operatingDay.update({
        where: { id },
        data: updateData,
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "OPERATING_DAY_PATCHED",
          targetType: "OperatingDay",
          targetId: id,
          details: {
            id,
            changes: updateData,
            previous: { mode: existing.mode, note: existing.note },
          },
        },
      });
      return updated;
    });
    if (!row) {
      return NextResponse.json(
        { error: "operating_day_not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json(row);
  } catch (err) {
    console.error("Failed to patch operating day:", err);
    return NextResponse.json(
      { error: "Failed to patch operating day" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const user = guard.user;
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.operatingDay.findUnique({
        where: { id },
        select: { id: true, date: true, mode: true },
      });
      if (!existing) return null;
      await tx.operatingDay.delete({ where: { id } });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "OPERATING_DAY_DELETED",
          targetType: "OperatingDay",
          targetId: id,
          details: {
            id: existing.id,
            date: existing.date.toISOString(),
            mode: existing.mode,
          },
        },
      });
      return existing;
    });
    if (!result) {
      return NextResponse.json(
        { error: "operating_day_not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete operating day:", err);
    return NextResponse.json(
      { error: "Failed to delete operating day" },
      { status: 500 },
    );
  }
}
