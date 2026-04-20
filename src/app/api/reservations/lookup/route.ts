import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLACEHOLDER_EMAIL_SUFFIX } from "@/lib/claim-flow";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();
    const token = searchParams.get("t")?.trim() || null;

    if (!code || code.length < 1) {
      return NextResponse.json(
        { error: "Confirmation code is required" },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { confirmationCode: code },
      include: {
        user: { select: { id: true, name: true, email: true } },
        yurt: { select: { id: true, name: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // If a token was provided, it must be a currently active token
    // scoped to *this* reservation. Wrong/expired tokens behave like a
    // 404 so attackers can't distinguish "token invalid" from
    // "reservation doesn't exist."
    if (token) {
      const now = new Date();
      const match = await prisma.reservationClaimToken.findFirst({
        where: {
          token,
          reservationId: reservation.id,
          consumedAt: null,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true },
      });
      if (!match) {
        return NextResponse.json(
          { error: "Reservation not found" },
          { status: 404 }
        );
      }
    }

    const isPlaceholder = reservation.user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX);

    return NextResponse.json({
      confirmationCode: reservation.confirmationCode,
      date: reservation.date,
      guestCount: reservation.guestCount,
      yurtName: reservation.yurt?.name ?? null,
      status: reservation.status,
      guestName: reservation.user.name ?? null,
      claimed: !isPlaceholder,
      userId: reservation.userId,
    });
  } catch (error) {
    console.error("Failed to lookup reservation:", error);
    return NextResponse.json(
      { error: "Failed to lookup reservation" },
      { status: 500 }
    );
  }
}
