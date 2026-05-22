# Bill Subdomain — Quick Receipt Tool

**Date:** 2026-05-21
**Status:** Approved (pending implementation plan)
**Author:** chengxin

---

## 1. Background & Goal

Client needs a **standalone, throwaway** order-total + receipt tool that lives outside the main booking system. Admin uses it on a phone to:

1. Pick items from the existing menu, add quantity, optional discount
2. See the total computed with NY (Ulster County) sales tax
3. Save the order and instantly share a public receipt link with the customer via SMS

The tool is explicitly **temporary** — the design must allow a clean, low-friction removal in the future (one `rm -rf`, one Prisma migration, a handful of config lines).

## 2. Scope

**In scope**

- New subdomain `bill.bobos.farm` with shared-password gate
- Admin pages: history list, new receipt, edit receipt
- Public receipt page at `/r/<token>` (no auth)
- `sms:` URI-based share (no SMS gateway)
- Two new Prisma tables, isolated from the existing `Order`/`OrderItem` models
- One new `tax_rate` SystemSetting + a settings-page field (this is the "fill in main system's tax" side ask)

**Out of scope**

- Real user accounts, RBAC, or audit trails on the bill subdomain (shared password is sufficient)
- SMS gateway integration (Twilio etc.) — the `sms:` URI scheme is enough
- PDF generation
- Email delivery
- Integration with the existing reservation/order/menu-deadline flow

## 3. Decisions Recap

| Decision | Value |
| --- | --- |
| Subdomain | `bill.bobos.farm` |
| Entry gate | Single shared password (env var `BILL_PASSWORD`, default `888888`) |
| Session | httpOnly signed cookie, 7-day TTL |
| Item source | Existing `MenuItem` table (read-only), **snapshotted** into receipt rows |
| Tax | `tax_rate` SystemSetting (default `0.08`), snapshotted per receipt |
| Discount | Dollar amount only (no % UI) |
| Tip | Pure client-side suggestion on public receipt page (not stored, not part of total) |
| Recipient | Manual entry — `customerName` required, `customerPhone` optional |
| Share | `<a href="sms:<phone>?body=...">` — opens phone Messages app |
| Currency | USD, all monetary values stored in integer **cents** |
| i18n | Bill admin pages = zh only; public receipt page = zh default with EN toggle |

## 4. Architecture

### 4.1 Code isolation

All new code is confined to three directories, plus a handful of small edits to existing files:

```
src/app/(bill)/         ← Next.js route group, all bill UI lives here
src/app/api/bill/       ← bill-specific API routes
src/lib/bill/           ← cookie sign/verify, password compare, totals math
prisma/migrations/…_bill/  ← schema changes for the two new tables
```

External edits:

- `src/middleware.ts` — add `host === 'bill.bobos.farm'` branch at the top
- `prisma/schema.prisma` — add `QuickReceipt` + `QuickReceiptItem` models
- `prisma/seed-settings-v2.ts` — add `tax_rate` setting
- `src/app/(admin)/admin/settings/page.tsx` — add tax-rate input
- `messages/{en,zh}.json` — add tax-rate label/help strings for the settings page

Removal path (Section 12) is then trivial.

### 4.2 Subdomain routing

DNS: `bill.bobos.farm  CNAME  cname.vercel-dns.com`. Add the domain to the same Vercel project (no separate project — same Next.js app serves both hosts).

**File structure** — bill UI lives under an internal `/_bill/...` prefix so it cannot collide with main-domain routes:

```
src/app/(bill)/_bill/page.tsx              ← password screen
src/app/(bill)/_bill/list/page.tsx
src/app/(bill)/_bill/new/page.tsx
src/app/(bill)/_bill/edit/[id]/page.tsx
src/app/(bill)/r/[token]/page.tsx          ← public receipt (NOT under /_bill,
                                              served on both hosts intentionally)
```

**Middleware** (`src/middleware.ts`, top of the function):

```ts
const host = req.headers.get('host') ?? '';
const isBillHost = host === 'bill.bobos.farm' || host.startsWith('bill.localhost');

if (isBillHost) {
  return handleBillSubdomain(req);  // see src/lib/bill/middleware.ts
}
// Main-domain logic continues below — it doesn't know about /_bill at all.
```

