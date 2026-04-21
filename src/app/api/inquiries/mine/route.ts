import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const inquiries = await prisma.inquiry.findMany({
    where: { userId: session.user.id },
    include: {
      reservation: { select: { id: true, confirmationCode: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(inquiries);
}
