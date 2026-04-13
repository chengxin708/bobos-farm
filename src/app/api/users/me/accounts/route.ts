import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/me/accounts
 * Returns linked OAuth providers for the current user.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        type: true,
      },
    });

    // Also check if user has a password set
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    return NextResponse.json({
      accounts,
      hasPassword: !!user?.passwordHash,
    });
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

/**
 * DELETE /api/users/me/accounts
 * Unlink an OAuth provider. Body: { provider: "google" }
 * Cannot unlink if it's the only login method (no password set).
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json({ error: "provider is required" }, { status: 400 });
    }

    // Check if user has a password — can't unlink if it's the only login method
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Cannot unlink — set a password first so you can still log in" },
        { status: 400 }
      );
    }

    // Delete the account link
    const deleted = await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unlink account:", error);
    return NextResponse.json({ error: "Failed to unlink account" }, { status: 500 });
  }
}