`handleBillSubdomain(req)` logic:

1. If the URL path starts with `/_bill/`: forbid (treat as 404). External callers must never see this prefix; it's an internal Next.js routing target.
2. If path is `/r/<token>`: pass through (public receipt page, no auth).
3. If path is `/api/bill/auth` or `/`: allow, no cookie required.
4. All other paths: require valid `bill_session` cookie; otherwise 302 to `/`.
5. For the public-facing path `/`, `/list`, `/new`, `/edit/<id>`: **rewrite** to `/_bill/`, `/_bill/list`, `/_bill/new`, `/_bill/edit/<id>` respectively. The URL the user sees stays clean; Next.js renders the matching page from the `_bill` folder.

It does **not** consult NextAuth (`getToken`) — bill subdomain has its own auth model.

**Why this works:**

- Main domain (`bobos.farm`) never matches `/_bill/...` because the middleware on that host doesn't rewrite anything to it, and direct access is blocked.
- The public `/r/<token>` page lives outside `_bill` so it can theoretically be served on either host. The middleware on the main host could also serve it (we don't actively block) — but the canonical shared link is on `bill.bobos.farm/r/<token>` so this isn't a concern.
- Removal becomes trivial: delete the `(bill)` route group folder and the bill branch in `src/middleware.ts`. Nothing else in the URL space is affected.

### 4.3 Password gate

- `BILL_PASSWORD` env var (Vercel project env). Default for local dev: `888888`.
- `BILL_SESSION_SECRET` env var — random 32-byte hex string used for cookie HMAC.
- Cookie name `bill_session`. Value = `<expiresAt>.<base64url(HMAC_SHA256(expiresAt, secret))>`.
- Verification: parse `expiresAt`, recompute HMAC, constant-time compare, check `Date.now() < expiresAt`.
- TTL: 7 days from issue.
- Cookie attributes: `HttpOnly; Secure; SameSite=Lax; Path=/`.

POST `/api/bill/auth` with `{ password }`:

- Constant-time compare against `BILL_PASSWORD`
- Success: `Set-Cookie: bill_session=...; …` and redirect to `/list`
- Failure: return 401 with a generic message; throttle simple in-memory per-IP (5 attempts / 10 minutes) — best effort, not security-critical

## 5. Data Model

All monetary values are **integer cents** (`Int`), preventing float precision issues.

```prisma
model QuickReceipt {
  id            String   @id @default(cuid())
  token         String   @unique             // 16-char nanoid, used in public URL
  customerName  String
  customerPhone String?
  notes         String?
  taxRate       Float                        // snapshot of tax_rate setting at creation
  subtotalCents Int                          // sum(item.priceCents * item.quantity)
  discountCents Int      @default(0)         // dollar amount, never > subtotal
  taxCents      Int                          // round((subtotal - discount) * taxRate)
  totalCents    Int                          // subtotal - discount + tax
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  items         QuickReceiptItem[]

  @@index([createdAt])
  @@map("quick_receipts")
}

model QuickReceiptItem {
  id          String   @id @default(cuid())
  receiptId   String
  menuItemId  String?                        // nullable — survives menu deletion
  nameEnSnap  String                         // snapshot, never changed by menu edits
  nameZhSnap  String?
  priceCents  Int                            // snapshot unit price
  quantity    Int                            // > 0
  sortOrder   Int      @default(0)
  receipt     QuickReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)

  @@index([receiptId])
  @@map("quick_receipt_items")
}
```

**Snapshot semantics:**

- On create and on edit (when adding a new line from the menu), the current `MenuItem.nameEn`, `MenuItem.nameZh`, and `MenuItem.price` (× 100 → cents) are copied into the row.
- Subsequent menu edits or deletions do not retroactively change existing receipts.
- `menuItemId` is kept for traceability but allowed to be `NULL` if the source item was deleted.

**Tax snapshot:** the `tax_rate` setting is read at create time and stored on `QuickReceipt.taxRate`. Edits to a receipt recompute `taxCents`/`totalCents` using the **stored** `taxRate`, not the current setting — so historical receipts stay consistent unless the user explicitly chooses to refresh the rate (out of scope for v1).

**Rounding:** `taxCents = Math.round((subtotalCents - discountCents) * taxRate)`. Use banker's-rounding-free `Math.round` for determinism. Validate `discountCents <= subtotalCents` server-side.

## 6. API

All under `/api/bill/`, all require valid `bill_session` cookie except `/auth`.

### `POST /api/bill/auth`

Body: `{ password: string }`. Returns `{ ok: true }` and sets cookie, or 401.

### `GET /api/bill/receipts?cursor=<id>&limit=50`

Returns paginated list, latest first:
```json
{
  "items": [
    { "id", "token", "customerName", "customerPhone", "totalCents", "createdAt", "updatedAt" }
  ],
  "nextCursor": "..."
}
```

### `POST /api/bill/receipts`

Body:
```json
{
  "customerName": "string (required)",
  "customerPhone": "string?",
  "notes": "string?",
  "discountCents": 0,
  "items": [
    { "menuItemId": "abc", "quantity": 2 }
  ]
}
```
Server fetches each `MenuItem`, snapshots name/price into rows, computes subtotal/tax/total, generates a 16-char nanoid token, returns the full created receipt including `token` and the share URL.

### `GET /api/bill/receipts/:id`

Returns the receipt + items (for the edit screen).

### `PATCH /api/bill/receipts/:id`

Body: same shape as POST. Server replaces all items (delete + recreate within a Prisma transaction), updates header fields, recomputes totals, updates `updatedAt`. The `token` does **not** change — same public URL keeps working, content updates live.

### `DELETE /api/bill/receipts/:id`

Hard delete (cascades to items). Returns 204.

### `GET /r/:token` (public page, server-rendered)

Looks up by token, renders the public receipt page (Section 7.4). Returns 404 if not found.

## 7. UI / Page Flows

### 7.1 `/` — Password screen

Mobile-first. Single password input + submit. On success → `/list`.

If already authenticated (valid cookie), 302 to `/list`.

### 7.2 `/list` — History

- Header: "Bill" title + "+ 新建" button
- Each row: customer name, phone (if any), total, relative timestamp, three-dots menu
- Three-dots menu: "编辑" (→ `/edit/<id>`), "复制链接" (copy `/r/<token>` to clipboard), "删除" (with confirm)
- Tap row → goes to edit
- Infinite scroll using cursor pagination

### 7.3 `/new` and `/edit/[id]` — Editor

Single column, mobile-first:

1. **Items section** — list of selected items with `qty` stepper and a per-row delete
2. **"+ 加菜" button** — opens a bottom sheet listing all active `MenuItem`s grouped by category; tapping one adds a row (qty defaults to 1; tapping the same item again increments qty)
3. **Discount input** — single dollar field
4. **Customer info** — name (required), phone (optional, used for SMS)
5. **Notes** — optional free text
6. **Live totals card** — sticks to bottom of viewport, updates as the user edits:
   - Subtotal / Discount / Tax (8%) / **Total**
7. **Save button** — saves and goes to `/edit/<id>?saved=1` (share dialog appears at top)
8. **Share dialog** (after save):
   - Public URL with copy button
   - `Send via SMS` button (`<a href="sms:<phone>?body=Bobo's Farm receipt: <url>">`) — only enabled if phone is present
   - "Open Receipt" link → opens `/r/<token>` in a new tab so admin can preview

Edits in `/edit/<id>` update the same record, so the public URL content changes live — there is no draft state.

### 7.4 `/r/[token]` — Public receipt page

Server-rendered, no auth required, mobile-first.

- Top: Bobo's Farm logo + business name + address + phone
- Customer name + receipt timestamp
- Itemized table (name × qty × unit price)
- Subtotal / Discount (if > 0) / Tax (with rate label e.g. "Sales tax 8%") / **Total**
- Optional tip section:
  - Three buttons: 10% / 15% / 20%
  - "自定义" input
  - When clicked, **client-side JS** shows "Tip: $X.XX" and "Grand Total with Tip: $X.XX" below
  - No persistence
- Language toggle (zh ↔ en) in the corner; default zh

The page is intentionally readable, no interactive admin controls.

## 8. Main System Changes (the "顺手" tax setting)

This is the only edit that bleeds outside the bill subdomain. Kept minimal.

1. `prisma/seed-settings-v2.ts` — append:
   ```ts
   {
     key: "tax_rate",
     value: "0.08",
     description: "Sales tax rate as a decimal (Ulster County, NY = 0.08)",
   }
   ```
2. `src/app/(admin)/admin/settings/page.tsx` — add a numeric input under a "Tax" group:
   - Display as percentage (UI shows `8.00 %`), store as decimal in the setting
   - Min 0, max 1, step 0.0001
   - Saved via the existing setting-update mechanism
3. `messages/en.json` + `messages/zh.json` — add `admin.settings.taxRate` label + help text
4. Existing reservation / order code is **not** modified. Tax is currently not computed there and wiring it in is out of scope for this spec.

## 9. Computation Reference

```ts
// src/lib/bill/totals.ts
export function computeTotals(
  items: { priceCents: number; quantity: number }[],
  discountCents: number,
  taxRate: number,
): { subtotalCents: number; discountCents: number; taxCents: number; totalCents: number } {
  const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const clampedDiscount = Math.max(0, Math.min(discountCents, subtotalCents));
  const taxableCents = subtotalCents - clampedDiscount;
  const taxCents = Math.round(taxableCents * taxRate);
  const totalCents = taxableCents + taxCents;
  return { subtotalCents, discountCents: clampedDiscount, taxCents, totalCents };
}
```

This function is the single source of truth — called both server-side (on POST/PATCH) and re-implemented identically on the client (live totals card in the editor).

## 10. Testing Strategy

**Unit (`src/lib/bill/__tests__/`)**

- `computeTotals.test.ts` — subtotal, discount clamping, tax rounding, total
- `session.test.ts` — sign + verify roundtrip, tampered cookie rejection, expired cookie rejection
- `password.test.ts` — constant-time compare, env-var-driven, attempt throttle

**Integration (Jest + Prisma test DB)**

- POST receipt → row exists with correct snapshots
- PATCH receipt → items replaced, totals recomputed, `updatedAt` advances, `token` unchanged
- GET `/r/:token` after PATCH → returns updated content
- DELETE receipt → cascades to items

**Manual (Playwright MCP, per user's autonomous-execution preference)**

End-to-end golden path on a local dev server bound to `bill.localhost`:
1. Visit `/` → enter password → land on `/list`
2. Create a receipt with 2 items + discount → save → share dialog appears
3. Copy URL, open in fresh browser context (no cookie) → public receipt renders correctly
4. Go back, edit receipt (change qty, change discount) → save → refresh the public URL → content reflects edit
5. Delete the receipt → public URL returns 404
6. Tap tip 15% on public page → grand total updates client-side

## 11. Security & Edge Cases

- **Token unguessability:** 16-char nanoid from a 64-char alphabet ≈ 96 bits of entropy — not enumerable
- **No rate limit on `/r/:token`:** acceptable; tokens are unguessable and the page is read-only
- **Password lockout:** simple in-memory 5/10min counter per IP. Resets on server restart — fine for a low-traffic tool
- **CSRF:** API uses SameSite=Lax cookie; mutating endpoints require the cookie; no cross-site form posting expected. Acceptable for v1
- **Discount > subtotal:** server clamps to subtotal (no negative totals)
- **Empty items list:** server rejects with 400
- **Inactive menu items:** the picker only lists `isActive = true` menu items, but snapshotting means we never need to look them up again after creation
- **Decimal display:** always render `$X.XX` (cents formatted)

## 12. Removal Plan (Future)

When the tool is no longer needed:

1. `rm -rf src/app/\(bill\)/ src/app/api/bill/ src/lib/bill/`
2. New Prisma migration: `DROP TABLE quick_receipts; DROP TABLE quick_receipt_items;` and remove the two models from `schema.prisma`
3. Revert the bill-host dispatch and the `/panel*`, `/r*`, `/api/bill/*` 404 guards added to `src/middleware.ts`
4. Vercel:
   - Remove the `bill.bobos.farm` domain from the project
   - Delete `BILL_PASSWORD` and `BILL_SESSION_SECRET` env vars
5. DNS: remove the CNAME record for `bill.*`
6. Optionally keep the `tax_rate` SystemSetting and the settings-page field — they may be reused

No other code in the main system depends on bill code, so no further refactor needed.
