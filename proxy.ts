import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const protectedCustomerRoutes = [
  '/menu',
  '/booking',
  '/reservations',
  '/pre-order',
  '/settings',
];

const adminRoutes = ['/admin'];

const authRoutes = ['/login', '/register'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Get JWT token (doesn't need Prisma); secureCookie required for NextAuth v5
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === 'https:',
  });
  const isLoggedIn = !!token;
  const userRole = token?.role as string | undefined;

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Protect customer routes
  if (
    !isLoggedIn &&
    protectedCustomerRoutes.some((route) => pathname.startsWith(route))
  ) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
    );
  }

  // Protect admin routes
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
