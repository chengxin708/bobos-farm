import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const categories = await db`
      SELECT id, name, description, sort_order
      FROM menu_categories
      ORDER BY sort_order
    `;

    return NextResponse.json({
      categories: categories.rows.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        sort_order: c.sort_order
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
