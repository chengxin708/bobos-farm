import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(
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

    const { id } = await params;

    // Get booking details
    const booking = await db`
      SELECT 
        b.id,
        b.user_id,
        b.yurt_id,
        b.date,
        b.time,
        b.status,
        b.zelle_reference,
        b.created_at,
        y.name as yurt_name,
        y.color as yurt_color
      FROM bookings b
      JOIN yurts y ON b.yurt_id = y.id
      WHERE b.id = ${id}
    `;

    if (booking.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const bookingData = booking.rows[0];

    // Check if user owns this booking (or is admin)
    if (bookingData.user_id !== payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized to view this booking' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      booking: {
        id: bookingData.id,
        yurt_name: bookingData.yurt_name,
        yurt_color: bookingData.yurt_color,
        date: bookingData.date,
        time: bookingData.time,
        status: bookingData.status,
        zelle_reference: bookingData.zelle_reference,
        created_at: bookingData.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}
