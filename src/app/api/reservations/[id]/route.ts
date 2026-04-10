import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        yurt: true,
        order: { include: { items: { include: { menuItem: true } } } },
        rescheduleHistory: { orderBy: { rescheduledAt: "desc" } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only view their own reservations
    if (!isAdmin && reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("Failed to fetch reservation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { yurt: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Non-admin users can only modify their own reservations
    if (!isAdmin && reservation.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // ---------- CANCEL ----------
    if (action === "cancel") {
      if (
        reservation.status === "CANCELLED" ||
        reservation.status === "EXPIRED"
      ) {
        return NextResponse.json(
          { error: "Reservation is already cancelled or expired" },
          { status: 400 }
        );
      }

      // Check refund eligibility: 3+ days before reservation date
      const now = new Date();
      const reservationDate = new Date(reservation.date);
      const diffMs = reservationDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const refundEligible = diffDays >= 3;

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelReason: body.reason || null,
          refundEligible,
          depositStatus:
            refundEligible && reservation.depositStatus === "CONFIRMED"
              ? "REFUNDED"
              : reservation.depositStatus,
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
          userId: session.user.id,
          action: "RESERVATION_CANCELLED",
          targetType: "Reservation",
          targetId: id,
          details: {
            reason: body.reason,
            refundEligible,
            date: reservation.date,
          },
        },
      });

      return NextResponse.json(updated);
    }

    // ---------- SUBMIT PAYMENT ----------
    if (action === "submit_payment") {
      if (reservation.status !== "PENDING_PAYMENT") {
        return NextResponse.json(
          { error: "Reservation is not pending payment" },
          { status: 400 }
        );
      }

      // Check if payment deadline has passed
      if (
        reservation.paymentDeadline &&
        new Date() > reservation.paymentDeadline
      ) {
        return NextResponse.json(
          { error: "Payment deadline has passed" },
          { status: 400 }
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          status: "PAYMENT_SUBMITTED",
          depositStatus: "PENDING",
          paymentScreenshotUrl: body.paymentScreenshotUrl || null,
          paymentReference: body.paymentReference || null,
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
          userId: session.user.id,
          action: "PAYMENT_SUBMITTED",
          targetType: "Reservation",
          targetId: id,
          details: {
            depositAmount: reservation.depositAmount,
          },
        },
      });

      return NextResponse.json(updated);
    }

    // ---------- RESCHEDULE ----------
    if (action === "reschedule") {
      const { newDate, newYurtId } = body;

      if (!newDate) {
        return NextResponse.json(
          { error: "newDate is required for rescheduling" },
          { status: 400 }
        );
      }

      if (
        reservation.status === "CANCELLED" ||
        reservation.status === "EXPIRED"
      ) {
        return NextResponse.json(
          { error: "Cannot reschedule a cancelled or expired reservation" },
          { status: 400 }
        );
      }

      // Check 3+ day rule
      const now = new Date();
      const currentDate = new Date(reservation.date);
      const diffMs = currentDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < 3 && !isAdmin) {
        return NextResponse.json(
          {
            error:
              "Rescheduling requires at least 3 days before the reservation date",
          },
          { status: 400 }
        );
      }

      const targetYurtId = newYurtId || reservation.yurtId;
      const targetDate = new Date(newDate);

      // Verify new yurt exists and is active
      if (newYurtId && newYurtId !== reservation.yurtId) {
        const newYurt = await prisma.yurt.findUnique({
          where: { id: newYurtId },
        });
        if (!newYurt || newYurt.status !== "ACTIVE") {
          return NextResponse.json(
            { error: "Target yurt is not available" },
            { status: 400 }
          );
        }
      }

      // Check if new date/yurt is available
      const existingBooking = await prisma.reservation.findUnique({
        where: {
          yurtId_date: { yurtId: targetYurtId, date: targetDate },
        },
      });
      if (existingBooking && existingBooking.id !== id) {
        return NextResponse.json(
          { error: "The target date is already booked for this yurt" },
          { status: 409 }
        );
      }

      // Check availability is open
      const availability = await prisma.yurtAvailability.findUnique({
        where: {
          yurtId_date: { yurtId: targetYurtId, date: targetDate },
        },
      });
      if (availability && !availability.isOpen) {
        return NextResponse.json(
          { error: "The target date is closed for this yurt" },
          { status: 400 }
        );
      }

      // Create reschedule history and update reservation in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        await tx.rescheduleHistory.create({
          data: {
            reservationId: id,
            oldDate: reservation.date,
            oldYurtId: reservation.yurtId,
            newDate: targetDate,
            newYurtId: targetYurtId,
          },
        });

        return tx.reservation.update({
          where: { id },
          data: {
            date: targetDate,
            yurtId: targetYurtId,
            rescheduledFrom: reservation.date.toISOString(),
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
            yurt: { select: { id: true, name: true, capacity: true } },
          },
        });
      });

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "RESERVATION_RESCHEDULED",
          targetType: "Reservation",
          targetId: id,
          details: {
            oldDate: reservation.date,
            newDate,
            oldYurtId: reservation.yurtId,
            newYurtId: targetYurtId,
          },
        },
      });

      return NextResponse.json(updated);
    }

    // ---------- ADMIN UPDATES ----------
    if (isAdmin) {
      // Allow admin to update arbitrary fields
      const allowedFields = [
        "status",
        "guestCount",
        "specialRequests",
        "depositStatus",
        "depositAmount",
        "depositConfirmedAt",
        "paymentReference",
        "paymentScreenshotUrl",
      ];

      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No valid fields to update" },
          { status: 400 }
        );
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update reservation:", error);
    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 }
    );
  }
}
