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

// GET dashboard stats
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get total users
    const userCount = await db`SELECT COUNT(*) as total FROM users`;

    // Get total bookings
    const bookingCount = await db`SELECT COUNT(*) as total FROM bookings`;

    // Get pending bookings
    const pendingBookings = await db`
      SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'
    `;

    // Get confirmed bookings
    const confirmedBookings = await db`
      SELECT COUNT(*) as total FROM bookings WHERE status = 'confirmed'
    `;

    // Get today's bookings
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = await db`
      SELECT COUNT(*) as total FROM bookings WHERE booking_date = ${today}
    `;

    // Get total orders
    const orderCount = await db`SELECT COUNT(*) as total FROM orders`;

    // Get recent bookings (last 5)
    const recentBookings = await db`
      SELECT 
        b.id,
        b.booking_date,
        b.time_slot,
        b.status,
        y.name as yurt_name,
        u.name as user_name
      FROM bookings b
      JOIN yurts y ON b.yurt_id = y.id
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `;

    // Get available yurts
    const yurts = await db`
      SELECT id, name, color FROM yurts WHERE available = true
    `;

    return NextResponse.json({
      stats: {
        totalUsers: parseInt(userCount.rows[0]?.total || '0'),
        totalBookings: parseInt(bookingCount.rows[0]?.total || '0'),
        pendingBookings: parseInt(pendingBookings.rows[0]?.total || '0'),
        confirmedBookings: parseInt(confirmedBookings.rows[0]?.total || '0'),
        todayBookings: parseInt(todayBookings.rows[0]?.total || '0'),
        totalOrders: parseInt(orderCount.rows[0]?.total || '0'),
        availableYurts: yurts.rows.length
      },
      recentBookings: recentBookings.rows,
      yurts: yurts.rows
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
