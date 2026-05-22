import { classifyBillPath, isBillHost, handleBillSubdomain } from "../middleware";
import { NextRequest } from "next/server";
import { signSession, newSessionExpiresAt, SESSION_COOKIE_NAME } from "../session";

describe("isBillHost", () => {
  it("matches production host", () => {
    expect(isBillHost("bill.bobos.farm")).toBe(true);
  });
  it("matches localhost variants", () => {
    expect(isBillHost("bill.localhost:3000")).toBe(true);
    expect(isBillHost("bill.localhost")).toBe(true);
  });
  it("does not match main host or unrelated domains", () => {
    expect(isBillHost("bobos.farm")).toBe(false);
    expect(isBillHost("www.bobos.farm")).toBe(false);
    expect(isBillHost("bill.bobosfarm.com")).toBe(false);
    expect(isBillHost("")).toBe(false);
  });
});

describe("classifyBillPath", () => {
  it("public paths bypass auth", () => {
    expect(classifyBillPath("/")).toEqual({ kind: "public", rewriteTo: "/panel" });
    expect(classifyBillPath("/api/bill/auth")).toEqual({ kind: "public" });
    expect(classifyBillPath("/r/abc123")).toEqual({ kind: "public" });
  });

  it("authed paths require session and rewrite to /panel prefix", () => {
    expect(classifyBillPath("/list")).toEqual({ kind: "authed", rewriteTo: "/panel/list" });
    expect(classifyBillPath("/new")).toEqual({ kind: "authed", rewriteTo: "/panel/new" });
    expect(classifyBillPath("/edit/abc")).toEqual({ kind: "authed", rewriteTo: "/panel/edit/abc" });
  });

  it("api/bill/receipts paths are authed without rewrite", () => {
    expect(classifyBillPath("/api/bill/receipts")).toEqual({ kind: "authed" });
    expect(classifyBillPath("/api/bill/receipts/abc")).toEqual({ kind: "authed" });
  });

  it("internal panel prefix is forbidden", () => {
    expect(classifyBillPath("/panel")).toEqual({ kind: "forbidden" });
    expect(classifyBillPath("/panel/list")).toEqual({ kind: "forbidden" });
  });

  it("unknown paths are forbidden", () => {
    expect(classifyBillPath("/admin")).toEqual({ kind: "forbidden" });
    expect(classifyBillPath("/menu")).toEqual({ kind: "forbidden" });
  });

  it("allows /api/menu/items as authed read", () => {
    expect(classifyBillPath("/api/menu/items")).toEqual({ kind: "authed" });
  });
});

function makeReq(path: string, opts: { cookie?: string } = {}): NextRequest {
  const req = new NextRequest(new URL(`http://bill.localhost:3000${path}`));
  if (opts.cookie) {
    req.cookies.set(SESSION_COOKIE_NAME, opts.cookie);
  }
  return req;
}

describe("handleBillSubdomain", () => {
  beforeEach(() => {
    process.env.BILL_SESSION_SECRET = "test-secret-for-middleware-tests";
  });

  it("404s forbidden paths", async () => {
    const res = await handleBillSubdomain(makeReq("/admin"));
    expect(res.status).toBe(404);
  });

  it("404s direct access to /panel", async () => {
    const res = await handleBillSubdomain(makeReq("/panel/list"));
    expect(res.status).toBe(404);
  });

  it("401 JSON for unauthenticated API paths", async () => {
    const res = await handleBillSubdomain(makeReq("/api/bill/receipts"));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("redirects unauthenticated page paths to /", async () => {
    const res = await handleBillSubdomain(makeReq("/list"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/");
  });

  it("rewrites authed page paths to /panel prefix when session valid", async () => {
    const cookie = await signSession(newSessionExpiresAt());
    const res = await handleBillSubdomain(makeReq("/list", { cookie }));
    // Rewrite responses set x-middleware-rewrite header in Next.js
    const rewrite = res.headers.get("x-middleware-rewrite");
    expect(rewrite).toContain("/panel/list");
  });

  it("passes through /api/bill/auth without a cookie", async () => {
    const res = await handleBillSubdomain(makeReq("/api/bill/auth"));
    // Public path, no rewrite → next()
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("rewrites / to /panel (public)", async () => {
    const res = await handleBillSubdomain(makeReq("/"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/panel");
  });
});
