import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { sendDepositConfirmed } from "@/lib/email";

const depositActionSchema = z.object({
  action: z.enum(["confirm", "release", "refund"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = depositActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    if (action === "confirm") {
      if (reservation.depositStatus !== "PENDING") {
        return NextResponse.json(
          { error: "Deposit is not in PENDING status" },
          { status: 400 }
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          depositStatus: "CONFIRMED",
          depositConfirmedAt: new Date(),
          status: "CONFIRMED",
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: session.user?.id,
          action: "DEPOSIT_CONFIRMED",
          targetType: "Reservation",
          targetId: id,
          details: { depositAmount: reservation.depositAmount },
        },
      });

      // Fire-and-forget: send deposit confirmed email to customer
      if (updated.user.email) {
        void sendDepositConfirmed(updated.user.email, {
          date: updated.date,
          yurtName: updated.yurt?.name ?? "Pending",
          guestCount: updated.guestCount,
          reservationId: updated.id,
        });
      }

      return NextResponse.json(updated);
    }

    if (action === "release") {
      if (reservation.depositStatus !== "CONFIRMED") {
        return NextResponse.json(
          { error: "Deposit is not in CONFIRMED status" },
          { status: 400 }
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          depositStatus: "REFUNDED",
          status: "COMPLETED",
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: session.user?.id,
          action: "DEPOSIT_RELEASED",
          targetType: "Reservation",
          targetId: id,
          details: { depositAmount: reservation.depositAmount },
        },
      });

      return NextResponse.json(updated);
    }

    if (action === "refund") {
      if (
        reservation.depositStatus !== "CONFIRMED" &&
        reservation.depositStatus !== "PENDING"
      ) {
        return NextResponse.json(
          { error: "Deposit cannot be refunded from current status" },
          { status: 400 }
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          depositStatus: "REFUNDED",
          refundEligible: true,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: session.user?.id,
          action: "DEPOSIT_REFUNDED",
          targetType: "Reservation",
          targetId: id,
          details: { depositAmount: reservation.depositAmount },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update deposit:", error);
    return NextResponse.json(
      { error: "Failed to update deposit" },
      { status: 500 }
    );
  }
}
