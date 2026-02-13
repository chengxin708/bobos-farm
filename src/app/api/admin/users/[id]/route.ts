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

// GET single user with booking history
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

    // Get user info
    const user = await db`
      SELECT 
        id,
        email,
        name,
        phone,
        email_verified,
        created_at
      FROM users
      WHERE id = ${id}
    `;

    if (user.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's bookings
    const bookings = await db`
      SELECT 
        b.id,
        b.yurt_id,
        b.booking_date,
        b.time_slot,
        b.status,
        b.zelle_reference,
        b.created_at,
        y.name as yurt_name
      FROM bookings b
      JOIN yurts y ON b.yurt_id = y.id
      WHERE b.user_id = ${id}
      ORDER BY b.created_at DESC
    `;

    // Get order count
    const orderCount = await db`
      SELECT COUNT(*) as total FROM orders WHERE user_id = ${id}
    `;

    return NextResponse.json({
      user: user.rows[0],
      bookings: bookings.rows,
      stats: {
        totalBookings: bookings.rows.length,
        totalOrders: parseInt(orderCount.rows[0]?.total || '0')
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}
