import { NextRequest, NextResponse } from 'next/server';
import { getTomorrowBookings, sendBookingReminder } from '@/lib/email';

// Cron job to send booking reminders
// This endpoint should be called once daily (e.g., at 9 AM)
// Can be triggered by Vercel Cron, external cron service, or manual trigger

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all bookings for tomorrow
    const tomorrowBookings = await getTomorrowBookings();
    
    if (tomorrowBookings.length === 0) {
      return NextResponse.json({
        message: 'No bookings found for tomorrow',
        processed: 0,
        successful: 0,
      });
    }

    // Send reminder emails
    let successful = 0;
    let failed = 0;
    
    for (const booking of tomorrowBookings) {
      const success = await sendBookingReminder(booking.id);
      if (success) {
        successful++;
      } else {
        failed++;
        console.error(`Failed to send reminder for booking: ${booking.id}`);
      }
    }

    return NextResponse.json({
      message: `Processed ${tomorrowBookings.length} bookings`,
      processed: tomorrowBookings.length,
      successful,
      failed,
      bookings: tomorrowBookings.map(b => ({
        id: b.id,
        yurt: b.yurt_name,
        date: b.booking_date,
        time: b.time_slot,
        user: b.user_name,
        email: b.email,
      })),
    });

  } catch (error) {
    console.error('Error in booking reminder cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
