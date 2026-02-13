import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function verifiedEmailMiddleware(request: NextRequest) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID not found' },
      { status: 401 }
    );
  }

  try {
    const users = await db`
      SELECT email_verified FROM users WHERE id = ${userId}
    `;

    if (users.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!users.rows[0].email_verified) {
      return NextResponse.json(
        { error: 'Email verification required', needsVerification: true },
        { status: 403 }
      );
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Email verification check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
