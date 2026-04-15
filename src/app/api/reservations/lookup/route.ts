import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();

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

    const isPlaceholder = reservation.user.email.endsWith("@placeholder.local");

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
