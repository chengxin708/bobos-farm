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

// GET all menu items with categories (admin view - shows all items including unavailable)
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all categories
    const categories = await db`
      SELECT id, name, description, sort_order
      FROM menu_categories
      ORDER BY sort_order
    `;

    // Get all menu items
    const items = await db`
      SELECT 
        m.id,
        m.category_id,
        m.name,
        m.description,
        m.price,
        m.image_url,
        m.available,
        c.name as category_name
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      ORDER BY c.sort_order, m.name
    `;

    // Group by category
    const menuByCategory: Record<number, {
      id: number;
      name: string;
      description: string;
      items: any[];
    }> = {};

    for (const cat of categories.rows) {
      menuByCategory[cat.id] = {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        items: []
      };
    }

    for (const item of items.rows) {
      if (menuByCategory[item.category_id]) {
        menuByCategory[item.category_id].items.push({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image_url: item.image_url,
          available: item.available
        });
      }
    }

    return NextResponse.json({
      categories: Object.values(menuByCategory)
    });

  } catch (error) {
    console.error('Error fetching menu:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
      { status: 500 }
    );
  }
}

// POST create new menu item
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { category_id, name, description, price, image_url, available } = body;

    // Validate required fields
    if (!category_id || !name || price === undefined) {
      return NextResponse.json(
        { error: 'category_id, name, and price are required' },
        { status: 400 }
      );
    }

    // Check if category exists
    const category = await db`SELECT id FROM menu_categories WHERE id = ${category_id}`;
    if (category.rows.length === 0) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Create menu item
    const result = await db`
      INSERT INTO menu_items (category_id, name, description, price, image_url, available)
      VALUES (${category_id}, ${name}, ${description || ''}, ${price}, ${image_url || null}, ${available !== false})
      RETURNING id, category_id, name, description, price, image_url, available
    `;

    return NextResponse.json({
      success: true,
      item: result.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating menu item:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    );
  }
}
