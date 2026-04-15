import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import { sendAdminDepositSubmitted, sendReservationCancelled, sendReservationModified, sendYurtAssigned } from "@/lib/email";
import { sendPushToAdmins, sendPushToUser } from "@/lib/push";
import { checkDateAnomalies, assignYurtsForDate, tryDeterministicAssignment } from "@/lib/yurt-assignment";

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

const modifyDetailsSchema = z.object({
  action: z.literal("modify_details"),
  guestCount: z.number().int().positive().optional(),
  specialRequests: z.string().max(2000).optional(),
});

const assignYurtActionSchema = z.object({
  action: z.literal("assign_yurt"),
  yurtId: z.string().min(1, "yurtId is required"),
});

const editActionSchema = z.object({
  action: z.literal("edit"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }).optional(),
  yurtId: z.string().optional(),
  guestCount: z.number().int().positive().optional(),
  specialRequests: z.string().max(2000).nullish(),
  depositAmount: z.number().min(0).optional(),
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    // Load cancellation window setting (default: 7 days)
    const cancelWindowSetting = await prisma.systemSetting.findUnique({
      where: { key: "cancellation_window_days" },
    });
    const cancelWindowDays = cancelWindowSetting?.value ? parseInt(cancelWindowSetting.value, 10) : 7;

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

      // Cancellation policy: must cancel N days before
      const cancelNow = new Date();
      cancelNow.setHours(0, 0, 0, 0);
      const cancelResDate = new Date(reservation.date);
      cancelResDate.setHours(0, 0, 0, 0);
      const cancelDiffDays = Math.round(
        (cancelResDate.getTime() - cancelNow.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (cancelDiffDays < cancelWindowDays && !isAdmin) {
        return NextResponse.json(
          { error: `Reservations cannot be cancelled within ${cancelWindowDays} days of the event` },
          { status: 400 }
        );
      }

      // Check refund eligibility: N+ days before reservation date
      const now = new Date();
      const reservationDate = new Date(reservation.date);
      const diffMs = reservationDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const refundEligible = diffDays >= cancelWindowDays;

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelReason: parsedCancel.data.reason || null,
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
            reason: parsedCancel.data.reason,
            refundEligible,
            date: reservation.date,
          },
        },
      });

      // Fire-and-forget: send cancellation email to guest
      if (updated.user.email) {
        sendReservationCancelled(updated.user.email, {
          date: updated.date,
          yurtName: updated.yurt?.name ?? "Pending assignment",
          guestCount: updated.guestCount,
          cancelReason: parsedCancel.data.reason || undefined,
          depositAmount: reservation.depositAmount,
          depositStatus: reservation.depositStatus,
        }).catch(err => console.error('[email] cancel notification failed:', err));
      }

      // Reassign rooms after cancellation
      void tryDeterministicAssignment(new Date(reservation.date));

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

      // Fire-and-forget: send admin notification about deposit submission
      const notifSetting = await prisma.systemSetting.findUnique({
        where: { key: "notification_email" },
      });
      if (notifSetting?.value) {
        void sendAdminDepositSubmitted(notifSetting.value, {
          guestName: updated.user.name || updated.user.email,
          date: updated.date,
          yurtName: updated.yurt?.name ?? "Pending assignment",
          guestCount: updated.guestCount,
          depositAmount: reservation.depositAmount,
        });
      }

      // Fire-and-forget: push notification to admins
      sendPushToAdmins({
        title: "Deposit Pending Review",
        body: `${updated.user.name || updated.user.email} submitted $${reservation.depositAmount} deposit`,
        url: "/admin/reservations",
        tag: "deposit-submitted",
      }).catch(() => {});

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

      // Check cancellation window rule
      const now = new Date();
      const currentDate = new Date(reservation.date);
      const diffMs = currentDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < cancelWindowDays && !isAdmin) {
        return NextResponse.json(
          {
            error:
              `Rescheduling requires at least ${cancelWindowDays} days before the reservation date`,
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

      // Check if new date/yurt is available (only if yurt specified)
      if (targetYurtId) {
        const existingBooking = await prisma.reservation.findFirst({
          where: {
            yurtId: targetYurtId,
            date: targetDate,
            status: { notIn: ["CANCELLED", "EXPIRED"] },
            id: { not: id },
          },
        });
        if (existingBooking) {
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
      }

      const newReservationDate = targetDate;

      // Create reschedule history and update reservation in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        await tx.rescheduleHistory.create({
          data: {
            reservationId: id,
            oldDate: reservation.date,
            oldYurtId: reservation.yurtId ?? "",
            newDate: targetDate,
            newYurtId: targetYurtId ?? "",
          },
        });

        return tx.reservation.update({
          where: { id },
          data: {
            date: targetDate,
            yurtId: targetYurtId,
            yurtAssignedAt: null,
            yurtNotifiedAt: null,
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

      // Trigger deterministic assignment for both old and new dates
      void tryDeterministicAssignment(new Date(reservation.date)); // old date
      void tryDeterministicAssignment(newReservationDate); // new date

      return NextResponse.json(updated);
    }

    // ---------- MODIFY DETAILS (owner) ----------
    if (action === "modify_details") {
      const parsedModify = modifyDetailsSchema.safeParse(body);
      if (!parsedModify.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedModify.error.flatten() },
          { status: 400 }
        );
      }

      // Only allow modification of active reservations
      if (["CANCELLED", "EXPIRED", "COMPLETED"].includes(reservation.status)) {
        return NextResponse.json(
          { error: "Cannot modify a cancelled, expired, or completed reservation" },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = {};

      if (parsedModify.data.guestCount !== undefined) {
        // If yurt already assigned, validate capacity
        if (reservation.yurtId && parsedModify.data.guestCount) {
          const assignedYurt = await prisma.yurt.findUnique({
            where: { id: reservation.yurtId },
          });
          if (assignedYurt && parsedModify.data.guestCount > assignedYurt.capacity) {
            return NextResponse.json(
              { error: `Guest count exceeds assigned yurt capacity (max ${assignedYurt.capacity}). Please contact admin to change yurt.` },
              { status: 400 }
            );
          }
        }
        updateData.guestCount = parsedModify.data.guestCount;
      }

      if (parsedModify.data.specialRequests !== undefined) {
        updateData.specialRequests = parsedModify.data.specialRequests;
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

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "RESERVATION_MODIFIED",
          targetType: "Reservation",
          targetId: id,
          details: updateData as Record<string, string | number>,
        },
      });

      return NextResponse.json(updated);
    }

    // ---------- ASSIGN YURT (admin only) ----------
    if (action === "assign_yurt") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Only admins can assign yurts" }, { status: 403 });
      }

      const parsedAssign = assignYurtActionSchema.safeParse(body);
      if (!parsedAssign.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedAssign.error.flatten() },
          { status: 400 }
        );
      }

      const { yurtId: newYurtId } = parsedAssign.data;

      // Verify yurt exists and is active
      const targetYurt = await prisma.yurt.findUnique({ where: { id: newYurtId } });
      if (!targetYurt || targetYurt.status !== "ACTIVE") {
        return NextResponse.json({ error: "Yurt not available" }, { status: 400 });
      }

      // Check for conflicts: another reservation on the same date for this yurt
      if (newYurtId !== reservation.yurtId) {
        const conflict = await prisma.reservation.findFirst({
          where: {
            yurtId: newYurtId,
            date: reservation.date,
            status: { notIn: ["CANCELLED", "EXPIRED"] },
            id: { not: id },
          },
        });
        if (conflict) {
          return NextResponse.json(
            { error: "This yurt is already booked for this date" },
            { status: 409 }
          );
        }
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: {
          yurtId: newYurtId,
          yurtAssignedAt: new Date(),
          manuallyAssigned: true,
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      // Cascade: reassign other reservations on this date
      void tryDeterministicAssignment(new Date(reservation.date));

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "YURT_ASSIGNED",
          targetType: "Reservation",
          targetId: id,
          details: {
            oldYurtId: reservation.yurtId,
            newYurtId,
            yurtName: targetYurt.name,
            date: reservation.date,
          },
        },
      });

      // Notification timing: send now only if within T-2
      const assignResDate = new Date(reservation.date);
      assignResDate.setHours(0, 0, 0, 0);
      const assignNow = new Date();
      assignNow.setHours(0, 0, 0, 0);
      const assignDiffDays = Math.round(
        (assignResDate.getTime() - assignNow.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (assignDiffDays <= 2 && updated.user.email) {
        // T-2 or closer: send immediately
        void sendYurtAssigned(updated.user.email, {
          date: updated.date,
          yurtName: targetYurt.name,
          yurtDescription: targetYurt.description || undefined,
          guestCount: updated.guestCount,
          reservationId: id,
        });
        await prisma.reservation.update({
          where: { id },
          data: { yurtNotifiedAt: new Date() },
        });
      }
      // Otherwise: T-2 10AM cron will handle notification

      return NextResponse.json(updated);
    }

    // ---------- EDIT (admin full edit: date, yurt, guestCount, specialRequests) ----------
    if (action === "edit") {
      if (!isAdmin && reservation.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const parsedEdit = editActionSchema.safeParse(body);
      if (!parsedEdit.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsedEdit.error.flatten() },
          { status: 400 }
        );
      }

      // Only allow modification of active reservations
      if (["CANCELLED", "EXPIRED", "COMPLETED"].includes(reservation.status)) {
        return NextResponse.json(
          { error: "Cannot edit a cancelled, expired, or completed reservation" },
          { status: 400 }
        );
      }

      const { date, yurtId, guestCount, specialRequests, depositAmount: newDepositAmount } = parsedEdit.data;

      // Determine target yurt and date
      const targetYurtId = yurtId || reservation.yurtId;
      const targetDate = date ? new Date(date) : reservation.date;
      const dateChanged = date && date !== reservation.date.toISOString().slice(0, 10);
      const yurtChanged = yurtId && yurtId !== reservation.yurtId;

      // Validate new yurt exists and is active
      let targetYurt = reservation.yurt;
      if (yurtChanged) {
        const newYurt = await prisma.yurt.findUnique({ where: { id: yurtId } });
        if (!newYurt || newYurt.status !== "ACTIVE") {
          return NextResponse.json({ error: "Target yurt is not available" }, { status: 400 });
        }
        targetYurt = newYurt;
      }

      // Validate guest count against yurt capacity (only if yurt assigned/specified)
      const effectiveGuestCount = guestCount ?? reservation.guestCount;
      if (targetYurt && effectiveGuestCount > targetYurt.capacity) {
        return NextResponse.json(
          { error: `Guest count cannot exceed yurt capacity of ${targetYurt.capacity}` },
          { status: 400 }
        );
      }

      // Check conflict if date or yurt changed (only when yurt is specified)
      if ((dateChanged || yurtChanged) && targetYurtId) {
        const conflict = await prisma.reservation.findFirst({
          where: {
            yurtId: targetYurtId,
            date: targetDate,
            status: { notIn: ["CANCELLED", "EXPIRED"] },
            id: { not: id },
          },
        });
        if (conflict) {
          return NextResponse.json(
            { error: "This yurt is already booked for this date" },
            { status: 409 }
          );
        }

        // Check availability is open
        const avail = await prisma.yurtAvailability.findUnique({
          where: { yurtId_date: { yurtId: targetYurtId, date: targetDate } },
        });
        if (avail && !avail.isOpen) {
          return NextResponse.json(
            { error: "The target date is closed for this yurt" },
            { status: 400 }
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (dateChanged) updateData.date = targetDate;
      if (yurtChanged) {
        updateData.yurtId = yurtId;
        updateData.manuallyAssigned = true;
      }
      if (guestCount !== undefined) updateData.guestCount = guestCount;
      if (specialRequests !== undefined) updateData.specialRequests = specialRequests;
      if (newDepositAmount !== undefined) updateData.depositAmount = newDepositAmount;

      // Release auto-assignment if date or guestCount changed (not manual)
      const guestCountChanged = guestCount !== undefined && guestCount !== reservation.guestCount;
      if (!reservation.manuallyAssigned && (dateChanged || guestCountChanged) && !yurtChanged) {
        updateData.yurtId = null;
        updateData.yurtAssignedAt = null;
        updateData.manuallyAssigned = false;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }

      const updated = await prisma.reservation.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      // Build changes record for activity log and email
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes: Record<string, any> = {};
      if (dateChanged) {
        changes.date = { from: reservation.date.toISOString().slice(0, 10), to: date };
      }
      if (yurtChanged) {
        changes.yurt = { from: reservation.yurt?.name ?? "Unassigned", to: updated.yurt?.name ?? "Unassigned" };
      }
      if (guestCount !== undefined && guestCount !== reservation.guestCount) {
        changes.guestCount = { from: reservation.guestCount, to: guestCount };
      }

      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: dateChanged ? "RESERVATION_RESCHEDULED" : "RESERVATION_MODIFIED",
          targetType: "Reservation",
          targetId: id,
          details: changes,
        },
      });

      // Fire-and-forget: send email notification to guest
      if (updated.user.email && Object.keys(changes).length > 0) {
        sendReservationModified(updated.user.email, {
          date: updated.date,
          yurtName: updated.yurt?.name ?? "Pending assignment",
          guestCount: updated.guestCount,
          changes: changes as {
            date?: { from: string; to: string };
            yurt?: { from: string; to: string };
            guestCount?: { from: number; to: number };
          },
          reservationId: id,
        }).catch((err) =>
          console.error("[email] reservation modified notification failed:", err)
        );
      }

      // Trigger deterministic assignment for affected dates
      void tryDeterministicAssignment(new Date(updated.date));
      if (dateChanged) {
        void tryDeterministicAssignment(new Date(reservation.date));
      }

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

      // Fire-and-forget: push notification to customer when deposit is confirmed
      if (
        parsedAdmin.data.depositStatus === "CONFIRMED" &&
        reservation.depositStatus !== "CONFIRMED"
      ) {
        sendPushToUser(updated.userId, {
          title: "Deposit Confirmed",
          body: "Your reservation is confirmed! You can now pre-order menu items.",
          url: "/pre-order",
          tag: "deposit-confirmed",
        }).catch(() => {});
      }

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
