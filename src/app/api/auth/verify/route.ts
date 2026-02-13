import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/verify?error=missing_token', request.url));
    }

    // Find verification token
    const verification = await db`
      SELECT ev.id, ev.user_id, ev.expires_at, ev.used, u.email
      FROM email_verifications ev
      JOIN users u ON u.id = ev.user_id
      WHERE ev.token = ${token}
    `;

    if (verification.rows.length === 0) {
      return NextResponse.redirect(new URL('/verify?error=invalid_token', request.url));
    }

    const record = verification.rows[0];

    // Check if token already used
    if (record.used) {
      return NextResponse.redirect(new URL('/verify?error=already_verified', request.url));
    }

    // Check if token expired
    if (new Date(record.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/verify?error=expired_token', request.url));
    }

    // Mark token as used
    await db`
      UPDATE email_verifications
      SET used = true
      WHERE id = ${record.id}
    `;

    // Update user as verified
    await db`
      UPDATE users
      SET email_verified = true, updated_at = now()
      WHERE id = ${record.user_id}
    `;

    return NextResponse.redirect(new URL('/verify?success=true', request.url));

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/verify?error=server_error', request.url));
  }
}
