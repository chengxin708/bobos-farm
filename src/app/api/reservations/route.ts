import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";
import {
  sendReservationCreated,
  sendAdminNewReservation,
} from "@/lib/email";

const createReservationBodySchema = z.object({
  yurtId: z.string().min(1).optional(), // optional for customers (auto-assigned)
  date: z.string().min(1, "date is required").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
  guestCount: z.number().int().positive("guestCount must be a positive integer"),
  specialRequests: z.string().max(2000).optional(),
});

const adminCreateReservationSchema = z.object({
  yurtId: z.string().min(1, "yurtId is required"),
  date: z.string().min(1, "date is required").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
  guestCount: z.number().int().positive("guestCount must be a positive integer"),
  specialRequests: z.string().max(2000).optional(),
  guestName: z.string().min(1, "guestName is required"),
  guestEmail: z.string().email("Invalid email"),
  guestPhone: z.string().min(1, "guestPhone is required"),
});

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
      const validStatuses = ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED", "CANCELLED", "EXPIRED", "COMPLETED"];
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
        user: { select: { id: true, name: true, email: true, phone: true } },
        yurt: { select: { id: true, name: true, capacity: true } },
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

// TODO: [SECURITY] Add rate limiting to prevent spam reservation creation (e.g., 5 per user per hour)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = (session.user as { role?: string }).role === "ADMIN";
    const body = await req.json();

    // ── Admin branch: create reservation on behalf of a customer ──
    // Only use admin branch when admin-specific fields are provided (guestName, guestEmail)
    // This allows admins to also book through the customer flow
    if (isAdmin && body.guestName && body.guestEmail) {
      const parsed = adminCreateReservationSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const { yurtId, date, guestCount, specialRequests, guestName, guestEmail, guestPhone } = parsed.data;

      // Validate yurt
      const yurt = await prisma.yurt.findUnique({ where: { id: yurtId } });
      if (!yurt || yurt.status !== "ACTIVE") {
        return NextResponse.json({ error: "Yurt not available" }, { status: 400 });
      }
      if (guestCount > yurt.capacity) {
        return NextResponse.json({ error: "Guest count exceeds yurt capacity" }, { status: 400 });
      }

      // Check availability
      const reservationDate = new Date(date);
      const existing = await prisma.reservation.findUnique({
        where: { yurtId_date: { yurtId, date: reservationDate } },
      });
      if (existing) {
        return NextResponse.json({ error: "This yurt is already booked for this date" }, { status: 409 });
      }

      const availability = await prisma.yurtAvailability.findUnique({
        where: { yurtId_date: { yurtId, date: reservationDate } },
      });
      if (availability && !availability.isOpen) {
        return NextResponse.json({ error: "This date is closed for this yurt" }, { status: 400 });
      }

      // Look up or create customer by email
      let customer = await prisma.user.findUnique({ where: { email: guestEmail } });
      if (!customer) {
        customer = await prisma.user.create({
          data: {
            email: guestEmail,
            name: guestName,
            phone: guestPhone,
            role: "CUSTOMER",
          },
        });
      }

      // Get deposit amount from settings
      const depositSetting = await prisma.systemSetting.findUnique({
        where: { key: "deposit_amount" },
      });
      const depositAmount = depositSetting ? parseFloat(depositSetting.value) : 300;

      // Admin-created reservations skip deposit — confirmed directly
      const reservation = await prisma.reservation.create({
        data: {
          userId: customer.id,
          yurtId,
          date: reservationDate,
          guestCount,
          specialRequests: specialRequests || null,
          status: "CONFIRMED",
          depositAmount,
          depositStatus: "CONFIRMED",
          depositConfirmedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          yurt: { select: { id: true, name: true, capacity: true } },
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "RESERVATION_CREATED",
          targetType: "Reservation",
          targetId: reservation.id,
          details: { yurtName: yurt.name, date, guestCount, createdByAdmin: true },
        },
      });

      // Fire-and-forget: send notification emails
      // Admin-created reservations are already confirmed, so notify the customer
      const emailSettings = await prisma.systemSetting.findMany({
        where: { key: { in: ["notification_email", "email_booking_confirmation", "email_admin_new_booking"] } },
      });
      const emailSettingsMap: Record<string, string> = {};
      for (const s of emailSettings) emailSettingsMap[s.key] = s.value;

      if (emailSettingsMap.email_booking_confirmation !== "false") {
        void sendReservationCreated(guestEmail, {
          reservationId: reservation.id,
          date,
          yurtName: yurt.name,
          guestCount,
          depositAmount,
          paymentDeadline: null,
        });
      }

      if (emailSettingsMap.email_admin_new_booking !== "false" && emailSettingsMap.notification_email) {
        void sendAdminNewReservation(emailSettingsMap.notification_email, {
          guestName: guestName,
          date,
          yurtName: yurt.name,
          guestCount,
        });
      }

      return NextResponse.json(reservation, { status: 201 });
    }

    // ── Customer branch: standard reservation creation ──
    const parsed = createReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { yurtId: requestedYurtId, date, guestCount, specialRequests } = parsed.data;

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

    // ── Yurt assignment: auto-assign if not provided ──
    let assignedYurtId: string;
    let assignedYurtName: string;

    if (requestedYurtId) {
      // Customer explicitly specified a yurt (backwards compatibility)
      const yurt = await prisma.yurt.findUnique({ where: { id: requestedYurtId } });
      if (!yurt || yurt.status !== "ACTIVE") {
        return NextResponse.json({ error: "Yurt not available" }, { status: 400 });
      }
      if (guestCount > yurt.capacity) {
        return NextResponse.json({ error: "Guest count exceeds yurt capacity" }, { status: 400 });
      }
      // Check unique constraint
      const existing = await prisma.reservation.findUnique({
        where: { yurtId_date: { yurtId: requestedYurtId, date: reservationDate } },
      });
      if (existing) {
        return NextResponse.json({ error: "This yurt is already booked for this date" }, { status: 409 });
      }
      // Check availability
      const avail = await prisma.yurtAvailability.findUnique({
        where: { yurtId_date: { yurtId: requestedYurtId, date: reservationDate } },
      });
      if (avail && !avail.isOpen) {
        return NextResponse.json({ error: "This date is closed for this yurt" }, { status: 400 });
      }
      assignedYurtId = requestedYurtId;
      assignedYurtName = yurt.name;
    } else {
      // Auto-assign: find an available yurt for this date
      const activeYurts = await prisma.yurt.findMany({ where: { status: "ACTIVE" } });
      if (activeYurts.length === 0) {
        return NextResponse.json({ error: "No yurts available" }, { status: 400 });
      }

      // Get yurts with ANY active reservation on this date
      // (includes PENDING_PAYMENT to respect DB unique constraint on yurtId+date)
      const occupiedYurtIds = (
        await prisma.reservation.findMany({
          where: {
            date: reservationDate,
            status: { notIn: ["CANCELLED", "EXPIRED"] },
          },
          select: { yurtId: true },
        })
      ).map((r) => r.yurtId);

      // Also check admin-set closures
      const closedYurts = await prisma.yurtAvailability.findMany({
        where: {
          date: reservationDate,
          isOpen: false,
        },
        select: { yurtId: true },
      });
      const closedYurtIds = closedYurts.map((c) => c.yurtId);

      const availableYurts = activeYurts.filter(
        (y) => !occupiedYurtIds.includes(y.id) && !closedYurtIds.includes(y.id) && guestCount <= y.capacity
      );

      if (availableYurts.length === 0) {
        return NextResponse.json(
          { error: "This date is fully booked. Please choose another date." },
          { status: 400 }
        );
      }

      // Assign first available yurt (sorted by sortOrder if present)
      const assigned = availableYurts.sort((a, b) => a.sortOrder - b.sortOrder)[0];
      assignedYurtId = assigned.id;
      assignedYurtName = assigned.name;
    }

    // Get deposit amount from settings
    const depositAmount = settingsMap.deposit_amount
      ? parseFloat(settingsMap.deposit_amount)
      : 300;

    // Get timeout from settings (stored as minutes)
    const timeoutMinutes = settingsMap.payment_timeout_hours
      ? parseFloat(settingsMap.payment_timeout_hours)
      : 720; // default 12 hours = 720 minutes

    const paymentDeadline = new Date();
    paymentDeadline.setMinutes(paymentDeadline.getMinutes() + timeoutMinutes);

    const reservation = await prisma.reservation.create({
      data: {
        userId: session.user.id!,
        yurtId: assignedYurtId,
        date: reservationDate,
        guestCount,
        specialRequests: specialRequests || null,
        status: "PENDING_PAYMENT",
        depositAmount,
        depositStatus: "UNPAID",
        paymentDeadline,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        yurt: { select: { id: true, name: true, capacity: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "RESERVATION_CREATED",
        targetType: "Reservation",
        targetId: reservation.id,
        details: { yurtName: assignedYurtName, date, guestCount, autoAssigned: !requestedYurtId },
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
        yurtName: assignedYurtName,
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
        yurtName: assignedYurtName,
        guestCount,
      });
    }

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error("Failed to create reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
