import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

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
    const { booking_id, items } = body;

    if (!booking_id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Booking ID and items are required' },
        { status: 400 }
      );
    }

    // Validate booking exists and belongs to user
    const booking = await db`
      SELECT id, status FROM bookings WHERE id = ${booking_id} AND user_id = ${payload.userId}
    `;

    if (booking.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.rows[0].status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Booking must be confirmed before placing an order' },
        { status: 400 }
      );
    }

    // Validate items and get prices
    const menuItemIds = items.map((item: any) => item.menu_item_id);
    
    if (menuItemIds.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }
    
    // Use a simple approach - get all available items and filter
    const allMenuItems = await db`
      SELECT id, name, price FROM menu_items WHERE available = true
    `;
    
    const menuItemMap = new Map(allMenuItems.rows.map((item: any) => [item.id, item]));
    
    // Filter to only requested items
    const requestedItems = menuItemIds.map((id: number) => menuItemMap.get(id)).filter(Boolean);

    if (requestedItems.length !== items.length) {
      return NextResponse.json(
        { error: 'Some menu items are not available' },
        { status: 400 }
      );
    }

    // Calculate total and prepare order items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menu_item_id);
      if (!menuItem) continue;
      
      const quantity = item.quantity || 1;
      const unitPrice = parseFloat(menuItem.price);
      const subtotal = unitPrice * quantity;
      
      totalAmount += subtotal;
      
      orderItems.push({
        menu_item_id: item.menu_item_id,
        quantity,
        unit_price: unitPrice,
        subtotal
      });
    }

    // Create order in transaction
    const orderResult = await db`
      INSERT INTO orders (booking_id, user_id, total_amount, status)
      VALUES (${booking_id}, ${payload.userId}, ${totalAmount}, 'pending')
      RETURNING id, booking_id, total_amount, status, created_at
    `;

    const order = orderResult.rows[0];

    // Insert order items
    for (const item of orderItems) {
      await db`
        INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
        VALUES (${order.id}, ${item.menu_item_id}, ${item.quantity}, ${item.unit_price}, ${item.subtotal})
      `;
    }

    // Get order details with items
    const orderDetails = await db`
      SELECT 
        o.id,
        o.booking_id,
        o.total_amount,
        o.status,
        o.created_at,
        oi.menu_item_id,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        mi.name as item_name,
        mi.description as item_description
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.id = ${order.id}
    `;

    return NextResponse.json({
      message: 'Order created successfully',
      order: {
        id: order.id,
        booking_id: order.booking_id,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        items: orderDetails.rows.map((item: any) => ({
          menu_item_id: item.menu_item_id,
          name: item.item_name,
          description: item.item_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        }))
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
