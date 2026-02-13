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

// GET single menu item
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

    const item = await db`
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
      WHERE m.id = ${id}
    `;

    if (item.rows.length === 0) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      item: item.rows[0]
    });

  } catch (error) {
    console.error('Error fetching menu item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu item' },
      { status: 500 }
    );
  }
}

// PATCH update menu item
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
    const { name, description, price, image_url, available, category_id } = body;

    // Check if item exists
    const existing = await db`SELECT id FROM menu_items WHERE id = ${id}`;
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(price);
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(image_url);
    }
    if (available !== undefined) {
      updates.push(`available = $${paramIndex++}`);
      values.push(available);
    }
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(category_id);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await db`
      UPDATE menu_items 
      SET ${db(updates.map((u, i) => db`${db(u.split('=')[0].trim()) = ${u.split('=')[1].trim()}`).join(', '))}
      WHERE id = ${id}
      RETURNING id, category_id, name, description, price, image_url, available
    `;

    // Simpler approach - update fields individually
    if (name !== undefined) {
      await db`UPDATE menu_items SET name = ${name} WHERE id = ${id}`;
    }
    if (description !== undefined) {
      await db`UPDATE menu_items SET description = ${description} WHERE id = ${id}`;
    }
    if (price !== undefined) {
      await db`UPDATE menu_items SET price = ${price} WHERE id = ${id}`;
    }
    if (image_url !== undefined) {
      await db`UPDATE menu_items SET image_url = ${image_url} WHERE id = ${id}`;
    }
    if (available !== undefined) {
      await db`UPDATE menu_items SET available = ${available} WHERE id = ${id}`;
    }
    if (category_id !== undefined) {
      await db`UPDATE menu_items SET category_id = ${category_id} WHERE id = ${id}`;
    }

    const updated = await db`
      SELECT id, category_id, name, description, price, image_url, available
      FROM menu_items WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      item: updated.rows[0]
    });

  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json(
      { error: 'Failed to update menu item' },
      { status: 500 }
    );
  }
}

// DELETE menu item
export async function DELETE(
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

    // Check if item exists
    const existing = await db`SELECT id FROM menu_items WHERE id = ${id}`;
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    await db`DELETE FROM menu_items WHERE id = ${id}`;

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted'
    });

  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 }
    );
  }
}
