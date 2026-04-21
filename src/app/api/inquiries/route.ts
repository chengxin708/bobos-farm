import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { computeInquiryTags } from "@/lib/inquiry-tagging";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

const createInquirySchema = z.object({
  preferredDate: z.string().min(1).refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid preferredDate",
  }),
  guestCountMin: z.number().int().positive(),
  guestCountMax: z.number().int().positive(),
  packageHint: z.number().int().positive().nullish(),
  note: z.string().max(4000).nullish(),
}).refine((d) => d.guestCountMax >= d.guestCountMin, {
  message: "guestCountMax must be >= guestCountMin",
  path: ["guestCountMax"],
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const tag = searchParams.get("tag");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (tag) where.tags = { has: tag };

  const inquiries = await prisma.inquiry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
      assignedAdmin: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(inquiries);
}

export async function POST(req: NextRequest) {
  try {
    // Auth + role check FIRST. Admins shouldn't be submitting inquiries,
    // and rejecting via 429 before 403 would let a rate-limited admin
    // see the wrong error code.
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, createdAt: true, role: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Admins cannot submit inquiries" }, { status: 403 });
    }

    // Rate limit AFTER auth so admins / unauthenticated users don't
    // pollute the customer bucket.
    const rl = rateLimit(`inquiry:${ipFromRequest(req)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many inquiries", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const body = await req.json();
    const parsed = createInquirySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { preferredDate, guestCountMin, guestCountMax, packageHint, note } = parsed.data;

    const date = new Date(preferredDate);
    const { tags, priority } = await computeInquiryTags(prisma, {
      userId: user.id,
      userCreatedAt: user.createdAt,
      guestCountMax,
      preferredDate: date,
    });

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: user.id,
        preferredDate: date,
        guestCountMin,
        guestCountMax,
        packageHint: packageHint ?? null,
        note: note ?? null,
        priority,
        tags,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "INQUIRY_SUBMITTED",
        targetType: "Inquiry",
        targetId: inquiry.id,
        details: { guestCountMin, guestCountMax, priority, tags },
      },
    });

    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create inquiry:", error);
    return NextResponse.json(
      { error: "Failed to create inquiry" },
      { status: 500 },
    );
  }
}
