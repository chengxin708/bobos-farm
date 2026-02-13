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

    // Get order details
    const order = await db`
      SELECT 
        o.id,
        o.booking_id,
        o.user_id,
        o.total_amount,
        o.status,
        o.created_at,
        b.booking_date,
        b.time_slot,
        y.name as yurt_name
      FROM orders o
      JOIN bookings b ON o.booking_id = b.id
      JOIN yurts y ON b.yurt_id = y.id
      WHERE o.id = ${id}
    `;

    if (order.rows.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const orderData = order.rows[0];

    // Check if user owns this order (or is admin)
    if (orderData.user_id !== payload.userId) {
      return NextResponse.json(
        { error: 'Unauthorized to view this order' },
        { status: 403 }
      );
    }

    // Get order items
    const orderItems = await db`
      SELECT 
        oi.id,
        oi.menu_item_id,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        mi.name as item_name,
        mi.description as item_description,
        mi.image_url
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ${id}
    `;

    return NextResponse.json({
      order: {
        id: orderData.id,
        booking_id: orderData.booking_id,
        booking_date: orderData.booking_date,
        time_slot: orderData.time_slot,
        yurt_name: orderData.yurt_name,
        total_amount: orderData.total_amount,
        status: orderData.status,
        created_at: orderData.created_at,
        items: orderItems.rows.map((item: any) => ({
          id: item.id,
          menu_item_id: item.menu_item_id,
          name: item.item_name,
          description: item.item_description,
          image_url: item.image_url,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
