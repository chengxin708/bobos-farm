# Bill Subdomain Quick-Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a throwaway admin tool on `bill.bobosfarm.com` for picking menu items, computing totals with NY tax, saving receipts to a public token URL, and sharing via `sms:` link.

**Architecture:** All code isolated under `src/app/(bill)/`, `src/app/api/bill/`, `src/lib/bill/`. Two new Prisma tables (`quick_receipts`, `quick_receipt_items`). Subdomain dispatched in `proxy.ts` via host check + path rewrite to internal `/_bill/...` paths. Password-only gate, signed httpOnly cookie session.

**Tech Stack:** Next.js 16 App Router, Prisma 6, ts-jest, Tailwind, lucide-react, zod for validation, `crypto.randomBytes` for tokens (no nanoid dep).

**Spec:** `docs/superpowers/specs/2026-05-21-bill-subdomain-design.md`

---

## File Structure

```
prisma/
  schema.prisma                              MODIFY (add 2 models)
  migrations/<timestamp>_bill/migration.sql  CREATE
  seed-settings-v2.ts                        MODIFY (append tax_rate)

src/lib/bill/                                CREATE (whole folder)
  totals.ts                                  computeTotals + cents helpers
  token.ts                                   generateReceiptToken
  password.ts                                verify + per-IP throttle
  session.ts                                 sign/verify httpOnly cookie
  middleware.ts                              handleBillSubdomain(req)
  __tests__/
    totals.test.ts
    token.test.ts
    password.test.ts
    session.test.ts
    middleware.test.ts

proxy.ts                                     MODIFY (host branch at top)

src/app/api/bill/                            CREATE
  auth/route.ts                              POST password → set cookie
  receipts/route.ts                          GET list, POST create
  receipts/[id]/route.ts                     GET / PATCH / DELETE

src/app/(bill)/                              CREATE (whole route group)
  layout.tsx                                 minimal shared layout (no AdminTopBar)
  _bill/
    layout.tsx                               authed area layout
    page.tsx                                 password screen
    list/page.tsx                            history list
    new/page.tsx                             editor (server component shell)
    edit/[id]/page.tsx                       editor (server component shell)
  r/[token]/page.tsx                         PUBLIC receipt
  components/
    ReceiptEditor.tsx                        shared client component for new+edit
    MenuPickerSheet.tsx                      bottom sheet
    ShareDialog.tsx                          post-save share UI
    TipBlock.tsx                             tip suggestion (used on public page)

src/app/(admin)/admin/settings/page.tsx      MODIFY (add tax_rate field)
messages/en.json                             MODIFY (settings.taxRate, taxRateHelp)
messages/zh.json                             MODIFY (settings.taxRate, taxRateHelp)
```

---

## Task 1: Prisma schema — QuickReceipt + QuickReceiptItem

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Append at the end of `prisma/schema.prisma`, before the final closing brace if any (file uses flat top-level models):

```prisma
// ============ BILL (quick receipt subdomain) ============

model QuickReceipt {
  id            String   @id @default(cuid())
  token         String   @unique
  customerName  String
  customerPhone String?
  notes         String?
  taxRate       Float
  subtotalCents Int
  discountCents Int      @default(0)
  taxCents      Int
  totalCents    Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  items         QuickReceiptItem[]

  @@index([createdAt])
  @@index([token])
  @@map("quick_receipts")
}

model QuickReceiptItem {
  id         String   @id @default(cuid())
  receiptId  String
  menuItemId String?
  nameEnSnap String
  nameZhSnap String?
  priceCents Int
  quantity   Int
  sortOrder  Int      @default(0)
  receipt    QuickReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)

  @@index([receiptId])
  @@map("quick_receipt_items")
}
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name bill_quick_receipts`
Expected: creates `prisma/migrations/<timestamp>_bill_quick_receipts/migration.sql`, runs it against the dev database, regenerates Prisma client.

If migration fails (e.g. dev DB not reachable), stop and surface the error rather than proceeding.

- [ ] **Step 3: Verify schema by querying with Prisma client**

Run: `npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.quickReceipt.count().then(n => { console.log('count:', n); return p.\$disconnect(); });"`
Expected: prints `count: 0` and exits cleanly.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(bill): add QuickReceipt and QuickReceiptItem models"
```

---

## Task 2: Seed tax_rate SystemSetting

**Files:**
- Modify: `prisma/seed-settings-v2.ts`

- [ ] **Step 1: Append the setting to `NEW_SETTINGS`**

Find the `NEW_SETTINGS` array. Just before the closing `];`, add:

```ts
  // Tax
  {
    key: "tax_rate",
    value: "0.08",
    description: "Sales tax rate as a decimal (Ulster County, NY = 0.08)",
  },
```

- [ ] **Step 2: Run the seed**

Run: `npm run db:seed-settings`
Expected: prints `OK tax_rate = 0.08` (or skipped if already present).

- [ ] **Step 3: Verify**

Run: `npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.systemSetting.findUnique({ where: { key: 'tax_rate' } }).then(s => { console.log(s); return p.\$disconnect(); });"`
Expected: prints an object with `value: '0.08'`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-settings-v2.ts
git commit -m "feat(settings): seed tax_rate (Ulster County NY 8%)"
```

---

## Task 3: Pure totals math (`src/lib/bill/totals.ts`)

**Files:**
- Create: `src/lib/bill/totals.ts`
- Test: `src/lib/bill/__tests__/totals.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/bill/__tests__/totals.test.ts`:

```ts
import { computeTotals, dollarsToCents, centsToDollarString } from "../totals";

