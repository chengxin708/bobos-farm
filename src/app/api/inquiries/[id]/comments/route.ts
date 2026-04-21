import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment is required").max(4000),
  type: z.enum([
    "INTERNAL_NOTE",
    "PHONE_LOG",
    "EMAIL_LOG",
    "WECHAT_LOG",
    "SYSTEM",
  ]),
});

export async function POST(
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
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await prisma.inquiryComment.create({
    data: {
      inquiryId: id,
      authorId: session.user.id,
      content: parsed.data.content,
      type: parsed.data.type,
    },
    include: { author: { select: { id: true, name: true, email: true, role: true } } },
  });

  // First admin touch moves PENDING → IN_PROGRESS and stamps
  // firstContactedAt for response-time metrics.
  if (inquiry.status === "PENDING" && parsed.data.type !== "INTERNAL_NOTE") {
    await prisma.inquiry.update({
      where: { id },
      data: { status: "IN_PROGRESS", firstContactedAt: new Date() },
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
