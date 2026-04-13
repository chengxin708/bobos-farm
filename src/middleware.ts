import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge-compatible middleware for route protection.
 * Uses getToken (JWT-only) instead of auth() to avoid importing Prisma on edge runtime.
 *
 * Subdomain routing:
 * - admin.bobos.farm → /admin/* routes
 * - bobos.farm → customer routes
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Detect admin subdomain (admin.bobos.farm or admin.localhost:3000)
  const isAdminSubdomain =
    hostname.startsWith("admin.bobos.farm") ||
    hostname.startsWith("admin.localhost");

  // Allow NextAuth's own API routes through unconditionally
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // ── Admin subdomain handling ──
  if (isAdminSubdomain) {
    // Root of admin subdomain → redirect to dashboard
    if (pathname === "/" || pathname === "") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    // If path doesn't start with /admin or /api, prefix with /admin
    // e.g. admin.bobos.farm/reservations → /admin/reservations
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
      return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url));
    }
  }

  // ── Protect /admin/* routes ──
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    // In production (HTTPS), cookie name has __Secure- prefix
    const cookieName = request.nextUrl.protocol === "https:"
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName,
    });

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
  matcher: [
    "/admin/:path*",
    // Also match root and all paths on admin subdomain
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw).*)",
  ],
};
