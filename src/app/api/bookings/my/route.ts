import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
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

    // Get user's bookings with yurt info
    const bookings = await db`
      SELECT 
        b.id,
        b.yurt_id,
        y.name as yurt_name,
        y.color as yurt_color,
        y.image_url as yurt_image,
        b.booking_date,
        b.time_slot,
        b.status,
        b.created_at
      FROM bookings b
      JOIN yurts y ON b.yurt_id = y.id
      WHERE b.user_id = ${payload.userId}
      ORDER BY b.booking_date DESC, b.created_at DESC
    `;

    return NextResponse.json({
      bookings: bookings.rows.map(b => ({
        id: b.id,
        yurt_id: b.yurt_id,
        yurt_name: b.yurt_name,
        yurt_color: b.yurt_color,
        yurt_image: b.yurt_image,
        date: b.booking_date,
        time: b.time_slot,
        status: b.status,
        created_at: b.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
