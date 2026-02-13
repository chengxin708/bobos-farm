import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const yurts = await db`
      SELECT id, name, color, description, capacity, price, image_url
      FROM yurts
      ORDER BY id
    `;

    return NextResponse.json({ yurts: yurts.rows });
  } catch (error) {
    console.error('Error fetching yurts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch yurts' },
      { status: 500 }
    );
  }
}
