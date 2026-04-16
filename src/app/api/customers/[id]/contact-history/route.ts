import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

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

    const [user, entries] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, phone: true, wechatId: true },
      }),
      prisma.userContactEntry.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve recordedBy names in one query (admin who recorded the entry).
    const recordedByIds = Array.from(
      new Set(entries.map((e) => e.recordedById).filter((x): x is string => x !== null))
    );
    const actors = recordedByIds.length
      ? await prisma.user.findMany({
          where: { id: { in: recordedByIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    type Enriched = (typeof entries)[number] & {
      recordedBy?: { id: string; name: string | null; email: string; role: string } | null;
      isPrimary: boolean;
    };

    const isPlaceholder = (v: string) => v.toLowerCase().endsWith("@placeholder.local");

    const enrich = (e: (typeof entries)[number], primaryValue: string | null): Enriched => ({
      ...e,
      recordedBy: e.recordedById ? actorMap.get(e.recordedById) ?? null : null,
      isPrimary: primaryValue !== null && primaryValue.toLowerCase() === e.value.toLowerCase(),
    });

    const phoneEntries = entries.filter((e) => e.type === "phone").map((e) => enrich(e, user.phone));
    const wechatEntries = entries.filter((e) => e.type === "wechat").map((e) => enrich(e, user.wechatId));
    // For email: if current user.email is placeholder, treat primary as null.
    const primaryEmail = isPlaceholder(user.email) ? null : user.email;
    const emailEntries = entries.filter((e) => e.type === "email").map((e) => enrich(e, primaryEmail));

    return NextResponse.json({
      primary: {
        email: primaryEmail,
        phone: user.phone,
        wechat: user.wechatId,
      },
      history: {
        email: emailEntries,
        phone: phoneEntries,
        wechat: wechatEntries,
      },
    });
  } catch (error) {
    console.error("Failed to fetch contact history:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact history" },
      { status: 500 }
    );
  }
}
