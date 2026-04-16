import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendDepositConfirmed,
  sendDepositRefunded,
  sendReservationModified,
  sendYurtAssigned,
} from "@/lib/email";
import { timingSafeEqual } from "crypto";

/**
 * Cron: Send pending emails based on FINAL reservation state.
 *
 * Admin actions set emailPendingAt = now + 5min. This cron picks up
 * reservations where emailPendingAt has passed, checks the CURRENT
 * state (not what was recorded), and sends the appropriate email.
 *
 * This prevents email spam when admin makes rapid changes — only
 * the final state matters.
 */
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find reservations with pending emails that are ready to send
    const pending = await prisma.reservation.findMany({
      where: {
        emailPendingAt: { lte: now },
        emailPendingType: { not: null },
      },
      include: {
        user: { select: { email: true, name: true } },
        yurt: { select: { name: true, description: true } },
      },
    });

    let sent = 0;
    const results: string[] = [];

    for (const r of pending) {
      if (!r.user.email || r.user.email.endsWith("@placeholder.local")) {
        // Clear pending flag, skip sending
        await prisma.reservation.update({
          where: { id: r.id },
          data: { emailPendingAt: null, emailPendingType: null },
        });
        continue;
      }

      try {
        // Send email based on CURRENT state (not pendingType)
        // Priority: deposit state > reservation status > modification
        if (r.depositStatus === "CONFIRMED" && r.status === "CONFIRMED") {
          await sendDepositConfirmed(r.user.email, {
            date: r.date,
            yurtName: r.yurt?.name ?? "Pending assignment",
            guestCount: r.guestCount,
            reservationId: r.id,
          });
          results.push(`${r.confirmationCode}: deposit_confirmed`);
        } else if (r.depositStatus === "REFUNDED") {
          await sendDepositRefunded(r.user.email, {
            date: r.date,
            yurtName: r.yurt?.name ?? "N/A",
            guestCount: r.guestCount,
            depositAmount: r.depositAmount,
          });
          results.push(`${r.confirmationCode}: deposit_refunded`);
        } else if (r.emailPendingType === "yurt_assigned" && r.yurt) {
          await sendYurtAssigned(r.user.email, {
            date: r.date,
            yurtName: r.yurt.name,
            yurtDescription: r.yurt.description || undefined,
            guestCount: r.guestCount,
            reservationId: r.id,
          });
          await prisma.reservation.update({
            where: { id: r.id },
            data: { yurtNotifiedAt: new Date() },
          });
          results.push(`${r.confirmationCode}: yurt_assigned`);
        } else if (r.emailPendingType === "modified") {
          await sendReservationModified(r.user.email, {
            date: r.date,
            yurtName: r.yurt?.name ?? "Pending assignment",
            guestCount: r.guestCount,
            changes: {}, // No specific changes tracked, just notify current state
            reservationId: r.id,
          });
          results.push(`${r.confirmationCode}: modified`);
        } else {
          results.push(`${r.confirmationCode}: skipped (no matching state)`);
        }

        sent++;
      } catch (err) {
        console.error(`[cron] Failed to send email for ${r.confirmationCode}:`, err);
        results.push(`${r.confirmationCode}: error`);
      }

      // Clear pending flag
      await prisma.reservation.update({
        where: { id: r.id },
        data: { emailPendingAt: null, emailPendingType: null },
      });
    }

    return NextResponse.json({
      success: true,
      pending: pending.length,
      sent,
      results,
    });
  } catch (error) {
    console.error("Failed to process pending emails:", error);
    return NextResponse.json(
      { error: "Failed to process pending emails" },
      { status: 500 }
    );
  }
}
