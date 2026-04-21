import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { recordContactsFromUser } from "@/lib/contact-history";
import { claimReservation } from "@/lib/claim-flow";
import { ipFromRequest, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // 5 register attempts / IP / hour. Low because real users only
    // register once; higher than that smells like enumeration.
    const rl = rateLimit(`register:${ipFromRequest(req)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many registration attempts", retryAfterSeconds: rl.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, password, preferredLanguage, marketingOptIn, claimCode, claimToken } = result.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: "CUSTOMER",
        preferredLanguage,
        marketingOptIn,
        unsubscribeToken: crypto.randomUUID(),
      },
    });

    // Seed initial contact entries (self-registered)
    await recordContactsFromUser(prisma, user, "self", user.id);

    // Optional: claim a reservation in the same request. We deliberately
    // don't let claim failures block the registration — the user can
    // retry the claim after signing in. The client receives the claim
    // result so it can show the right success banner.
    let claim: Awaited<ReturnType<typeof claimReservation>> | null = null;
    if (claimCode && claimToken) {
      try {
        claim = await claimReservation(prisma, {
          userId: user.id,
          isAdmin: false,
          code: claimCode,
          token: claimToken,
        });
      } catch (err) {
        console.error("[register] inline claim failed:", err);
        claim = null;
      }
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        claim,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
