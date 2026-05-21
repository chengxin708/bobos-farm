import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "./session";

const BILL_HOSTS = new Set(["bill.bobosfarm.com"]);

export function isBillHost(host: string): boolean {
  if (!host) return false;
  if (BILL_HOSTS.has(host)) return true;
  // Local dev: bill.localhost or bill.localhost:<port>
  return host === "bill.localhost" || host.startsWith("bill.localhost:");
}

export type BillPathClass =
  | { kind: "public"; rewriteTo?: string }
  | { kind: "authed"; rewriteTo?: string }
  | { kind: "forbidden" };

export function classifyBillPath(pathname: string): BillPathClass {
  // Direct external access to internal prefix is forbidden.
  if (pathname === "/panel" || pathname.startsWith("/panel/")) {
    return { kind: "forbidden" };
  }
  // Auth API and public receipt page.
  if (pathname === "/api/bill/auth") return { kind: "public" };
  if (pathname === "/r" || pathname.startsWith("/r/")) return { kind: "public" };
  // Password screen: public, rewrites to internal /panel.
  if (pathname === "/") return { kind: "public", rewriteTo: "/panel" };
  // Authed admin pages — rewrite to internal /panel prefix.
  if (pathname === "/list") return { kind: "authed", rewriteTo: "/panel/list" };
  if (pathname === "/new") return { kind: "authed", rewriteTo: "/panel/new" };
  if (pathname.startsWith("/edit/")) {
    return { kind: "authed", rewriteTo: `/panel${pathname}` };
  }
  // Authed API — no rewrite needed.
  if (pathname.startsWith("/api/bill/")) return { kind: "authed" };
  // Read-only menu endpoint needed by the menu picker on the bill subdomain.
  if (pathname === "/api/menu/items") return { kind: "authed" };
  return { kind: "forbidden" };
}

export function handleBillSubdomain(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const cls = classifyBillPath(pathname);

  if (cls.kind === "forbidden") {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (cls.kind === "authed") {
    const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const { ok } = verifySession(cookie);
    if (!ok) {
      // For API, return 401; for pages, redirect to /.
      if (pathname.startsWith("/api/bill/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (cls.rewriteTo) {
    const url = req.nextUrl.clone();
    url.pathname = cls.rewriteTo;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}
