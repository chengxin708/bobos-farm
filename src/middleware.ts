import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isBillHost, handleBillSubdomain } from "@/lib/bill/middleware";

/**
 * Edge-compatible middleware for route protection.
 * Uses getToken (JWT-only) instead of auth() to avoid importing Prisma on edge runtime.
 *
 * Subdomain routing:
 * - admin.bobos.farm → /admin/* routes
 * - bobos.farm → customer routes
 */
export async function middleware(request: NextRequest) {
  // ── Bill subdomain dispatch (must come first; bill has its own auth) ──
  const billHost = request.headers.get("host") ?? "";
  if (isBillHost(billHost)) {
    return handleBillSubdomain(request);
  }

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

  const cookieName = request.nextUrl.protocol === "https:"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  if (pathname.startsWith("/admin")) {
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

  // ── Protect /booking/* and /inquiries/new ── (phase 3.1 + 7)
  // The new booking flow assumes a logged-in customer so that claim,
  // merge and inquiry routing all work consistently — and so the inquiry
  // form can rely on session identity instead of asking for name/email
  // a second time. Anonymous users get bounced to login with the original
  // destination preserved.
  if (pathname.startsWith("/booking") || pathname === "/inquiries/new") {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      cookieName,
    });
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(loginUrl);
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
