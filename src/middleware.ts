import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge-compatible middleware for route protection.
 * Uses getToken (JWT-only) instead of auth() to avoid importing Prisma on edge runtime.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow NextAuth's own API routes through unconditionally
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Protect /admin/* routes — must be authenticated with ADMIN role
  // Allow /admin/login through without auth
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