describe("computeTotals", () => {
  it("sums items and applies tax", () => {
    const r = computeTotals(
      [{ priceCents: 1000, quantity: 2 }, { priceCents: 500, quantity: 1 }],
      0,
      0.08,
    );
    expect(r.subtotalCents).toBe(2500);
    expect(r.discountCents).toBe(0);
    expect(r.taxCents).toBe(200);
    expect(r.totalCents).toBe(2700);
  });

  it("applies discount before tax", () => {
    const r = computeTotals([{ priceCents: 10000, quantity: 1 }], 500, 0.1);
    expect(r.subtotalCents).toBe(10000);
    expect(r.discountCents).toBe(500);
    expect(r.taxCents).toBe(950);
    expect(r.totalCents).toBe(10450);
  });

  it("clamps discount that exceeds subtotal", () => {
    const r = computeTotals([{ priceCents: 100, quantity: 1 }], 999, 0.08);
    expect(r.discountCents).toBe(100);
    expect(r.taxCents).toBe(0);
    expect(r.totalCents).toBe(0);
  });

  it("rejects negative discount by clamping to 0", () => {
    const r = computeTotals([{ priceCents: 100, quantity: 1 }], -50, 0);
    expect(r.discountCents).toBe(0);
  });

  it("rounds tax half-away-from-zero", () => {
    // 333 * 0.08 = 26.64 → 27
    const r = computeTotals([{ priceCents: 333, quantity: 1 }], 0, 0.08);
    expect(r.taxCents).toBe(27);
  });

  it("returns zero totals for empty items", () => {
    const r = computeTotals([], 0, 0.08);
    expect(r).toEqual({ subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe("dollarsToCents / centsToDollarString", () => {
  it("converts string '12.34' → 1234", () => {
    expect(dollarsToCents("12.34")).toBe(1234);
  });

  it("converts string '12' → 1200", () => {
    expect(dollarsToCents("12")).toBe(1200);
  });

  it("rejects invalid input (NaN-safe)", () => {
    expect(dollarsToCents("abc")).toBe(0);
    expect(dollarsToCents("")).toBe(0);
  });

  it("formats 1234 → '12.34'", () => {
    expect(centsToDollarString(1234)).toBe("12.34");
  });

  it("formats 0 → '0.00'", () => {
    expect(centsToDollarString(0)).toBe("0.00");
  });

  it("formats 5 → '0.05'", () => {
    expect(centsToDollarString(5)).toBe("0.05");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx jest src/lib/bill/__tests__/totals.test.ts`
Expected: FAIL — `Cannot find module '../totals'`.

- [ ] **Step 3: Implement**

Create `src/lib/bill/totals.ts`:

```ts
export interface ReceiptItemInput {
  priceCents: number;
  quantity: number;
}

export interface ComputedTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export function computeTotals(
  items: ReceiptItemInput[],
  discountCents: number,
  taxRate: number,
): ComputedTotals {
  const subtotalCents = items.reduce(
    (acc, i) => acc + i.priceCents * i.quantity,
    0,
  );
  const clampedDiscount = Math.max(0, Math.min(discountCents, subtotalCents));
  const taxableCents = subtotalCents - clampedDiscount;
  const taxCents = Math.round(taxableCents * taxRate);
  const totalCents = taxableCents + taxCents;
  return { subtotalCents, discountCents: clampedDiscount, taxCents, totalCents };
}

export function dollarsToCents(input: string): number {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToDollarString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${dollars}.${remainder.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `npx jest src/lib/bill/__tests__/totals.test.ts`
Expected: 12+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill/totals.ts src/lib/bill/__tests__/totals.test.ts
git commit -m "feat(bill): pure totals math (cents-based, deterministic rounding)"
```

---

## Task 4: Receipt token generation (`src/lib/bill/token.ts`)

**Files:**
- Create: `src/lib/bill/token.ts`
- Test: `src/lib/bill/__tests__/token.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/bill/__tests__/token.test.ts`:

```ts
import { generateReceiptToken } from "../token";

describe("generateReceiptToken", () => {
  it("is url-safe base64 of expected length", () => {
    // 16 random bytes → 22 base64url chars (no padding)
    const t = generateReceiptToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("never collides across many draws", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateReceiptToken());
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx jest src/lib/bill/__tests__/token.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/bill/token.ts`:

```ts
import crypto from "crypto";

// 16 random bytes → 22 base64url chars → ~96 bits of entropy.
// Unguessable, comfortably collision-resistant for our scale.
export function generateReceiptToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}
```

- [ ] **Step 4: Pass**

Run: `npx jest src/lib/bill/__tests__/token.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill/token.ts src/lib/bill/__tests__/token.test.ts
git commit -m "feat(bill): receipt token generator (96-bit entropy)"
```

---

## Task 5: Password verification + throttle (`src/lib/bill/password.ts`)

**Files:**
- Create: `src/lib/bill/password.ts`
- Test: `src/lib/bill/__tests__/password.test.ts`
- Modify: `.env.example` (if it exists; otherwise skip)

- [ ] **Step 1: Write failing tests**

Create `src/lib/bill/__tests__/password.test.ts`:

```ts
import { verifyBillPassword, resetThrottle } from "../password";

describe("verifyBillPassword", () => {
  beforeEach(() => {
    process.env.BILL_PASSWORD = "888888";
    resetThrottle();
  });

  it("accepts matching password", () => {
    expect(verifyBillPassword("888888", "1.2.3.4").ok).toBe(true);
  });

  it("rejects mismatched password", () => {
    expect(verifyBillPassword("wrong", "1.2.3.4").ok).toBe(false);
  });

  it("rejects when env var is unset", () => {
    delete process.env.BILL_PASSWORD;
    expect(verifyBillPassword("888888", "1.2.3.4").ok).toBe(false);
  });

  it("throttles after 5 failed attempts per IP within 10 min", () => {
    for (let i = 0; i < 5; i++) {
      verifyBillPassword("wrong", "1.2.3.4");
    }
    const r = verifyBillPassword("888888", "1.2.3.4");
    expect(r.ok).toBe(false);
    expect(r.throttled).toBe(true);
  });

  it("throttle is per-IP", () => {
    for (let i = 0; i < 5; i++) verifyBillPassword("wrong", "1.2.3.4");
    expect(verifyBillPassword("888888", "5.6.7.8").ok).toBe(true);
  });

  it("uses constant-time compare to mitigate timing leaks", () => {
    // Smoke test: long mismatch returns same result class as short mismatch.
    expect(verifyBillPassword("x", "ip").ok).toBe(false);
    expect(verifyBillPassword("a".repeat(1000), "ip2").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx jest src/lib/bill/__tests__/password.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/bill/password.ts`:

```ts
import crypto from "crypto";

interface IpEntry {
  fails: number;
  firstFailAt: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const attempts = new Map<string, IpEntry>();

export function resetThrottle(): void {
  attempts.clear();
}

function isThrottled(ip: string, now: number): boolean {
  const e = attempts.get(ip);
  if (!e) return false;
  if (now - e.firstFailAt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return e.fails >= MAX_FAILS;
}

function recordFail(ip: string, now: number): void {
  const e = attempts.get(ip);
  if (!e || now - e.firstFailAt > WINDOW_MS) {
    attempts.set(ip, { fails: 1, firstFailAt: now });
  } else {
    e.fails += 1;
  }
}

export function verifyBillPassword(
  input: string,
  ip: string,
): { ok: boolean; throttled?: boolean } {
  const now = Date.now();
  if (isThrottled(ip, now)) return { ok: false, throttled: true };

  const expected = process.env.BILL_PASSWORD;
  if (!expected) {
    recordFail(ip, now);
    return { ok: false };
  }

  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  const equalLength = a.length === b.length;
  // Constant-time compare on equal-length buffers; if lengths differ,
  // compare a against itself to keep timing similar then return false.
  const matched = equalLength
    ? crypto.timingSafeEqual(a, b)
    : (crypto.timingSafeEqual(a, a), false);

  if (matched) {
    attempts.delete(ip);
    return { ok: true };
  }
  recordFail(ip, now);
  return { ok: false };
}
```

- [ ] **Step 4: Pass**

Run: `npx jest src/lib/bill/__tests__/password.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill/password.ts src/lib/bill/__tests__/password.test.ts
git commit -m "feat(bill): password verification with per-IP throttle"
```

---

## Task 6: Session cookie sign/verify (`src/lib/bill/session.ts`)

**Files:**
- Create: `src/lib/bill/session.ts`
- Test: `src/lib/bill/__tests__/session.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/bill/__tests__/session.test.ts`:

```ts
import { signSession, verifySession, SESSION_COOKIE_NAME } from "../session";

describe("session", () => {
  beforeEach(() => {
    process.env.BILL_SESSION_SECRET = "test-secret-do-not-use-in-prod";
  });

  it("signs a session with an expiresAt and verifies it back", () => {
    const expiresAt = Date.now() + 60_000;
    const cookie = signSession(expiresAt);
    expect(cookie.split(".")).toHaveLength(2);
    expect(verifySession(cookie).ok).toBe(true);
  });

  it("rejects tampered signature", () => {
    const cookie = signSession(Date.now() + 60_000);
    const [exp, sig] = cookie.split(".");
    const tampered = `${exp}.${sig.replace(/[A-Za-z]/, "X")}`;
    expect(verifySession(tampered).ok).toBe(false);
  });

  it("rejects expired session", () => {
    const cookie = signSession(Date.now() - 1_000);
    expect(verifySession(cookie).ok).toBe(false);
  });

  it("rejects malformed cookie", () => {
    expect(verifySession("garbage").ok).toBe(false);
    expect(verifySession("a.b.c").ok).toBe(false);
    expect(verifySession("").ok).toBe(false);
  });

  it("rejects when secret is unset", () => {
    delete process.env.BILL_SESSION_SECRET;
    expect(() => signSession(Date.now() + 60_000)).toThrow();
  });

  it("exposes a constant cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("bill_session");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx jest src/lib/bill/__tests__/session.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/bill/session.ts`:

```ts
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "bill_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.BILL_SESSION_SECRET;
  if (!s) throw new Error("BILL_SESSION_SECRET is not set");
  return s;
}

function hmac(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function signSession(expiresAt: number): string {
  const exp = String(expiresAt);
  return `${exp}.${hmac(exp)}`;
}

export function verifySession(cookie: string | undefined): { ok: boolean } {
  if (!cookie) return { ok: false };
  const parts = cookie.split(".");
  if (parts.length !== 2) return { ok: false };
  const [exp, sig] = parts;
  if (!exp || !sig) return { ok: false };
  let expected: string;
  try {
    expected = hmac(exp);
  } catch {
    return { ok: false };
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false };
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() >= expNum) return { ok: false };
  return { ok: true };
}

export function newSessionExpiresAt(): number {
  return Date.now() + SESSION_TTL_MS;
}
```

- [ ] **Step 4: Pass**

Run: `npx jest src/lib/bill/__tests__/session.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill/session.ts src/lib/bill/__tests__/session.test.ts
git commit -m "feat(bill): signed session cookie (HMAC-SHA256, 7d TTL)"
```

---

## Task 7: Subdomain middleware + proxy.ts integration

**Files:**
- Create: `src/lib/bill/middleware.ts`
- Test: `src/lib/bill/__tests__/middleware.test.ts`
- Modify: `proxy.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/bill/__tests__/middleware.test.ts`:

```ts
import { classifyBillPath, isBillHost } from "../middleware";

describe("isBillHost", () => {
  it("matches production host", () => {
    expect(isBillHost("bill.bobosfarm.com")).toBe(true);
  });
  it("matches localhost variants", () => {
    expect(isBillHost("bill.localhost:3000")).toBe(true);
    expect(isBillHost("bill.localhost")).toBe(true);
  });
  it("does not match main host", () => {
    expect(isBillHost("bobosfarm.com")).toBe(false);
    expect(isBillHost("www.bobosfarm.com")).toBe(false);
    expect(isBillHost("")).toBe(false);
  });
});

describe("classifyBillPath", () => {
  it("public paths bypass auth", () => {
    expect(classifyBillPath("/")).toEqual({ kind: "public", rewriteTo: "/_bill" });
    expect(classifyBillPath("/api/bill/auth")).toEqual({ kind: "public" });
    expect(classifyBillPath("/r/abc123")).toEqual({ kind: "public" });
  });

  it("authed paths require session and rewrite to /_bill prefix", () => {
    expect(classifyBillPath("/list")).toEqual({ kind: "authed", rewriteTo: "/_bill/list" });
    expect(classifyBillPath("/new")).toEqual({ kind: "authed", rewriteTo: "/_bill/new" });
    expect(classifyBillPath("/edit/abc")).toEqual({ kind: "authed", rewriteTo: "/_bill/edit/abc" });
  });

  it("api/bill/receipts paths are authed without rewrite", () => {
    expect(classifyBillPath("/api/bill/receipts")).toEqual({ kind: "authed" });
    expect(classifyBillPath("/api/bill/receipts/abc")).toEqual({ kind: "authed" });
  });

  it("internal _bill prefix is forbidden", () => {
    expect(classifyBillPath("/_bill")).toEqual({ kind: "forbidden" });
    expect(classifyBillPath("/_bill/list")).toEqual({ kind: "forbidden" });
  });

  it("unknown paths are forbidden", () => {
    expect(classifyBillPath("/admin")).toEqual({ kind: "forbidden" });
    expect(classifyBillPath("/menu")).toEqual({ kind: "forbidden" });
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx jest src/lib/bill/__tests__/middleware.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement classifier**

Create `src/lib/bill/middleware.ts`:

```ts
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
  if (pathname === "/_bill" || pathname.startsWith("/_bill/")) {
    return { kind: "forbidden" };
  }
  // Auth API and public receipt page.
  if (pathname === "/api/bill/auth") return { kind: "public" };
  if (pathname === "/r" || pathname.startsWith("/r/")) return { kind: "public" };
  // Password screen: public, rewrites to internal /_bill.
  if (pathname === "/") return { kind: "public", rewriteTo: "/_bill" };
  // Authed admin pages — rewrite to internal /_bill prefix.
  if (pathname === "/list") return { kind: "authed", rewriteTo: "/_bill/list" };
  if (pathname === "/new") return { kind: "authed", rewriteTo: "/_bill/new" };
  if (pathname.startsWith("/edit/")) {
    return { kind: "authed", rewriteTo: `/_bill${pathname}` };
  }
  // Authed API — no rewrite needed.
  if (pathname.startsWith("/api/bill/")) return { kind: "authed" };
  return { kind: "forbidden" };
}

export async function handleBillSubdomain(req: NextRequest): Promise<NextResponse> {
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
        return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
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
```

- [ ] **Step 4: Pass classifier tests**

Run: `npx jest src/lib/bill/__tests__/middleware.test.ts`
Expected: classifier + host tests pass.

- [ ] **Step 5: Integrate into `proxy.ts`**

At the very top of the `proxy` function body (right after the function signature, before `const { pathname } = req.nextUrl;`), add:

```ts
  // ── Bill subdomain dispatch (must come first) ───────────────────
  const host = req.headers.get("host") ?? "";
  const { isBillHost, handleBillSubdomain } = await import("@/lib/bill/middleware");
  if (isBillHost(host)) {
    return handleBillSubdomain(req);
  }
```

Note: dynamic import keeps the bill code out of the hot path for main-domain requests. If the codebase prefers static imports for middleware, change to top-of-file `import { isBillHost, handleBillSubdomain } from "@/lib/bill/middleware";` — either is acceptable.

- [ ] **Step 6: Local smoke test**

Run the dev server: `npm run dev`
Then in another terminal: `curl -sI -H "Host: bill.localhost:3000" http://localhost:3000/list`
Expected: `HTTP/1.1 307` redirect to `http://localhost:3000/` (no session).

`curl -sI -H "Host: bill.localhost:3000" http://localhost:3000/`
Expected: rewrite to `/_bill` then Next.js 404 because the page doesn't exist yet (it lands in Task 10). Acceptable here — the middleware rewrite is doing its job.

`curl -sI -H "Host: localhost:3000" http://localhost:3000/admin`
Expected: redirect to `/login` (main-domain logic untouched).

- [ ] **Step 7: Commit**

```bash
git add src/lib/bill/middleware.ts src/lib/bill/__tests__/middleware.test.ts proxy.ts
git commit -m "feat(bill): subdomain dispatch + path classifier with _bill rewrite"
```

---

## Task 8: API — POST /api/bill/auth

**Files:**
- Create: `src/app/api/bill/auth/route.ts`

This route is intentionally lightweight — its behavior is unit-tested via `verifyBillPassword` and `signSession`. A separate integration test would add little.

- [ ] **Step 1: Implement**

Create `src/app/api/bill/auth/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyBillPassword } from "@/lib/bill/password";
import {
  signSession,
  newSessionExpiresAt,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/bill/session";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = verifyBillPassword(parsed.data.password, ip);
  if (result.throttled) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const expiresAt = newSessionExpiresAt();
  const cookieValue = signSession(expiresAt);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
```

- [ ] **Step 2: Smoke test**

With dev server running and env vars set (`BILL_PASSWORD=888888`, `BILL_SESSION_SECRET=<random hex>` in `.env.local`):

```bash
curl -sv -H "Host: bill.localhost:3000" -H "Content-Type: application/json" \
  -d '{"password":"888888"}' http://localhost:3000/api/bill/auth
```
Expected: 200 response with `Set-Cookie: bill_session=...`.

Wrong password:
```bash
curl -s -H "Host: bill.localhost:3000" -H "Content-Type: application/json" \
  -d '{"password":"wrong"}' http://localhost:3000/api/bill/auth
```
Expected: 401 with `{"error":"Invalid password"}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bill/auth/route.ts
git commit -m "feat(bill): POST /api/bill/auth with cookie issuance"
```

---

## Task 9: API — receipts CRUD (`/api/bill/receipts` + `[id]`)

**Files:**
- Create: `src/lib/bill/validations.ts`
- Create: `src/app/api/bill/receipts/route.ts`
- Create: `src/app/api/bill/receipts/[id]/route.ts`
- Create: `src/lib/bill/__tests__/validations.test.ts`

The middleware already enforces session-cookie auth for `/api/bill/*` (except `/api/bill/auth`), so route handlers do not need to re-check auth — they only validate input and execute DB ops.

- [ ] **Step 1: Write failing validation test**

Create `src/lib/bill/__tests__/validations.test.ts`:

```ts
import { receiptInputSchema } from "../validations";

describe("receiptInputSchema", () => {
  it("accepts a well-formed payload", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      customerPhone: "+15551234567",
      notes: "table 3",
      discountCents: 500,
      items: [{ menuItemId: "abc", quantity: 2 }],
    });
    expect(r.success).toBe(true);
  });

  it("requires customerName", () => {
    const r = receiptInputSchema.safeParse({
      discountCents: 0,
      items: [{ menuItemId: "abc", quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one item", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      discountCents: 0,
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-positive quantity", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      discountCents: 0,
      items: [{ menuItemId: "abc", quantity: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative discount", () => {
    const r = receiptInputSchema.safeParse({
      customerName: "Jane",
      discountCents: -1,
      items: [{ menuItemId: "abc", quantity: 1 }],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npx jest src/lib/bill/__tests__/validations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement validations**

Create `src/lib/bill/validations.ts`:

```ts
import { z } from "zod";

export const receiptInputSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  discountCents: z.number().int().min(0).default(0),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1),
});

export type ReceiptInput = z.infer<typeof receiptInputSchema>;
```

- [ ] **Step 4: Pass**

Run: `npx jest src/lib/bill/__tests__/validations.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Implement list + create**

Create `src/app/api/bill/receipts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/bill/totals";
import { generateReceiptToken } from "@/lib/bill/token";
import { receiptInputSchema } from "@/lib/bill/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const rows = await prisma.quickReceipt.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      customerName: true,
      customerPhone: true,
      totalCents: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const nextCursor = rows.length > limit ? rows[limit].id : null;
  return NextResponse.json({ items: rows.slice(0, limit), nextCursor });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = receiptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Look up tax_rate setting.
  const taxSetting = await prisma.systemSetting.findUnique({ where: { key: "tax_rate" } });
  const taxRate = taxSetting ? Number(taxSetting.value) : 0.08;

  // Fetch menu items being referenced.
  const menuIds = input.items.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, nameEn: true, nameZh: true, price: true },
  });
  const byId = new Map(menuItems.map(m => [m.id, m]));
  if (byId.size !== new Set(menuIds).size) {
    return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
  }

  // Build snapshot rows.
  const itemRows = input.items.map((i, idx) => {
    const m = byId.get(i.menuItemId)!;
    return {
      menuItemId: m.id,
      nameEnSnap: m.nameEn,
      nameZhSnap: m.nameZh,
      priceCents: Math.round(m.price * 100),
      quantity: i.quantity,
      sortOrder: idx,
    };
  });

  const totals = computeTotals(itemRows, input.discountCents, taxRate);

  const created = await prisma.quickReceipt.create({
    data: {
      token: generateReceiptToken(),
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      notes: input.notes ?? null,
      taxRate,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      items: { create: itemRows },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 6: Implement get / patch / delete**

Create `src/app/api/bill/receipts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/bill/totals";
import { receiptInputSchema } from "@/lib/bill/validations";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.quickReceipt.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(r);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.quickReceipt.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = receiptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const menuIds = input.items.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } },
    select: { id: true, nameEn: true, nameZh: true, price: true },
  });
  const byId = new Map(menuItems.map(m => [m.id, m]));
  if (byId.size !== new Set(menuIds).size) {
    return NextResponse.json({ error: "One or more menu items not found" }, { status: 400 });
  }

  const itemRows = input.items.map((i, idx) => {
    const m = byId.get(i.menuItemId)!;
    return {
      menuItemId: m.id,
      nameEnSnap: m.nameEn,
      nameZhSnap: m.nameZh,
      priceCents: Math.round(m.price * 100),
      quantity: i.quantity,
      sortOrder: idx,
    };
  });
  const totals = computeTotals(itemRows, input.discountCents, existing.taxRate);

  const updated = await prisma.$transaction(async tx => {
    await tx.quickReceiptItem.deleteMany({ where: { receiptId: id } });
    return tx.quickReceipt.update({
      where: { id },
      data: {
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        notes: input.notes ?? null,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        items: { create: itemRows },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.quickReceipt.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 7: Smoke test (POST → GET → PATCH → DELETE)**

First grab the cookie from Task 8's POST `/api/bill/auth`. Save it to `$JAR` via `curl -c jar.txt`. Then:

```bash
# Find a menu item id for testing:
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.menuItem.findFirst({ where: { isActive: true } }).then(m => { console.log(m?.id); return p.\$disconnect(); });"
# Use that id below as $MID

curl -s -b jar.txt -H "Host: bill.localhost:3000" -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/bill/receipts \
  -d "{\"customerName\":\"Test\",\"customerPhone\":\"5551234\",\"discountCents\":0,\"items\":[{\"menuItemId\":\"$MID\",\"quantity\":1}]}"
```
Expected: 201 with created receipt including `token`, `totalCents`, items array.

```bash
curl -s -b jar.txt -H "Host: bill.localhost:3000" http://localhost:3000/api/bill/receipts
```
Expected: 200 with list containing the new receipt.

PATCH the receipt with a new quantity, GET it, confirm totals updated. DELETE it, GET → 404.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bill/validations.ts src/lib/bill/__tests__/validations.test.ts \
  src/app/api/bill/receipts/route.ts src/app/api/bill/receipts/\[id\]/route.ts
git commit -m "feat(bill): receipts CRUD API with menu snapshot"
```

---

## Task 10: Bill nested layout + password screen

**Files:**
- Create: `src/app/(bill)/_bill/layout.tsx`
- Create: `src/app/(bill)/_bill/page.tsx`
- Create: `src/app/(bill)/_bill/PasswordForm.tsx`

**Note on layouts:** the existing `src/app/layout.tsx` is the single root layout (defines `<html>`/`<body>`, fonts, NextAuth provider, NextIntl provider). Next.js forbids multiple `<html>` roots in one tree. The bill route group therefore uses a **nested** layout only — no `<html>` wrapper, no separate root layout. The bill pages inherit the main layout's body but render hardcoded Chinese (they do not call `useTranslations()`).

- [ ] **Step 1: Authed nested layout**

Create `src/app/(bill)/_bill/layout.tsx`:

```tsx
import Link from "next/link";

export default function BillAuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/list" className="text-lg font-serif font-semibold">Bobo&apos;s Bill</Link>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Password screen page**

Create `src/app/(bill)/_bill/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/bill/session";
import PasswordForm from "./PasswordForm";

export default async function BillEntryPage() {
  const c = await cookies();
  const session = verifySession(c.get(SESSION_COOKIE_NAME)?.value);
  if (session.ok) redirect("/list");
  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-2xl font-serif font-semibold mb-2">Bobo&apos;s Bill</h1>
      <p className="text-sm text-[#8C8478] mb-6">输入密码以继续</p>
      <PasswordForm />
    </div>
  );
}
```

- [ ] **Step 3: Client password form**

Create `src/app/(bill)/_bill/PasswordForm.tsx`:

```tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bill/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 429) {
        setError("尝试次数过多,请稍后再试");
        return;
      }
      if (!res.ok) {
        setError("密码错误");
        return;
      }
      router.replace("/list");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
        autoFocus
        className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-base focus:outline-none focus:border-[#6B7F5E]"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !password}
        className="w-full bg-[#1A1208] text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
      >
        {submitting ? "验证中..." : "进入"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Smoke test**

Restart dev. Visit `http://bill.localhost:3000/` in the browser. Confirm password page renders. Enter `888888`, expect redirect to `/list` (404 for now — that's fine until Task 11). Cookie `bill_session` should be set (check DevTools → Application → Cookies).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(bill\)/
git commit -m "feat(bill): nested layout + password screen"
```

---

## Task 11: History list page (`/list`)

**Files:**
- Create: `src/app/(bill)/_bill/list/page.tsx`
- Create: `src/app/(bill)/_bill/list/ListClient.tsx`

- [ ] **Step 1: Server page**

Create `src/app/(bill)/_bill/list/page.tsx`:

```tsx
import ListClient from "./ListClient";

export default function BillListPage() {
  return <ListClient />;
}
```

- [ ] **Step 2: Client component**

Create `src/app/(bill)/_bill/list/ListClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, MoreVertical, Trash2, Copy, Pencil } from "lucide-react";
import { centsToDollarString } from "@/lib/bill/totals";

interface Row {
  id: string;
  token: string;
  customerName: string;
  customerPhone: string | null;
  totalCents: number;
  createdAt: string;
}
interface ListResponse { items: Row[]; nextCursor: string | null }

const fetcher = (u: string) => fetch(u).then(r => {
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
});

function formatTs(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function ListClient() {
  const { data, mutate } = useSWR<ListResponse>("/api/bill/receipts?limit=50", fetcher);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm("确认删除这个 receipt?")) return;
    await fetch(`/api/bill/receipts/${id}`, { method: "DELETE" });
    mutate();
    setOpenMenuId(null);
  }

  async function onCopy(token: string) {
    const url = `${location.origin}/r/${token}`;
    await navigator.clipboard.writeText(url);
    setOpenMenuId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-serif">历史 receipt</h2>
        <Link
          href="/new"
          className="inline-flex items-center gap-1 bg-[#1A1208] text-white px-3 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 新建
        </Link>
      </div>
      {!data ? (
        <p className="text-sm text-[#8C8478]">加载中...</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-[#8C8478]">还没有 receipt。</p>
      ) : (
        <ul className="divide-y divide-[#E8ECE4]">
          {data.items.map(row => (
            <li key={row.id} className="py-3 flex items-center gap-3">
              <Link href={`/edit/${row.id}`} className="flex-1 min-w-0">
                <div className="font-medium truncate">{row.customerName}</div>
                <div className="text-xs text-[#8C8478]">{row.customerPhone ?? "—"} · {formatTs(row.createdAt)}</div>
              </Link>
              <div className="text-base font-semibold tabular-nums">${centsToDollarString(row.totalCents)}</div>
              <div className="relative">
                <button onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)} className="p-2">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {openMenuId === row.id && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8ECE4] rounded-lg shadow-lg z-10 w-32">
                    <Link
                      href={`/edit/${row.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F7F4EE]"
                    >
                      <Pencil className="w-4 h-4" /> 编辑
                    </Link>
                    <button
                      onClick={() => onCopy(row.token)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F7F4EE]"
                    >
                      <Copy className="w-4 h-4" /> 复制链接
                    </button>
                    <button
                      onClick={() => onDelete(row.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-[#F7F4EE]"
                    >
                      <Trash2 className="w-4 h-4" /> 删除
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

In the dev browser at `bill.localhost:3000/list`, confirm:

- "还没有 receipt" if DB empty
- "+ 新建" links to `/new` (which 404s until Task 12 — acceptable here)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(bill\)/_bill/list/
git commit -m "feat(bill): history list page"
```

---

## Task 12: Receipt editor (`/new` and `/edit/[id]`)

**Files:**
- Create: `src/app/(bill)/_bill/new/page.tsx`
- Create: `src/app/(bill)/_bill/edit/[id]/page.tsx`
- Create: `src/app/(bill)/components/ReceiptEditor.tsx`
- Create: `src/app/(bill)/components/MenuPickerSheet.tsx`
- Create: `src/app/(bill)/components/ShareDialog.tsx`

- [ ] **Step 1: Server entry pages**

Create `src/app/(bill)/_bill/new/page.tsx`:

```tsx
import ReceiptEditor from "../../components/ReceiptEditor";
import { prisma } from "@/lib/prisma";

export default async function BillNewPage() {
  const taxSetting = await prisma.systemSetting.findUnique({ where: { key: "tax_rate" } });
  const taxRate = taxSetting ? Number(taxSetting.value) : 0.08;
  return <ReceiptEditor mode="new" taxRate={taxRate} />;
}
```

Create `src/app/(bill)/_bill/edit/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReceiptEditor from "../../../components/ReceiptEditor";

export default async function BillEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.quickReceipt.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!receipt) notFound();
  return (
    <ReceiptEditor
      mode="edit"
      taxRate={receipt.taxRate}
      initial={{
        id: receipt.id,
        token: receipt.token,
        customerName: receipt.customerName,
        customerPhone: receipt.customerPhone,
        notes: receipt.notes,
        discountCents: receipt.discountCents,
        items: receipt.items.map(i => ({
          menuItemId: i.menuItemId ?? "",
          nameZhSnap: i.nameZhSnap,
          nameEnSnap: i.nameEnSnap,
          priceCents: i.priceCents,
          quantity: i.quantity,
        })),
      }}
    />
  );
}
```

- [ ] **Step 2: Editor client component**

Create `src/app/(bill)/components/ReceiptEditor.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Minus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { computeTotals, centsToDollarString, dollarsToCents } from "@/lib/bill/totals";
import MenuPickerSheet, { MenuItemLite } from "./MenuPickerSheet";
import ShareDialog from "./ShareDialog";

interface EditorItem {
  menuItemId: string;
  nameZhSnap: string | null;
  nameEnSnap: string;
  priceCents: number;
  quantity: number;
}

interface Initial {
  id: string;
  token: string;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  discountCents: number;
  items: EditorItem[];
}

interface Props {
  mode: "new" | "edit";
  taxRate: number;
  initial?: Initial;
}

export default function ReceiptEditor({ mode, taxRate, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<EditorItem[]>(initial?.items ?? []);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [discountInput, setDiscountInput] = useState(
    initial ? centsToDollarString(initial.discountCents) : "0",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<{ token: string; id: string } | null>(
    initial ? { token: initial.token, id: initial.id } : null,
  );

  const discountCents = dollarsToCents(discountInput);
  const totals = useMemo(
    () => computeTotals(items.map(i => ({ priceCents: i.priceCents, quantity: i.quantity })), discountCents, taxRate),
    [items, discountCents, taxRate],
  );

  function addOrIncrement(m: MenuItemLite) {
    setItems(prev => {
      const idx = prev.findIndex(it => it.menuItemId === m.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        menuItemId: m.id,
        nameEnSnap: m.nameEn,
        nameZhSnap: m.nameZh,
        priceCents: Math.round(m.price * 100),
        quantity: 1,
      }];
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setItems(prev => prev
      .map(it => it.menuItemId === menuItemId ? { ...it, quantity: it.quantity + delta } : it)
      .filter(it => it.quantity > 0));
  }

  function removeRow(menuItemId: string) {
    setItems(prev => prev.filter(it => it.menuItemId !== menuItemId));
  }

  async function onSave() {
    if (!customerName.trim()) {
      alert("请填写客人姓名");
      return;
    }
    if (items.length === 0) {
      alert("至少添加一项");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
        discountCents: totals.discountCents,
        items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      };
      const url = mode === "new" ? "/api/bill/receipts" : `/api/bill/receipts/${initial!.id}`;
      const method = mode === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`保存失败: ${txt}`);
        return;
      }
      const json = await res.json();
      setShare({ token: json.token, id: json.id });
      if (mode === "new") router.replace(`/edit/${json.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-32">
      <Link href="/list" className="inline-flex items-center text-sm text-[#8C8478]"><ArrowLeft className="w-4 h-4 mr-1" /> 返回列表</Link>

      {share && (
        <ShareDialog
          token={share.token}
          phone={customerPhone.trim() || null}
          totalLabel={`$${centsToDollarString(totals.totalCents)}`}
          onClose={() => { /* keep dialog visible — it's an inline panel */ }}
        />
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">商品</h3>
          <button onClick={() => setPickerOpen(true)} className="text-sm text-[#6B7F5E] inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> 加菜
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-[#8C8478]">还没有商品。</p>
        ) : (
          <ul className="divide-y divide-[#E8ECE4]">
            {items.map(it => (
              <li key={it.menuItemId} className="py-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.nameZhSnap || it.nameEnSnap}</div>
                  <div className="text-xs text-[#8C8478]">${centsToDollarString(it.priceCents)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(it.menuItemId, -1)} className="p-1 border border-[#E8ECE4] rounded"><Minus className="w-3 h-3" /></button>
                  <span className="w-6 text-center text-sm tabular-nums">{it.quantity}</span>
                  <button onClick={() => updateQty(it.menuItemId, +1)} className="p-1 border border-[#E8ECE4] rounded"><Plus className="w-3 h-3" /></button>
                </div>
                <button onClick={() => removeRow(it.menuItemId)} className="p-1 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-xs text-[#8C8478]">折扣 ($)</label>
          <input
            type="text"
            inputMode="decimal"
            value={discountInput}
            onChange={e => setDiscountInput(e.target.value)}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#8C8478]">客人姓名 *</label>
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#8C8478]">手机号(用于 SMS 跳转)</label>
          <input
            type="tel"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#8C8478]">备注</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8ECE4] px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="text-xs text-[#8C8478] mb-1 flex justify-between"><span>Subtotal</span><span>${centsToDollarString(totals.subtotalCents)}</span></div>
          {totals.discountCents > 0 && (
            <div className="text-xs text-[#8C8478] mb-1 flex justify-between"><span>Discount</span><span>-${centsToDollarString(totals.discountCents)}</span></div>
          )}
          <div className="text-xs text-[#8C8478] mb-1 flex justify-between"><span>Tax ({(taxRate * 100).toFixed(2)}%)</span><span>${centsToDollarString(totals.taxCents)}</span></div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-semibold tabular-nums">${centsToDollarString(totals.totalCents)}</span>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full bg-[#1A1208] text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? "保存中..." : (mode === "new" ? "保存" : "更新")}
          </button>
        </div>
      </div>

      <MenuPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addOrIncrement} />
    </div>
  );
}
```

- [ ] **Step 3: Menu picker bottom sheet**

Create `src/app/(bill)/components/MenuPickerSheet.tsx`:

```tsx
"use client";

import useSWR from "swr";
import { X } from "lucide-react";

export interface MenuItemLite {
  id: string;
  nameEn: string;
  nameZh: string | null;
  price: number;
  category: { id: string; nameEn: string; nameZh: string | null } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (m: MenuItemLite) => void;
}

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function MenuPickerSheet({ open, onClose, onPick }: Props) {
  const { data } = useSWR<MenuItemLite[]>(
    open ? "/api/menu/items?activeOnly=true" : null,
    fetcher,
  );

  if (!open) return null;

  // Group by category
  const groups = new Map<string, { name: string; items: MenuItemLite[] }>();
  for (const m of data ?? []) {
    const key = m.category?.id ?? "_uncat";
    const name = m.category?.nameZh ?? m.category?.nameEn ?? "未分类";
    if (!groups.has(key)) groups.set(key, { name, items: [] });
    groups.get(key)!.items.push(m);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-[#E8ECE4]">
          <h3 className="font-serif text-base">选择菜品</h3>
          <button onClick={onClose} className="p-1"><X className="w-5 h-5" /></button>
        </div>
        {!data ? (
          <p className="text-sm text-[#8C8478] p-4">加载中...</p>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {[...groups.values()].map(g => (
              <section key={g.name}>
                <h4 className="text-xs font-semibold text-[#8C8478] mb-1 uppercase tracking-wide">{g.name}</h4>
                <ul className="space-y-1">
                  {g.items.map(m => (
                    <li key={m.id}>
                      <button
                        onClick={() => onPick(m)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#F7F4EE] rounded-lg"
                      >
                        <span className="text-sm text-left">{m.nameZh ?? m.nameEn}</span>
                        <span className="text-sm tabular-nums">${m.price.toFixed(2)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Share dialog**

Create `src/app/(bill)/components/ShareDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy, Send, ExternalLink, Check } from "lucide-react";

interface Props {
  token: string;
  phone: string | null;
  totalLabel: string;
  onClose: () => void;
}

export default function ShareDialog({ token, phone, totalLabel }: Props) {
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/r/${token}`;
  const [copied, setCopied] = useState(false);
  const smsBody = `Bobo's Farm receipt (${totalLabel}): ${url}`;
  const smsHref = phone
    ? `sms:${phone}?&body=${encodeURIComponent(smsBody)}`
    : `sms:?&body=${encodeURIComponent(smsBody)}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-[#FCFAF5] border border-[#E8ECE4] rounded-lg p-3 space-y-2">
      <div className="text-xs text-[#8C8478]">分享 receipt</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white border border-[#E8ECE4] rounded px-2 py-1 truncate">{url}</code>
        <button onClick={copy} className="p-2 border border-[#E8ECE4] rounded-lg" aria-label="copy">
          {copied ? <Check className="w-4 h-4 text-[#6B7F5E]" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex gap-2">
        <a
          href={smsHref}
          className="flex-1 inline-flex items-center justify-center gap-1 bg-[#1A1208] text-white py-2 rounded-lg text-sm font-medium"
        >
          <Send className="w-4 h-4" /> 发送短信
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1 border border-[#E8ECE4] text-sm py-2 px-3 rounded-lg"
        >
          <ExternalLink className="w-4 h-4" /> 预览
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual smoke test**

1. Restart dev. Visit `bill.localhost:3000/new`.
2. Click "加菜" → bottom sheet shows menu items grouped by category.
3. Pick two items, increment one with the + button.
4. Set discount `5.00`, customer name "Test Customer", phone `+15551234567`.
5. Watch the bottom totals card update live with subtotal/discount/tax/total.
6. Click "保存". Expected: redirected to `/edit/<id>?...` and ShareDialog appears at the top showing the URL + 发送短信 / 预览 buttons.
7. Click 预览 → opens `/r/<token>` in a new tab (will 404 until next task).
8. Go back to `/list` — new receipt appears.
9. Open it via `/edit/<id>`, change quantity, click 更新, refresh — totals updated.
10. From list, three-dots → 删除 → confirm → row disappears.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(bill\)/_bill/new/ src/app/\(bill\)/_bill/edit/ src/app/\(bill\)/components/
git commit -m "feat(bill): receipt editor with menu picker and share dialog"
```

---

## Task 13: Public receipt page (`/r/[token]`)

**Files:**
- Create: `src/app/(bill)/r/[token]/page.tsx`
- Create: `src/app/(bill)/r/[token]/TipBlock.tsx`

- [ ] **Step 1: Server page**

Create `src/app/(bill)/r/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { centsToDollarString } from "@/lib/bill/totals";
import TipBlock from "./TipBlock";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function ReceiptPublicPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = sp.lang === "en" ? "en" : "zh";
  const receipt = await prisma.quickReceipt.findUnique({
    where: { token },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!receipt) notFound();

  const itemName = (en: string, zh: string | null) => (lang === "zh" ? (zh ?? en) : en);
  const t = lang === "zh"
    ? { subtotal: "小计", discount: "折扣", tax: "税", total: "总计", tip: "建议小费", grand: "含小费合计", langSwitch: "EN", title: "Bobo's Farm" }
    : { subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total", tip: "Suggested tip", grand: "Total with tip", langSwitch: "中", title: "Bobo's Farm" };

  return (
    <main className="max-w-md mx-auto px-5 py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold">{t.title}</h1>
          <p className="text-xs text-[#8C8478]">891 Albany Post Rd, New Paltz, NY 12561</p>
          <p className="text-xs text-[#8C8478]">(516) 272-9999</p>
        </div>
        <a href={`?lang=${lang === "zh" ? "en" : "zh"}`} className="text-xs underline text-[#8C8478]">{t.langSwitch}</a>
      </div>

      <div className="mb-4">
        <p className="text-sm">{receipt.customerName}</p>
        <p className="text-xs text-[#8C8478]">{new Date(receipt.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</p>
      </div>

      <table className="w-full text-sm mb-4">
        <tbody>
          {receipt.items.map(i => (
            <tr key={i.id} className="border-b border-[#F0EDE7]">
              <td className="py-2">{itemName(i.nameEnSnap, i.nameZhSnap)} × {i.quantity}</td>
              <td className="py-2 text-right tabular-nums">${centsToDollarString(i.priceCents * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-sm mb-4">
        <div className="flex justify-between"><span>{t.subtotal}</span><span className="tabular-nums">${centsToDollarString(receipt.subtotalCents)}</span></div>
        {receipt.discountCents > 0 && (
          <div className="flex justify-between text-[#8C8478]"><span>{t.discount}</span><span className="tabular-nums">-${centsToDollarString(receipt.discountCents)}</span></div>
        )}
        <div className="flex justify-between text-[#8C8478]">
          <span>{t.tax} ({(receipt.taxRate * 100).toFixed(2)}%)</span>
          <span className="tabular-nums">${centsToDollarString(receipt.taxCents)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold pt-2 border-t border-[#E8ECE4]">
          <span>{t.total}</span><span className="tabular-nums">${centsToDollarString(receipt.totalCents)}</span>
        </div>
      </div>

      <TipBlock totalCents={receipt.totalCents} subtotalCents={receipt.subtotalCents} labels={{ tip: t.tip, grand: t.grand }} />

      {receipt.notes && (
        <div className="mt-6 text-xs text-[#8C8478] whitespace-pre-wrap">{receipt.notes}</div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Client tip widget**

Create `src/app/(bill)/r/[token]/TipBlock.tsx`:

```tsx
"use client";

import { useState } from "react";
import { centsToDollarString } from "@/lib/bill/totals";

interface Props {
  subtotalCents: number;
  totalCents: number;
  labels: { tip: string; grand: string };
}

const SUGGESTIONS: { label: string; pct: number }[] = [
  { label: "10%", pct: 0.10 },
  { label: "15%", pct: 0.15 },
  { label: "20%", pct: 0.20 },
];

export default function TipBlock({ subtotalCents, totalCents, labels }: Props) {
  const [tipCents, setTipCents] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const grand = totalCents + tipCents;

  function applyPct(pct: number) {
    setTipCents(Math.round(subtotalCents * pct));
    setCustomInput("");
  }

  function applyCustom(v: string) {
    setCustomInput(v);
    const n = parseFloat(v);
    setTipCents(Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0);
  }

  return (
    <div className="bg-[#FCFAF5] border border-[#E8ECE4] rounded-lg p-4">
      <div className="text-xs text-[#8C8478] mb-2">{labels.tip}</div>
      <div className="flex gap-2 mb-2">
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            onClick={() => applyPct(s.pct)}
            className="flex-1 border border-[#E8ECE4] rounded-lg py-1.5 text-sm bg-white"
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        inputMode="decimal"
        placeholder="自定义 $"
        value={customInput}
        onChange={e => applyCustom(e.target.value)}
        className="w-full border border-[#E8ECE4] rounded-lg px-3 py-1.5 text-sm"
      />
      {tipCents > 0 && (
        <div className="mt-3 text-sm space-y-1">
          <div className="flex justify-between"><span>{labels.tip}</span><span className="tabular-nums">${centsToDollarString(tipCents)}</span></div>
          <div className="flex justify-between font-semibold"><span>{labels.grand}</span><span className="tabular-nums">${centsToDollarString(grand)}</span></div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

1. From an unauthenticated browser context (private window), visit `bill.localhost:3000/r/<token>` (use a token from a saved receipt). Confirm:
   - Receipt renders with items, subtotal, tax, total
   - Click 15% → grand total displays below
   - Switch to EN via the link in the corner — labels change but data is the same
2. Visit `bill.localhost:3000/r/notarealtoken` — expect Next.js 404.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(bill\)/r/
git commit -m "feat(bill): public receipt page with client-side tip suggestions"
```

---

## Task 14: Main system tax_rate UI + i18n

**Files:**
- Modify: `src/app/(admin)/admin/settings/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh.json`

**Context:** the settings page uses `useTranslations('admin.settings')` and calls `t('general.businessAddress')` etc. for the General tab — so the JSON key path is `admin.settings.general.<key>`.

- [ ] **Step 1: Add i18n strings**

In `messages/en.json`, find `admin.settings.general` (it contains keys like `businessName`, `businessAddress`, `businessAddressHelp`). Add two new sibling keys inside that object:

```json
"taxRate": "Sales tax rate",
"taxRateHelp": "Decimal rate (0–1) used by the bill subdomain. Ulster County, NY = 0.08."
```

In `messages/zh.json` under the same `admin.settings.general` object:

```json
"taxRate": "销售税率",
"taxRateHelp": "Bill 子域使用的小数税率(0–1)。New Paltz / Ulster County = 0.08。"
```

Run: `npm run check:i18n`
Expected: PASS — both files have matching keys.

- [ ] **Step 2: Wire the setting into the General tab**

In `src/app/(admin)/admin/settings/page.tsx`, add `tax_rate: 0` to `KEY_TAB_MAP` (right after the `business_*` lines). Then locate the JSX block that renders the Business Address field (search for `business_address`) and append immediately after it, before the "Password Change Section":

```tsx
{/* Tax Rate */}
<div className="mb-8">
  <label className="text-sm font-semibold text-[#1A1208] block mb-1">{t('general.taxRate')}</label>
  <input
    type="number"
    step="0.0001"
    min="0"
    max="1"
    value={formValues.tax_rate ?? ''}
    onChange={e => updateField('tax_rate', e.target.value)}
    className={`${inputClass('tax_rate')} max-w-[8rem]`}
    placeholder="0.08"
  />
  <p className="text-xs text-[#8C8478] mt-1">{t('general.taxRateHelp')}</p>
</div>
```

- [ ] **Step 3: Smoke test**

Restart dev. Visit `/admin/settings`. Confirm the new Tax Rate field appears in the general tab, value is `0.08`, editing + saving works (existing save mechanism handles it because it's just another setting key).

After saving, query DB:
```bash
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.systemSetting.findUnique({ where: { key: 'tax_rate' } }).then(s => { console.log(s); return p.\$disconnect(); });"
```
Expected: reflects the new value.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/admin/settings/page.tsx messages/en.json messages/zh.json
git commit -m "feat(settings): admin UI for tax_rate"
```

---

## Task 15: Env setup + Playwright MCP end-to-end smoke

**Files:** (no code changes; verification only)

- [ ] **Step 1: Confirm local env vars**

Ensure `.env.local` contains:
```
BILL_PASSWORD=888888
BILL_SESSION_SECRET=<32+ random hex chars; generate with: openssl rand -hex 32>
```
If a `.env.example` exists in the repo, append placeholders to it (without secrets).

- [ ] **Step 2: Confirm `/etc/hosts` allows bill.localhost**

On macOS, `bill.localhost` should already resolve to 127.0.0.1 because `*.localhost` is reserved. If not, add `127.0.0.1 bill.localhost` to `/etc/hosts`. Verify: `ping -c1 bill.localhost`.

- [ ] **Step 3: Run full Jest suite**

Run: `npm test -- --testPathPattern='src/lib/bill'`
Expected: all bill unit tests pass.

Run: `npm test`
Expected: full suite still green — no regression in existing tests.

- [ ] **Step 4: Playwright MCP end-to-end**

With dev server running at `http://localhost:3000` and `bill.localhost` resolving:

Use Playwright MCP to drive a browser through these steps:

1. Navigate to `http://bill.localhost:3000/` → expect password form
2. Type `888888` → submit → expect redirect to `/list`
3. Click 新建 → expect editor page
4. Open menu picker, click two items, increment one
5. Fill name "Playwright Test", phone "+15551234567", discount "2.50"
6. Click 保存 → expect ShareDialog with URL pattern `http://bill.localhost:3000/r/[A-Za-z0-9_-]{22}`
7. Copy the URL, open it in a fresh browser context (no cookies)
8. Expect receipt page to render with items, totals, and a tip block
9. Click 15% tip button → expect "Total with tip" line to appear with correct sum
10. Return to authed context, navigate `/list` → expect the new receipt row
11. Open three-dots menu → 删除 → confirm → row disappears
12. Visit the previously-copied receipt URL → expect 404

Capture a screenshot of each milestone for the commit message.

- [ ] **Step 5: Final commit (no code, just bookkeeping)**

If any small fixes were needed during smoke testing, commit them in this final task. Otherwise no commit needed; the verification itself is the deliverable.

If a doc-only summary is desired, append a status line to the spec file noting the completion date, and commit:
```bash
git add docs/superpowers/specs/2026-05-21-bill-subdomain-design.md
git commit -m "docs(specs): mark bill subdomain implementation complete"
```

---

## Future Removal Reference

When the tool is no longer needed:

```bash
# 1. Delete code
rm -rf src/app/\(bill\)/ src/app/api/bill/ src/lib/bill/

# 2. Schema migration to drop tables (generate via prisma migrate dev --name remove_bill)
#    after removing the QuickReceipt and QuickReceiptItem models from schema.prisma

# 3. Revert the bill branch in proxy.ts (remove the isBillHost block at the top)

# 4. Optionally remove the tax_rate setting (the field on /admin/settings can stay
#    as a passive setting if other features ever use it)

# 5. Vercel: remove bill.bobosfarm.com domain, BILL_PASSWORD, BILL_SESSION_SECRET env vars
# 6. DNS: remove CNAME for bill.*
```
