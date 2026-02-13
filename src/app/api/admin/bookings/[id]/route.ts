import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper to verify admin token
function verifyAdminToken(request: NextRequest): boolean {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;
  
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.startsWith('admin:');
  } catch {
    return false;
  }
}

// GET single booking (admin view)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const booking = await db`
      SELECT 
        b.id,
        b.user_id,
        b.yurt_id,
        b.booking_date,
        b.time_slot,
        b.status,
        b.zelle_reference,
        b.created_at,
        y.name as yurt_name,
        y.color as yurt_color,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone
      FROM bookings b
      JOIN yurts y ON b.yurt_id = y.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ${id}
    `;

    if (booking.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      booking: booking.rows[0]
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

// PATCH update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, zelle_reference } = body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Check if booking exists
    const existing = await db`SELECT id FROM bookings WHERE id = ${id}`;
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Build update query
    let updateQuery;
    if (status && zelle_reference !== undefined) {
      updateQuery = await db`
        UPDATE bookings 
        SET status = ${status}, zelle_reference = ${zego_reference || null}
        WHERE id = ${id}
        RETURNING id, status, zelle_reference
      `;
    } else if (status) {
      updateQuery = await db`
        UPDATE bookings 
        SET status = ${status}
        WHERE id = ${id}
        RETURNING id, status, zelle_reference
      `;
    } else if (zego_reference !== undefined) {
      updateQuery = await db`
        UPDATE bookings 
        SET zelle_reference = ${zego_reference || null}
        WHERE id = ${id}
        RETURNING id, status, zelle_reference
      `;
    } else {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      booking: updateQuery.rows[0]
    });

  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}
