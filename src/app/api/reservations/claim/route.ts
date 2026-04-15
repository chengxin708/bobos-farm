import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const claimBodySchema = z.object({
  code: z.string().min(1, "Confirmation code is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = claimBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const code = parsed.data.code.trim().toUpperCase();

    const reservation = await prisma.reservation.findUnique({
      where: { confirmationCode: code },
      include: {
        user: { select: { id: true, email: true, name: true } },
        yurt: { select: { id: true, name: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Already belongs to the current user
    if (reservation.userId === session.user.id) {
      return NextResponse.json({
        success: true,
        alreadyOwned: true,
        reservation: {
          confirmationCode: reservation.confirmationCode,
          date: reservation.date,
          guestCount: reservation.guestCount,
          yurtName: reservation.yurt?.name ?? null,
          status: reservation.status,
        },
      });
    }

    const isPlaceholder = reservation.user.email.endsWith("@placeholder.local");

    // Already claimed by another real user
    if (!isPlaceholder) {
      return NextResponse.json(
        { error: "This reservation has already been claimed by another account" },
        { status: 409 }
      );
    }

    // Transfer reservation to current user
    const oldUserId = reservation.userId;

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { userId: session.user.id },
      include: {
        yurt: { select: { id: true, name: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "RESERVATION_CLAIMED",
        targetType: "Reservation",
        targetId: reservation.id,
        details: {
          confirmationCode: code,
          previousUserId: oldUserId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      alreadyOwned: false,
      reservation: {
        confirmationCode: updated.confirmationCode,
        date: updated.date,
        guestCount: updated.guestCount,
        yurtName: updated.yurt?.name ?? null,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Failed to claim reservation:", error);
    return NextResponse.json(
      { error: "Failed to claim reservation" },
      { status: 500 }
    );
  }
}
