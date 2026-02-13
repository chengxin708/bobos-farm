import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yurtId = searchParams.get('yurt_id');
    const date = searchParams.get('date');

    if (!yurtId || !date) {
      return NextResponse.json(
        { error: 'yurt_id and date are required' },
        { status: 400 }
      );
    }

    // Get all bookings for this yurt and date
    const bookings = await db`
      SELECT time_slot
      FROM bookings
      WHERE yurt_id = ${yurtId}
        AND booking_date = ${date}
        AND status IN ('pending', 'confirmed')
    `;

    const bookedSlots = bookings.rows.map(b => b.time_slot);

    // All available slots
    const allSlots = [
      { id: 'afternoon', name: 'Afternoon', time: '14:00 - 18:00' },
      { id: 'evening', name: 'Evening', time: '18:00 - 22:00' }
    ];

    // Return available slots
    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot.id));

    return NextResponse.json({
      date,
      yurt_id: yurtId,
      available_slots: availableSlots,
      booked_slots: bookedSlots
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    );
  }
}
