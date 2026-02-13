import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get token from header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // In a real app, you would check if the user is an admin
    // For now, we'll just verify the token exists
    const { id } = await params;

    // Check if booking exists
    const existing = await db`
      SELECT id, status FROM bookings WHERE id = ${id}
    `;

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const booking = existing.rows[0];

    if (booking.status === 'confirmed') {
      return NextResponse.json(
        { error: 'Booking is already confirmed' },
        { status: 400 }
      );
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot confirm a cancelled booking' },
        { status: 400 }
      );
    }

    // Update booking status
    const result = await db`
      UPDATE bookings
      SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, yurt_id, booking_date, time_slot, status, updated_at
    `;

    const updated = result.rows[0];

    // Get yurt name
    const yurts = await db`
      SELECT name FROM yurts WHERE id = ${updated.yurt_id}
    `;

    return NextResponse.json({
      message: 'Booking confirmed successfully',
      booking: {
        id: updated.id,
        yurt_id: updated.yurt_id,
        yurt_name: yurts.rows[0]?.name,
        date: updated.booking_date,
        time: updated.time_slot,
        status: updated.status,
        updated_at: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Error confirming booking:', error);
    return NextResponse.json(
      { error: 'Failed to confirm booking' },
      { status: 500 }
    );
  }
}
