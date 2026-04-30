import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import {
  sendReservationCreated,
  sendAdminNewReservation,
} from "@/lib/email";
import { sendPushToAdmins } from "@/lib/push";
import { simulateWithNewReservation, assignYurtsForDate, checkDateAnomalies, tryDeterministicAssignment } from "@/lib/yurt-assignment";
import { recordContactsFromUser } from "@/lib/contact-history";
import { syncReservationYurt } from "@/lib/reservation-yurt-sync";
import { isYurtDateConflict } from "@/lib/reservation-errors";
import { computeAdminPaymentDeadline, resolveAdminDeadlineHours } from "@/lib/admin-deadline";
import { computeCustomerPaymentDeadline, resolveCustomerDeadlineHours } from "@/lib/customer-deadline";
import { rateLimit } from "@/lib/rate-limit";
import { isWeekendET } from "@/lib/operating-day-pure";
import { AUTO_PROMOTE_NOTE_RESERVATION } from "@/lib/operating-day";

/** Generate a unique human-readable confirmation code like BF-A3K9X2 */
function randomCuid(): string {
  return `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function generateConfirmationCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const existing = await prisma.reservation.findUnique({ where: { confirmationCode: code } });
    if (!existing) return code;
  }
  // Fallback: use timestamp-based code
  return `BF-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

const createReservationBodySchema = z.object({
  yurtId: z.string().min(1).optional(), // optional for customers (auto-assigned)
  date: z.string().min(1, "date is required").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
  guestCount: z.number().int().positive("guestCount must be a positive integer"),
  specialRequests: z.string().max(2000).optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

const adminCreateReservationSchema = z.object({
  yurtId: z.string().min(1).optional(),
  yurtIds: z.array(z.string().min(1)).min(1).optional(),
  date: z.string().min(1, "date is required").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
  guestCount: z.number().int().positive("guestCount must be a positive integer"),
  specialRequests: z.string().max(2000).optional(),
  guestName: z.string().min(1, "guestName is required"),
  guestEmail: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
  guestPhone: z.string().optional(),
  guestWechatId: z.string().max(100).optional(),
  customDeposit: z.number().min(0).optional(),
  holdAssignment: z.boolean().optional(),
}).refine(
  (data) => {
    const hasEmail = !!data.guestEmail && data.guestEmail.trim().length > 0;
    const hasPhone = !!data.guestPhone && data.guestPhone.trim().length > 0;
    const hasWechat = !!data.guestWechatId && data.guestWechatId.trim().length > 0;
    return hasEmail || hasPhone || hasWechat;
  },
  { message: "At least one contact method (email, phone, or WeChat) is required", path: ["guestEmail"] }
);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    const where: Record<string, unknown> = {};

    if (!isAdmin) {
      where.userId = session.user.id;
    } else {
      const status = searchParams.get("status");
      const validStatuses = ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED", "CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED", "COMPLETED"];
      if (status && validStatuses.includes(status)) where.status = status;

      const yurtId = searchParams.get("yurtId");
      if (yurtId) where.yurtId = yurtId;

      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      if (startDate || endDate) {
        const dateFilter: Record<string, Date> = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        where.date = dateFilter;
      }

      const search = searchParams.get("search");
      if (search) {
        where.OR = [
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { phone: { contains: search, mode: "insensitive" } } },
        ];
      }
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
        yurt: { select: { id: true, name: true, capacity: true } },
        orders: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            estimatedTotal: true,
            finalTotal: true,
            reservationYurt: {
              select: {
                id: true,
                yurt: { select: { id: true, name: true, alias: true } },
              },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("Failed to fetch reservations:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";

    // Customer-side rate limit: 5 reservations per user per hour. Admins
    // creating proxy bookings are exempt — they may legitimately punch
    // in many on a busy phone-call day. Keyed by userId (not IP) so a
    // shared-NAT household doesn't bottleneck on each other.
    if (!isAdmin) {
      const rl = rateLimit(`reservation:${session.user.id}`, {
        limit: 5,
        windowMs: 60 * 60 * 1000,
      });
      if (!rl.ok) {
        return NextResponse.json(
          {
            error: "Too many reservation attempts. Please try again later.",
            retryAfterSeconds: rl.retryAfterSeconds,
          },
          {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfterSeconds) },
          },
        );
      }
    }

    const body = await req.json();

    // ── Admin branch: create reservation on behalf of a customer ──
    // Admin branch when guestName provided (other contact methods validated by schema refine)
    if (isAdmin && body.guestName) {
      const parsed = adminCreateReservationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const { date, guestCount, specialRequests, guestName, holdAssignment } = parsed.data;
      // Normalize single/multi yurt input: yurtIds wins, yurtId is a
      // single-element shorthand kept for backward compatibility with
      // pre-phase-2 clients.
      const rawYurtIds = parsed.data.yurtIds ?? (parsed.data.yurtId ? [parsed.data.yurtId] : []);
      const yurtIds = Array.from(new Set(rawYurtIds));
      const guestEmail = (parsed.data.guestEmail || '').trim();
      const guestPhone = (parsed.data.guestPhone || '').trim();
      const guestWechatId = (parsed.data.guestWechatId || '').trim();
      const reservationDate = new Date(date);

      if (yurtIds.length > 0) {
        // Multi- (or single-) yurt specific assignment. Validate each
        // in parallel: exists, ACTIVE, capacity (per-yurt), conflict-
        // free, not closed on this date.
        const yurts = await prisma.yurt.findMany({
          where: { id: { in: yurtIds } },
          select: { id: true, name: true, capacity: true, status: true },
        });
        if (yurts.length !== yurtIds.length) {
          return NextResponse.json({ error: "One or more yurts not found" }, { status: 400 });
        }
        for (const y of yurts) {
          if (y.status !== "ACTIVE") {
            return NextResponse.json({ error: `Yurt ${y.name} is not active` }, { status: 400 });
          }
        }
        // Total capacity check — multi-yurt pools capacity across rooms.
        const totalCapacity = yurts.reduce((sum, y) => sum + y.capacity, 0);
        if (guestCount > totalCapacity) {
          return NextResponse.json(
            { error: "Guest count exceeds combined capacity of selected yurts" },
            { status: 400 },
          );
        }
        const conflicts = await prisma.reservation.findMany({
          where: {
            yurtId: { in: yurtIds },
            date: reservationDate,
            status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
          },
          select: { yurtId: true },
        });
        if (conflicts.length) {
          return NextResponse.json(
            { error: "One or more yurts are already booked for this date" },
            { status: 409 },
          );
        }
        const closures = await prisma.yurtAvailability.findMany({
          where: {
            yurtId: { in: yurtIds },
            date: reservationDate,
            isOpen: false,
          },
          select: { yurtId: true },
        });
        if (closures.length) {
          return NextResponse.json(
            { error: "One or more yurts are closed on this date" },
            { status: 400 },
          );
        }
      } else if (!holdAssignment) {
        // Auto mode: verify the farm CAN actually assign a yurt later —
        // if simulation fails here, deterministic assignment will too.
        const { assignable } = await simulateWithNewReservation(reservationDate, guestCount);
        if (!assignable) {
          return NextResponse.json(
            { error: "This date cannot accommodate this group size" },
            { status: 400 }
          );
        }
      }
      // Hold mode: no capacity check — admin deliberately over-allocates
      // ("先占位再说"), and the customer-side /api/availability endpoints
      // treat each Hold as consuming a yurt slot so this doesn't open a
      // path to customer overbooking.

      // Customer matching:
      //   - Email is the only true account identifier; if provided, look up by email (may match real or placeholder)
      //   - If no email, soft-match against existing PLACEHOLDER users by phone or wechat to avoid
      //     creating duplicate placeholders for the same proxy-booked person. Never match against
      //     real (non-placeholder) accounts via phone/wechat.
      //   - Otherwise create a new placeholder with a random temp- email (decoupled from contact info).
      let customer = guestEmail
        ? await prisma.user.findUnique({ where: { email: guestEmail } })
        : null;

      if (!customer && (guestPhone || guestWechatId)) {
        customer = await prisma.user.findFirst({
          where: {
            role: "CUSTOMER",
            email: { endsWith: "@placeholder.local" },
            OR: [
              ...(guestPhone ? [{ phone: guestPhone }] : []),
              ...(guestWechatId ? [{ wechatId: guestWechatId }] : []),
            ],
          },
        });
      }

      if (!customer) {
        customer = await prisma.user.create({
          data: {
            email: guestEmail || `temp-${randomCuid()}@placeholder.local`,
            name: guestName,
            phone: guestPhone || null,
            wechatId: guestWechatId || null,
            role: "CUSTOMER",
          },
        });
      } else {
        // Backfill missing contact fields on the matched placeholder
        const updates: { phone?: string; wechatId?: string } = {};
        if (!customer.phone && guestPhone) updates.phone = guestPhone;
        if (!customer.wechatId && guestWechatId) updates.wechatId = guestWechatId;
        if (Object.keys(updates).length > 0) {
          customer = await prisma.user.update({ where: { id: customer.id }, data: updates });
        }
      }

      // Record admin-entered contact values into history
      await recordContactsFromUser(
        prisma,
        { id: customer.id, email: guestEmail || null, phone: guestPhone || null, wechatId: guestWechatId || null },
        "admin",
        session.user.id
      );

      // Get deposit amount + admin hold window from settings
      const adminSettings = await prisma.systemSetting.findMany({
        where: { key: { in: ["deposit_amount", "admin_deposit_deadline_hours"] } },
      });
      const adminSettingsMap: Record<string, string> = {};
      for (const s of adminSettings) adminSettingsMap[s.key] = s.value;

      const systemDepositAmount = adminSettingsMap.deposit_amount
        ? parseFloat(adminSettingsMap.deposit_amount)
        : 300;
      // Deposit scales with the number of packages (yurts). Single-yurt
      // and hold-without-assignment both charge the base deposit;
      // multi-yurt multiplies. customDeposit always overrides.
      const packageCount = Math.max(yurtIds.length, 1);
      const depositAmount =
        parsed.data.customDeposit ?? systemDepositAmount * packageCount;
      const skipPayment = depositAmount === 0;
      const adminDeadlineHours = resolveAdminDeadlineHours(
        adminSettingsMap.admin_deposit_deadline_hours,
      );

      // Past-date check: admin can retroactively log historical visits.
      // Reservation is treated as already-completed: status=COMPLETED, deposit=CONFIRMED.
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const isPastDate = reservationDate < todayMidnight;

      // Admin-created reservations: holdByAdmin=true (unless past — then it's a historical record)
      // - Past date: status=COMPLETED, deposit=CONFIRMED (already happened)
      // - Future $0 deposit: skip payment → CONFIRMED
      // - Future > $0 deposit: PENDING_PAYMENT with holdByAdmin (holds spot, awaits payment)
      //
      // adminDeadlineHours gives the admin a visible countdown in the
      // detail panel — the hold does NOT auto-expire (cron excludes
      // holdByAdmin=true), but admins are nudged to release or extend.
      const adminPaymentDeadline = computeAdminPaymentDeadline({
        now: new Date(),
        hours: adminDeadlineHours,
        isPastDate,
        skipPayment,
      });

      const confirmationCode = await generateConfirmationCode();
      // The "main" yurt on Reservation.yurtId is the first of the
      // selected list — old readers that ignore ReservationYurt[] still
      // see a sensible single-yurt value.
      const primaryYurtId = yurtIds[0] ?? null;
      const reservation = await prisma.$transaction(async (tx) => {
        const created = await tx.reservation.create({
          data: {
            confirmationCode,
            userId: customer.id,
            yurtId: primaryYurtId,
            date: reservationDate,
            guestCount,
            specialRequests: specialRequests || null,
            holdByAdmin: !isPastDate,
            depositAmount,
            status: isPastDate ? "COMPLETED" : (skipPayment ? "CONFIRMED" : "PENDING_PAYMENT"),
            depositStatus: (isPastDate || skipPayment) ? "CONFIRMED" : "UNPAID",
            depositConfirmedAt: (isPastDate || skipPayment) ? new Date() : null,
            paymentDeadline: adminPaymentDeadline,
            packageCount: yurtIds.length || null,
            ...(primaryYurtId ? { yurtAssignedAt: new Date() } : {}),
          },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
            yurt: { select: { id: true, name: true, capacity: true } },
          },
        });

        // One ReservationYurt + one empty DRAFT Order per selected
        // yurt. Customers see these as "packages" in phase 2.8 and can
        // pre-order into each tab independently.
        for (let i = 0; i < yurtIds.length; i++) {
          const yurtId = yurtIds[i];
          const ry = await tx.reservationYurt.create({
            data: {
              reservationId: created.id,
              yurtId,
              sortOrder: i,
            },
          });
          await tx.order.create({
            data: {
              reservationId: created.id,
              reservationYurtId: ry.id,
              status: "DRAFT",
              notes: null,
              estimatedTotal: 0,
            },
          });
        }

        // Auto-promote: closed date → PRIVATE_EVENT.
        // When admin books on a date whose effective mode is CLOSED
        // (no row + weekday default, OR explicit CLOSED row), upsert a
        // PRIVATE_EVENT row so the calendar surfaces the booking and
        // audit log records who/why. Existing OPEN/PRIVATE_EVENT rows
        // are left alone — admin's explicit choice wins.
        //
        // `created.date` is `@db.Date` → midnight UTC. Anchor at noon
        // UTC before passing to isWeekendET so ET-zone DOW resolution
        // doesn't shift the weekend boundary by one day.
        const existingOp = await tx.operatingDay.findUnique({
          where: { date: created.date },
        });
        const opAnchor = new Date(created.date);
        opAnchor.setUTCHours(12, 0, 0, 0);
        const effectiveMode =
          existingOp?.mode ?? (isWeekendET(opAnchor) ? "OPEN" : "CLOSED");
        if (effectiveMode === "CLOSED") {
          await tx.operatingDay.upsert({
            where: { date: created.date },
            create: {
              date: created.date,
              mode: "PRIVATE_EVENT",
              note: AUTO_PROMOTE_NOTE_RESERVATION,
              createdBy: session.user.id,
            },
            update: {
              mode: "PRIVATE_EVENT",
              note: AUTO_PROMOTE_NOTE_RESERVATION,
            },
          });
        }

        return created;
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "RESERVATION_CREATED",
          targetType: "Reservation",
          targetId: reservation.id,
          details: { yurtName: reservation.yurt?.name || "To be assigned", date, guestCount, createdByAdmin: true },
        },
      });

      // Fire-and-forget: send notification emails
      // Admin-created reservations are already confirmed, so notify the customer
      const emailSettings = await prisma.systemSetting.findMany({
        where: { key: { in: ["notification_email", "email_booking_confirmation", "email_admin_new_booking"] } },
      });
      const emailSettingsMap: Record<string, string> = {};
      for (const s of emailSettings) emailSettingsMap[s.key] = s.value;

      if (emailSettingsMap.email_booking_confirmation !== "false" && guestEmail && !guestEmail.endsWith('@placeholder.local')) {
        void sendReservationCreated(guestEmail, {
          reservationId: reservation.id,
          date,
          yurtName: reservation.yurt?.name || "To be assigned",
          guestCount,
          depositAmount,
          paymentDeadline: null,
        });
      }

      if (emailSettingsMap.email_admin_new_booking !== "false" && emailSettingsMap.notification_email) {
        void sendAdminNewReservation(emailSettingsMap.notification_email, {
          guestName: guestName,
          date,
          yurtName: reservation.yurt?.name || "To be assigned",
          guestCount,
        });
      }

      // Auto-assign yurt if not manually specified and not held
      if (yurtIds.length === 0 && !holdAssignment) {
        await tryDeterministicAssignment(reservationDate);
      }

      // Re-fetch to include updated yurt assignment
      const finalReservation = yurtIds.length === 0 && !holdAssignment
        ? await prisma.reservation.findUnique({
            where: { id: reservation.id },
            include: {
              user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
              yurt: { select: { id: true, name: true, capacity: true } },
            },
          })
        : reservation;

      return NextResponse.json(finalReservation || reservation, { status: 201 });
    }

    // ── Customer branch: standard reservation creation ──
    const parsed = createReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { yurtId: requestedYurtId, date, guestCount, specialRequests, contactName, contactPhone } = parsed.data;

    // Update user profile with contact info if provided
    if (contactName || contactPhone) {
      await prisma.user.update({
        where: { id: session.user.id! },
        data: {
          ...(contactName && { name: contactName }),
          ...(contactPhone && { phone: contactPhone }),
        },
      }).catch(() => {}); // non-critical, don't block reservation

      if (contactPhone) {
        await recordContactsFromUser(
          prisma,
          { id: session.user.id!, phone: contactPhone },
          "self",
          session.user.id!
        ).catch(() => {});
      }
    }

    const reservationDate = new Date(date);

    // Fetch all needed settings in one query
    const settingsRecords = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "deposit_amount",
            "payment_timeout_hours",
            "min_advance_booking_days",
            "max_advance_booking_days",
          ],
        },
      },
    });
    const settingsMap: Record<string, string> = {};
    for (const s of settingsRecords) settingsMap[s.key] = s.value;

    // Enforce advance booking window
    const minAdvanceDays = settingsMap.min_advance_booking_days ? parseInt(settingsMap.min_advance_booking_days, 10) : 1;
    const maxAdvanceDays = settingsMap.max_advance_booking_days ? parseInt(settingsMap.max_advance_booking_days, 10) : 90;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = reservationDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < minAdvanceDays) {
      return NextResponse.json(
        { error: `Reservations must be made at least ${minAdvanceDays} day(s) in advance` },
        { status: 400 }
      );
    }
    if (diffDays > maxAdvanceDays) {
      return NextResponse.json(
        { error: `Reservations cannot be made more than ${maxAdvanceDays} days in advance` },
        { status: 400 }
      );
    }

    // ── Capacity validation: simulate assignment ──
    // For customer bookings (no explicit yurtId), validate via full BFD simulation
    if (!requestedYurtId) {
      const { assignable } = await simulateWithNewReservation(reservationDate, guestCount);
      if (!assignable) {
        return NextResponse.json(
          { error: "This date cannot accommodate your group size. Please choose another date." },
          { status: 400 }
        );
      }
    } else {
      // Admin specified a yurtId — validate it directly
      const yurt = await prisma.yurt.findUnique({ where: { id: requestedYurtId } });
      if (!yurt || yurt.status !== "ACTIVE") {
        return NextResponse.json({ error: "Yurt not available" }, { status: 400 });
      }
      if (guestCount > yurt.capacity) {
        return NextResponse.json({ error: "Guest count exceeds yurt capacity" }, { status: 400 });
      }
      // Check conflict (code-level, no more DB unique constraint)
      const conflict = await prisma.reservation.findFirst({
        where: {
          yurtId: requestedYurtId,
          date: reservationDate,
          status: { notIn: ["CANCELLED", "CANCELLED_PENDING_REFUND", "EXPIRED"] },
        },
      });
      if (conflict) {
        return NextResponse.json({ error: "This yurt is already booked for this date" }, { status: 409 });
      }
      const avail = await prisma.yurtAvailability.findUnique({
        where: { yurtId_date: { yurtId: requestedYurtId, date: reservationDate } },
      });
      if (avail && !avail.isOpen) {
        return NextResponse.json({ error: "This date is closed for this yurt" }, { status: 400 });
      }
    }

    // Get deposit amount from settings
    const depositAmount = settingsMap.deposit_amount
      ? parseFloat(settingsMap.deposit_amount)
      : 300;

    // Customer self-serve deadline: setting value is HOURS, default 24.
    // Mirrors admin proxy convention (lib/admin-deadline.ts).
    const customerHours = resolveCustomerDeadlineHours(settingsMap.payment_timeout_hours);
    const paymentDeadline = computeCustomerPaymentDeadline({
      now: new Date(),
      hours: customerHours,
    });

    const confirmationCode = await generateConfirmationCode();
    const reservation = await prisma.reservation.create({
      data: {
        confirmationCode,
        userId: session.user.id!,
        yurtId: requestedYurtId || null, // null for customer bookings, set for admin
        date: reservationDate,
        guestCount,
        specialRequests: specialRequests || null,
        status: "PENDING_PAYMENT",
        depositAmount,
        depositStatus: "UNPAID",
        paymentDeadline,
        ...(requestedYurtId ? { yurtAssignedAt: new Date() } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
        yurt: { select: { id: true, name: true, capacity: true } },
      },
    });

    if (requestedYurtId) await syncReservationYurt(prisma, reservation.id, requestedYurtId);

    // Run deterministic assignment for this date
    if (!requestedYurtId) {
      await tryDeterministicAssignment(reservationDate);
      // Refresh reservation to get updated yurtId
      const updated = await prisma.reservation.findUnique({
        where: { id: reservation.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, wechatId: true } },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });
      if (updated) {
        Object.assign(reservation, updated);
        if (updated.yurtId) await syncReservationYurt(prisma, reservation.id, updated.yurtId);
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "RESERVATION_CREATED",
        targetType: "Reservation",
        targetId: reservation.id,
        details: { yurtName: reservation.yurt?.name || "To be assigned", date, guestCount, autoAssigned: !requestedYurtId },
      },
    });

    // Fire-and-forget: send notification emails
    const emailSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ["notification_email", "email_booking_confirmation", "email_admin_new_booking", "zelle_recipient", "zelle_recipient_name"] } },
    });
    const emailSettingsMap: Record<string, string> = {};
    for (const s of emailSettings) emailSettingsMap[s.key] = s.value;

    if (emailSettingsMap.email_booking_confirmation !== "false" && reservation.user.email) {
      void sendReservationCreated(reservation.user.email, {
        reservationId: reservation.id,
        date,
        yurtName: reservation.yurt?.name || "To be assigned",
        guestCount,
        depositAmount,
        paymentDeadline,
        zelleRecipient: emailSettingsMap.zelle_recipient,
        zelleRecipientName: emailSettingsMap.zelle_recipient_name,
        memoCode: reservation.id.slice(-6).toUpperCase(),
      });
    }

    if (emailSettingsMap.email_admin_new_booking !== "false" && emailSettingsMap.notification_email) {
      void sendAdminNewReservation(emailSettingsMap.notification_email, {
        guestName: reservation.user.name || reservation.user.email,
        date,
        yurtName: reservation.yurt?.name || "To be assigned",
        guestCount,
      });
    }

    // Fire-and-forget: push notification to admins
    sendPushToAdmins({
      title: "New Reservation",
      body: `${reservation.user.name || reservation.user.email} booked ${reservation.yurt?.name || "unassigned"} on ${date}`,
      url: "/admin/reservations",
      tag: "new-reservation",
    }).catch(() => {});

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (isYurtDateConflict(error)) {
      return NextResponse.json(
        { error: "This yurt is already booked for this date" },
        { status: 409 }
      );
    }
    console.error("Failed to create reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}

