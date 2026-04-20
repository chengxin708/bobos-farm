import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { createClaimToken, getActiveClaimToken } from "@/lib/claim-token";

async function requireAdminForReservation(reservationId: string) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) } as const;
  }
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true },
  });
  if (!reservation) {
    return { error: NextResponse.json({ error: "Reservation not found" }, { status: 404 }) } as const;
  }
  return { session, reservationId: reservation.id } as const;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requireAdminForReservation(id);
  if ("error" in guard) return guard.error;

  const token = await getActiveClaimToken(prisma, guard.reservationId);
  return NextResponse.json({ token: token?.token ?? null, expiresAt: token?.expiresAt ?? null });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requireAdminForReservation(id);
  if ("error" in guard) return guard.error;

  const session = guard.session;
  const fresh = await createClaimToken(prisma, guard.reservationId);

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "CLAIM_TOKEN_ISSUED",
      targetType: "Reservation",
      targetId: guard.reservationId,
      details: { tokenId: fresh.id },
    },
  });

  return NextResponse.json(
    { token: fresh.token, expiresAt: fresh.expiresAt },
    { status: 201 },
  );
}
