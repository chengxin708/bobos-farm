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

// GET all bookings (admin view)
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = db`
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
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone
      FROM bookings b
      JOIN yurts y ON b.yurt_id = y.id
      JOIN users u ON b.user_id = u.id
    `;

    if (status && status !== 'all') {
      query = db`
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
          u.name as user_name,
          u.email as user_email,
          u.phone as user_phone
        FROM bookings b
        JOIN yurts y ON b.yurt_id = y.id
        JOIN users u ON b.user_id = u.id
        WHERE b.status = ${status}
        ORDER BY b.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = db`
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
          u.name as user_name,
          u.email as user_email,
          u.phone as user_phone
        FROM bookings b
        JOIN yurts y ON b.yurt_id = y.id
        JOIN users u ON b.user_id = u.id
        ORDER BY b.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Get total count
    let countQuery;
    if (status && status !== 'all') {
      countQuery = db`SELECT COUNT(*) as total FROM bookings WHERE status = ${status}`;
    } else {
      countQuery = db`SELECT COUNT(*) as total FROM bookings`;
    }

    return NextResponse.json({
      bookings: (await query).rows,
      total: parseInt((await countQuery).rows[0]?.total || '0'),
      page,
      limit
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
