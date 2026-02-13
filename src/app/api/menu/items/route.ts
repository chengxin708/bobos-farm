import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('booking_id');
    
    // Check if booking is confirmed (required to see prices)
    let showPrices = false;
    
    if (bookingId) {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
      
      if (token) {
        const payload = verifyToken(token);
        if (payload) {
          // Check if booking is confirmed
          const booking = await db`
            SELECT status FROM bookings WHERE id = ${bookingId} AND user_id = ${payload.userId}
          `;
          
          if (booking.rows.length > 0 && booking.rows[0].status === 'confirmed') {
            showPrices = true;
          }
        }
      }
    }

    // Get all menu items with category info
    const items = await db`
      SELECT 
        m.id,
        m.category_id,
        c.name as category_name,
        m.name,
        m.description,
        m.price,
        m.image_url,
        m.available
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      WHERE m.available = true
      ORDER BY c.sort_order, m.name
    `;

    // Group by category
    const menuByCategory: Record<number, {
      id: number;
      name: string;
      items: any[];
    }> = {};

    for (const item of items.rows) {
      if (!menuByCategory[item.category_id]) {
        menuByCategory[item.category_id] = {
          id: item.category_id,
          name: item.category_name,
          items: []
        };
      }
      
      menuByCategory[item.category_id].items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: showPrices ? item.price : null,
        image_url: item.image_url
      });
    }

    return NextResponse.json({
      categories: Object.values(menuByCategory),
      show_prices: showPrices
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}
