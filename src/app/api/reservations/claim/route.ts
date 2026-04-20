import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { claimReservation } from "@/lib/claim-flow";

const claimBodySchema = z.object({
  code: z.string().min(1, "Confirmation code is required"),
  token: z.string().min(1).optional(),
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

    const role = (session.user as { role?: string }).role;
    const result = await claimReservation(prisma, {
      userId: session.user.id,
      isAdmin: role === "ADMIN",
      code: parsed.data.code,
      token: parsed.data.token ?? null,
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOT_FOUND":
          return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        case "ADMIN_CANNOT_CLAIM":
          return NextResponse.json(
            { error: "Admin accounts cannot claim customer reservations", reason: "admin_cannot_claim" },
            { status: 403 }
          );
        case "ALREADY_CLAIMED":
          return NextResponse.json(
            { error: "This reservation has already been claimed by another account" },
            { status: 409 }
          );
        case "STATUS_NOT_CLAIMABLE":
          return NextResponse.json(
            { error: "This reservation is no longer claimable", reason: "not_claimable" },
            { status: 403 }
          );
        case "INVALID_TOKEN":
          return NextResponse.json(
            { error: "This claim link is invalid or has expired", reason: "invalid_token" },
            { status: 403 }
          );
        case "AMBIGUOUS":
          return NextResponse.json(
            { error: "A claim link is required for this reservation", reason: "token_required" },
            { status: 403 }
          );
      }
    }

    return NextResponse.json({
      success: true,
      alreadyOwned: result.alreadyOwned,
      mergedReservationIds: result.mergedReservationIds,
      reservation: {
        id: result.reservation.id,
        confirmationCode: result.reservation.confirmationCode,
        date: result.reservation.date,
        guestCount: result.reservation.guestCount,
        yurtName: result.reservation.yurtName,
        status: result.reservation.status,
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
