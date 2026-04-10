import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

// Zod schemas for each action to prevent unvalidated input
const cancelActionSchema = z.object({
  action: z.literal("cancel"),
  reason: z.string().max(1000).optional(),
});

const submitPaymentActionSchema = z.object({
  action: z.literal("submit_payment"),
  paymentScreenshotUrl: z.string().url().max(2048).optional(),
  paymentReference: z.string().max(255).optional(),
});

const rescheduleActionSchema = z.object({
  action: z.literal("reschedule"),
  newDate: z.string().min(1).refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
  newYurtId: z.string().optional(),
});

const adminUpdateSchema = z.object({
  status: z.enum(["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED", "CANCELLED", "EXPIRED", "COMPLETED"]).optional(),
  guestCount: z.number().int().positive().optional(),
  specialRequests: z.string().max(2000).optional(),
  depositStatus: z.enum(["UNPAID", "PENDING", "CONFIRMED", "REFUNDED"]).optional(),
  depositAmount: z.number().nonnegative().optional(),
  depositConfirmedAt: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date" }
  ).optional(),
  paymentReference: z.string().max(255).optional(),
  paymentScreenshotUrl: z.string().url().max(2048).optional(),
});

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

    // Validate action field exists
    if (!action || typeof action !== "string") {
      // If no action, check for admin update below
      if (!isAdmin) {
        return NextResponse.json({ error: "action field is required" }, { status: 400 });
      }
    }

    // ---------- CANCEL ----------
    if (action === "cancel") {
      const parsedCancel = cancelActionSchema.safeParse(body);
      if (!parsedCancel.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedCancel.error.flatten() },
          { status: 400 }
        );
      }
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
      const parsedPayment = submitPaymentActionSchema.safeParse(body);
      if (!parsedPayment.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedPayment.error.flatten() },
          { status: 400 }
        );
      }
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
          paymentScreenshotUrl: parsedPayment.data.paymentScreenshotUrl || null,
          paymentReference: parsedPayment.data.paymentReference || null,
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
      const parsedReschedule = rescheduleActionSchema.safeParse(body);
      if (!parsedReschedule.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedReschedule.error.flatten() },
          { status: 400 }
        );
      }
      const { newDate, newYurtId } = parsedReschedule.data;

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
      // Validate admin update fields with Zod schema
      const parsedAdmin = adminUpdateSchema.safeParse(body);
      if (!parsedAdmin.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedAdmin.error.flatten() },
          { status: 400 }
        );
      }

      // Only include fields that were actually provided
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsedAdmin.data)) {
        if (value !== undefined) {
          updateData[key] = value;
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
