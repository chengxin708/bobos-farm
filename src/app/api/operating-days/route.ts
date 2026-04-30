import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { OperatingDayMode } from "@prisma/client";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const startStr = searchParams.get("startDate");
  const endStr = searchParams.get("endDate");
  if (!startStr || !ISO_DATE.test(startStr) || !endStr || !ISO_DATE.test(endStr)) {
    return NextResponse.json(
      {
        error: "missing_or_invalid_date_range",
        expected: "startDate=YYYY-MM-DD&endDate=YYYY-MM-DD",
      },
      { status: 400 },
    );
  }
  try {
    const rows = await prisma.operatingDay.findMany({
      where: {
        date: {
          gte: new Date(`${startStr}T00:00:00Z`),
          lte: new Date(`${endStr}T00:00:00Z`),
        },
      },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("Failed to list operating days:", err);
    return NextResponse.json(
      { error: "Failed to list operating days" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  let body: { date?: string; mode?: string; note?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { date, mode, note } = body;
  if (!date || !ISO_DATE.test(date)) {
    return NextResponse.json(
      { error: "missing_or_invalid_date", expected: "YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (!mode || !VALID_MODES.includes(mode as OperatingDayMode)) {
    return NextResponse.json(
      { error: "invalid_mode", expected: VALID_MODES },
      { status: 400 },
    );
  }
  try {
    const row = await prisma.operatingDay.upsert({
      where: { date: new Date(`${date}T00:00:00Z`) },
      create: {
        date: new Date(`${date}T00:00:00Z`),
        mode: mode as OperatingDayMode,
        note: note ?? null,
        createdBy: user.id,
      },
      update: {
        mode: mode as OperatingDayMode,
        note: note ?? undefined,
      },
    });
    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    console.error("Failed to create operating day:", err);
    return NextResponse.json(
      { error: "Failed to create operating day" },
      { status: 500 },
    );
  }
}
