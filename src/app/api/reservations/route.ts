import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { z } from "zod";

const createReservationBodySchema = z.object({
  yurtId: z.string().min(1, "yurtId is required"),
  date: z.string().min(1, "date is required").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
  guestCount: z.number().int().positive("guestCount must be a positive integer"),
  specialRequests: z.string().max(2000).optional(),
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

    const body = await req.json();
    const parsed = createReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { yurtId, date, guestCount, specialRequests } = parsed.data;

    // Check yurt exists and is active
    const yurt = await prisma.yurt.findUnique({ where: { id: yurtId } });
    if (!yurt || yurt.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Yurt not available" },
        { status: 400 }
      );
    }

    // Check guest count against capacity
    if (guestCount > yurt.capacity) {
      return NextResponse.json(
        { error: "Guest count exceeds yurt capacity" },
        { status: 400 }
      );
    }

    // Check availability
    const reservationDate = new Date(date);
    const existing = await prisma.reservation.findUnique({
      where: { yurtId_date: { yurtId, date: reservationDate } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This yurt is already booked for this date" },
        { status: 409 }
      );
    }

    // Check yurt availability is open
    const availability = await prisma.yurtAvailability.findUnique({
      where: { yurtId_date: { yurtId, date: reservationDate } },
    });
    if (availability && !availability.isOpen) {
      return NextResponse.json(
        { error: "This date is closed for this yurt" },
        { status: 400 }
      );
    }

    // Get deposit amount from settings
    const depositSetting = await prisma.systemSetting.findUnique({
      where: { key: "deposit_amount" },
    });
    const depositAmount = depositSetting
      ? parseFloat(depositSetting.value)
      : 300;

    // Get timeout from settings
    const timeoutSetting = await prisma.systemSetting.findUnique({
      where: { key: "payment_timeout_hours" },
    });
    const timeoutHours = timeoutSetting
      ? parseFloat(timeoutSetting.value)
      : 12;

    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + timeoutHours);

    const reservation = await prisma.reservation.create({
      data: {
        userId: session.user.id!,
        yurtId,
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
        details: { yurtName: yurt.name, date, guestCount },
      },
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error("Failed to create reservation:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
