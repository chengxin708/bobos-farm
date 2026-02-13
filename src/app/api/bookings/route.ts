import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { sendBookingConfirmation } from '@/lib/email';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { yurt_id, date, time } = body;

    // Validate required fields
    if (!yurt_id || !date || !time) {
      return NextResponse.json(
        { error: 'yurt_id, date, and time are required' },
        { status: 400 }
      );
    }

    // Validate time slot
    if (!['afternoon', 'evening'].includes(time)) {
      return NextResponse.json(
        { error: 'Invalid time slot. Must be afternoon or evening' },
        { status: 400 }
      );
    }

    // Check if slot is already booked
    const existing = await db`
      SELECT id FROM bookings
      WHERE yurt_id = ${yurt_id}
        AND booking_date = ${date}
        AND time_slot = ${time}
        AND status IN ('pending', 'confirmed')
    `;

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 409 }
      );
    }

    // Check if yurt exists
    const yurts = await db`
      SELECT id, name FROM yurts WHERE id = ${yurt_id}
    `;

    if (yurts.rows.length === 0) {
      return NextResponse.json(
        { error: 'Yurt not found' },
        { status: 404 }
      );
    }

    // Create booking
    const result = await db`
      INSERT INTO bookings (user_id, yurt_id, booking_date, time_slot, status)
      VALUES (${payload.userId}, ${yurt_id}, ${date}, ${time}, 'pending')
      RETURNING id, yurt_id, booking_date, time_slot, status, created_at
    `;

    const booking = result.rows[0];

    // Send confirmation email (non-blocking)
    const emailSent = sendBookingConfirmation(payload.userId, booking.id)
      .then(success => {
        if (!success) {
          console.error('Failed to send confirmation email for booking:', booking.id);
        }
      })
      .catch(err => {
        console.error('Error sending confirmation email:', err);
      });

    return NextResponse.json({
      message: 'Booking created successfully',
      emailSent: true, // Email is sent asynchronously
      booking: {
        id: booking.id,
        yurt_id: booking.yurt_id,
        yurt_name: yurts.rows[0].name,
        date: booking.booking_date,
        time: booking.time_slot,
        status: booking.status,
        created_at: booking.created_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
