import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum([
    "PENDING",
    "IN_PROGRESS",
    "AWAITING_CUSTOMER",
    "CONVERTED",
    "CLOSED",
    "EXPIRED",
  ]).optional(),
  assignedAdminId: z.string().nullable().optional(),
  closedReason: z.string().max(1000).nullable().optional(),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]).optional(),
  tags: z.array(z.string()).optional(),
});

async function loadInquiryForViewer(id: string, userId: string, isAdmin: boolean) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
      assignedAdmin: { select: { id: true, name: true, email: true } },
      reservation: { select: { id: true, confirmationCode: true, status: true, date: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });
  if (!inquiry) return { notFound: true as const };
  if (!isAdmin && inquiry.userId !== userId) return { forbidden: true as const };
  return { inquiry } as const;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const loaded = await loadInquiryForViewer(id, session.user.id, isAdmin);
  if ("notFound" in loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ("forbidden" in loaded) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(loaded.inquiry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const before = await prisma.inquiry.findUnique({ where: { id }, select: { status: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = { ...parsed.data };
  const now = new Date();
  if (parsed.data.status === "IN_PROGRESS" && before.status === "PENDING") {
    data.firstContactedAt = now;
  }
  if (parsed.data.status === "CLOSED") data.closedAt = now;

  const updated = await prisma.inquiry.update({ where: { id }, data });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "INQUIRY_UPDATED",
      targetType: "Inquiry",
      targetId: id,
      details: JSON.parse(JSON.stringify(parsed.data)),
    },
  });

  return NextResponse.json(updated);
}
