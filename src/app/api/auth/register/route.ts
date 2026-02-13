import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { generateVerificationToken, getVerificationExpiry, sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, phone, name } = body;

    // Validate required fields
    if (!email || !password || !phone) {
      return NextResponse.json(
        { error: 'Email, password, and phone are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = crypto.randomUUID();
    await db`
      INSERT INTO users (id, email, password_hash, phone, name, email_verified)
      VALUES (${userId}, ${email}, ${passwordHash}, ${phone}, ${name || null}, false)
    `;

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = getVerificationExpiry();

    await db`
      INSERT INTO email_verifications (id, user_id, token, expires_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${verificationToken}, ${expiresAt.toISOString()})
    `;

    // Send verification email (async, don't wait)
    sendVerificationEmail(email, verificationToken).catch(console.error);

    // Return user info (without password)
    return NextResponse.json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: userId,
        email,
        phone,
        name: name || null,
        emailVerified: false
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
