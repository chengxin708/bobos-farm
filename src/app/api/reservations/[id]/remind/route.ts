import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-options";
import { sendPaymentReminder } from "@/lib/email";

export async function POST(
  _req: NextRequest,
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
      include: {
        user: { select: { email: true, name: true } },
        yurt: { select: { name: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        { error: "Reservation is not pending payment" },
        { status: 400 }
      );
    }

    if (!reservation.user.email) {
      return NextResponse.json(
        { error: "Customer has no email address" },
        { status: 400 }
      );
    }

    // Check email_payment_reminder setting
    const reminderSetting = await prisma.systemSetting.findUnique({
      where: { key: "email_payment_reminder" },
    });
    if (reminderSetting?.value === "false") {
      return NextResponse.json(
        { error: "Payment reminder emails are disabled in settings" },
        { status: 400 }
      );
    }

    // Fetch Zelle settings for the email
    const zelleSettings = await prisma.systemSetting.findMany({
      where: { key: { in: ["zelle_recipient", "zelle_recipient_name"] } },
    });
    const zelleMap: Record<string, string> = {};
    for (const s of zelleSettings) zelleMap[s.key] = s.value;

    const result = await sendPaymentReminder(reservation.user.email, {
      date: reservation.date,
      yurtName: reservation.yurt.name,
      depositAmount: reservation.depositAmount,
      paymentDeadline: reservation.paymentDeadline,
      zelleRecipient: zelleMap.zelle_recipient,
      zelleRecipientName: zelleMap.zelle_recipient_name,
      memoCode: reservation.id.slice(-6).toUpperCase(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send reminder" },
        { status: 500 }
      );
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user?.id,
        action: "PAYMENT_REMINDER_SENT",
        targetType: "Reservation",
        targetId: id,
        details: { customerEmail: reservation.user.email },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send payment reminder:", error);
    return NextResponse.json(
      { error: "Failed to send payment reminder" },
      { status: 500 }
    );
  }
}
