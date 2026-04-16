# Email i18n + Template Redesign + Marketing Unsubscribe — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all customer emails bilingual (EN/ZH) based on user preference, redesign email visuals with farm branding, add language/marketing preferences to registration, and build one-click unsubscribe infrastructure.

**Architecture:** Translation dictionary pattern — `email-strings.ts` holds all 6 customer template strings in en/zh, `email-template.ts` holds the redesigned HTML wrapper and helpers, `email.ts` is refactored to accept a `lang` parameter and resolve user language from DB. Registration form gets language dropdown + marketing checkbox. Unsubscribe page uses token-based one-click flow.

**Tech Stack:** Next.js App Router, Prisma, Resend, Zod, next-intl, TypeScript

---

### Task 1: Prisma Schema — Add marketing fields to User

**Files:**
- Modify: `prisma/schema.prisma:52-71`

**Step 1: Add fields to User model**

In `prisma/schema.prisma`, add two fields to the User model after `image`:

```prisma
model User {
  id                String        @id @default(cuid())
  email             String        @unique
  name              String?
  phone             String?
  passwordHash      String?
  role              Role          @default(CUSTOMER)
  preferredLanguage Language      @default(EN)
  emailVerified     DateTime?
  image             String?
  marketingOptIn    Boolean       @default(true)
  unsubscribeToken  String?       @unique
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  accounts          Account[]
  reservations      Reservation[]
  activityLogs      ActivityLog[]
  pushSubscriptions PushSubscription[]

  @@map("users")
}
```

**Step 2: Generate and run migration**

Run:
```bash
cd next-app && npx prisma migrate dev --name add-marketing-fields
```

Expected: Migration creates `marketingOptIn` (boolean default true) and `unsubscribeToken` (string nullable unique) columns.

**Step 3: Backfill unsubscribeToken for existing users**

Create a one-time script. Run in the Prisma migration SQL or via a seed script:

```bash
npx prisma db execute --stdin <<'SQL'
UPDATE users SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;
SQL
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(db): add marketingOptIn and unsubscribeToken to User model"
```

---

### Task 2: Email Template — Redesigned HTML wrapper and helpers

**Files:**
- Create: `src/lib/email-template.ts`

**Step 1: Create email-template.ts with redesigned wrapper**

```typescript
// src/lib/email-template.ts

export type Lang = "en" | "zh";
export type EmailType = "transactional" | "marketing";

interface WrapperOptions {
  lang: Lang;
  type: EmailType;
  unsubscribeToken?: string;
  siteUrl: string;
}

const langHint: Record<Lang, string> = {
  en: '您可以在网站上更改邮件语言偏好。',
  zh: 'You can change your email language preference on our website.',
};

export function emailWrapper(body: string, opts: WrapperOptions): string {
  const { lang, type, unsubscribeToken, siteUrl } = opts;
  const settingsUrl = `${siteUrl}/settings`;
  const unsubUrl = unsubscribeToken
    ? `${siteUrl}/unsubscribe?token=${unsubscribeToken}`
    : null;

  const langSwitchLine = `<a href="${settingsUrl}" style="color:#5B8C3E;text-decoration:underline;">${langHint[lang]}</a>`;

  const unsubscribeLine =
    type === "marketing" && unsubUrl
      ? `<br/><a href="${unsubUrl}" style="color:#8A7E6B;text-decoration:underline;font-size:11px;">${lang === "en" ? "Unsubscribe" : "退订"}</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh" : "en"}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F8F7F4;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F7F4;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E8ECE4;">
  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#4A7C59,#5B8C3E);padding:28px 32px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:bold;color:#FFFFFF;font-family:Georgia,'Times New Roman',serif;">
        Bobo&#8217;s Farm
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7);font-family:Georgia,'Times New Roman',serif;">
        &#27874;&#22992;&#20892;&#23478;&#20048;
      </p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px;">
      ${body}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px;background-color:#F8F7F4;text-align:center;border-top:1px solid #E8ECE4;">
      <p style="margin:0 0 10px;font-size:11px;color:#8A7E6B;">
        ${langSwitchLine}
      </p>
      <p style="margin:0;font-size:11px;color:#8A7E6B;">
        Bobo&#8217;s Farm &mdash; 891 Albany Post Rd, New Paltz, NY 12561<br/>
        ${lang === "en" ? "This is an automated message. Please do not reply directly." : "此邮件为系统自动发送，请勿直接回复。"}
        ${unsubscribeLine}
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function formatDate(date: string | Date, lang: Lang): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#8A7E6B;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-size:14px;color:#3D2B1F;font-weight:600;">${value}</td>
  </tr>`;
}

export function infoTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#FFF8F0;border-radius:8px;border-left:4px solid #5B8C3E;margin:16px 0;">
    ${rows}
  </table>`;
}

export function primaryButton(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background-color:#5B8C3E;border-radius:10px;padding:12px 28px;text-align:center;">
      <a href="${href}" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;">${text}</a>
    </td></tr>
  </table>`;
}
```

**Step 2: Commit**

```bash
git add src/lib/email-template.ts
git commit -m "feat(email): create redesigned email template with bilingual support"
```

---

### Task 3: Email Strings — Translation dictionary for all 6 customer templates

**Files:**
- Create: `src/lib/email-strings.ts`

**Step 1: Create the full dictionary**

```typescript
// src/lib/email-strings.ts

import type { Lang } from "./email-template";

// Shared label translations used across multiple templates
const labels = {
  en: {
    date: "Date",
    yurt: "Yurt",
    guests: "Guests",
    deposit: "Deposit",
    deadline: "Payment Deadline",
    status: "Status",
    guestUnit: (n: number) => `${n} guest${n === 1 ? "" : "s"}`,
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    zelleTitle: "Zelle Payment Info:",
    zelleRecipient: "Recipient",
    zelleMemo: "Memo Code",
  },
  zh: {
    date: "预订日期",
    yurt: "营地",
    guests: "人数",
    deposit: "定金金额",
    deadline: "付款截止",
    status: "状态",
    guestUnit: (n: number) => `${n} 人`,
    confirmed: "已确认",
    cancelled: "已取消",
    zelleTitle: "Zelle 收款信息:",
    zelleRecipient: "收款人",
    zelleMemo: "备注码",
  },
} as const;

// ── 1. Reservation Created ──

const reservationCreated = {
  en: {
    subject: "Bobo's Farm — Reservation Created",
    title: "Reservation Created",
    body: "Your reservation has been created successfully. Please complete payment before the deadline.",
    warning: "Please pay the deposit via Zelle before the deadline. Unpaid reservations will be automatically cancelled.",
    button: "View My Reservations",
  },
  zh: {
    subject: "Bobo's Farm — 预订已创建",
    title: "预订已创建",
    body: "您的预订已成功创建，请在截止时间前完成付款。",
    warning: "请在截止时间前通过 Zelle 支付定金，逾期预订将自动取消。",
    button: "查看我的预订",
  },
} as const;

// ── 2. Deposit Confirmed ──

const depositConfirmed = {
  en: {
    subject: "Bobo's Farm — Deposit Confirmed",
    title: "Deposit Confirmed",
    body: "Your deposit has been confirmed and your reservation is now active! You can pre-order dishes ahead of time.",
    button: "Pre-order Dishes",
    footer: "If you have any questions, please contact us through our website. We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 定金已确认",
    title: "定金已确认",
    body: "您的定金已确认，预订正式生效！您可以提前预点菜品。",
    button: "预点菜品",
    footer: "如有任何问题，请通过网站联系我们。期待您的到来！",
  },
} as const;

// ── 3. Payment Reminder ──

const paymentReminder = {
  en: {
    subject: "Bobo's Farm — Payment Reminder",
    title: "Payment Reminder",
    body: "Your reservation deposit has not been paid yet. Please complete the payment as soon as possible to keep your reservation.",
    remaining: "Time Remaining",
    hours: (h: number) => `${h} hour${h === 1 ? "" : "s"}`,
    deadlineLabel: "Deadline",
    expiringSoon: "Expiring soon",
    button: "Pay Now",
    warning: "Failure to pay on time will result in automatic cancellation.",
  },
  zh: {
    subject: "Bobo's Farm — 付款提醒",
    title: "付款提醒",
    body: "您的预订定金尚未支付，请尽快完成付款以保留预订。",
    remaining: "剩余时间",
    hours: (h: number) => `${h} 小时`,
    deadlineLabel: "截止时间",
    expiringSoon: "即将到期",
    button: "立即付款",
    warning: "逾期未付款，预订将自动取消。",
  },
} as const;

// ── 4. Yurt Assigned ──

const yurtAssigned = {
  en: {
    subject: "Bobo's Farm — Yurt Assigned",
    title: "Yurt Assigned",
    body: "Your yurt has been assigned by our team. Please check the details below.",
    description: "Description",
    button: "View Reservation Details",
    footer: "If you have any questions, please contact us. We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 蒙古包已分配",
    title: "蒙古包已分配",
    body: "您的蒙古包已由我们的团队分配，请查看以下详情。",
    description: "描述",
    button: "查看预订详情",
    footer: "如有任何问题，请联系我们。期待您的到来！",
  },
} as const;

// ── 5. Reservation Modified ──

const reservationModified = {
  en: {
    subject: "Bobo's Farm — Reservation Updated",
    title: "Reservation Updated",
    body: "Your reservation has been updated. Please review the changes below:",
    updatedInfo: "Updated Reservation Info:",
    button: "View My Reservations",
    footer: "If you have any questions, please contact us. We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 预订已更新",
    title: "预订已更新",
    body: "您的预订信息已更新，请查看以下变更：",
    updatedInfo: "更新后的预订信息：",
    button: "查看我的预订",
    footer: "如有任何问题，请联系我们。期待您的到来！",
  },
} as const;

// ── 6. Reservation Cancelled ──

const reservationCancelled = {
  en: {
    subject: "Bobo's Farm — Reservation Cancelled",
    title: "Reservation Cancelled",
    body: "We're sorry, your reservation has been cancelled.",
    cancelReason: "Cancellation Reason",
    refundNote: (amount: number) =>
      `Your paid deposit of <strong>$${amount}</strong> will be processed according to our refund policy.`,
    button: "Book Again",
    contact: "If you have any questions, please contact us:",
  },
  zh: {
    subject: "Bobo's Farm — 预订已取消",
    title: "预订已取消",
    body: "很遗憾，您的预订已被取消。",
    cancelReason: "取消原因",
    refundNote: (amount: number) =>
      `您已支付的定金 <strong>$${amount}</strong> 将按照退款政策处理。`,
    button: "重新预订",
    contact: "如有任何疑问，请联系我们：",
  },
} as const;

export const emailStrings = {
  labels,
  reservationCreated,
  depositConfirmed,
  paymentReminder,
  yurtAssigned,
  reservationModified,
  reservationCancelled,
} as const;

export type { Lang };
```

**Step 2: Commit**

```bash
git add src/lib/email-strings.ts
git commit -m "feat(email): add bilingual email string dictionary for 6 customer templates"
```

---

### Task 4: Refactor email.ts — Use dictionary + lang param

**Files:**
- Modify: `src/lib/email.ts` (full rewrite)

**Step 1: Rewrite email.ts**

Replace the entire file. Key changes:
- Import `emailWrapper`, `formatDate`, `infoRow`, `infoTable`, `primaryButton` from `email-template.ts`
- Import `emailStrings` from `email-strings.ts`
- Add `getUserLang()` helper that queries `User.preferredLanguage` by email
- Each `send*` function calls `getUserLang(to)` to resolve language, then uses `emailStrings` dictionary
- Admin emails (templates 4 and 5) remain hardcoded Chinese, no dictionary lookup
- `emailWrapper` receives `{ lang, type: 'transactional', siteUrl }` for all current templates
- Each `send*` data interface gains optional `unsubscribeToken` for future marketing use

The full rewrite includes all 8 templates. Each customer-facing template follows this pattern:

```typescript
export async function sendReservationCreated(
  to: string,
  data: ReservationCreatedData
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const s = emailStrings.reservationCreated[lang];
  const l = emailStrings.labels[lang];
  const siteUrl = data.siteUrl || process.env.NEXTAUTH_URL || "https://bobosfarm.com";

  // ... build HTML using s.title, s.body, l.date, formatDate(data.date, lang), etc.
  // ... emailWrapper(body, { lang, type: 'transactional', siteUrl })

  await client.emails.send({ from: emailFrom, to, subject: s.subject, html });
  return { success: true };
}
```

Admin templates (4: `sendAdminNewReservation`, 5: `sendAdminDepositSubmitted`) keep Chinese hardcoded but use the new `emailWrapper` with `lang: 'zh'` and redesigned visuals.

**Step 2: Verify build**

Run: `cd next-app && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): refactor all templates to bilingual with redesigned visuals"
```

---

### Task 5: Registration — Add language dropdown + marketing checkbox

**Files:**
- Modify: `src/lib/validations/auth.ts:8-23`
- Modify: `src/app/api/auth/register/route.ts:20-46`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `messages/en.json` (auth.register section)
- Modify: `messages/zh.json` (auth.register section)

**Step 1: Update Zod schema**

In `src/lib/validations/auth.ts`, add two fields to `registerSchema`:

```typescript
export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().min(1, "Phone number is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    preferredLanguage: z.enum(["EN", "ZH"]).default("EN"),
    marketingOptIn: z.boolean().default(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

**Step 2: Update register API route**

In `src/app/api/auth/register/route.ts`, destructure new fields and pass to `prisma.user.create`:

```typescript
const { name, email, phone, password, preferredLanguage, marketingOptIn } = result.data;

// ... existing duplicate check and password hash ...

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
```

Add `import { randomUUID as _ } from 'crypto'` — actually use `crypto.randomUUID()` which is available in Node 19+ and Next.js edge. Or use the global `crypto.randomUUID()`.

**Step 3: Update register page UI**

In `src/app/(auth)/register/page.tsx`:

1. Add state:
```typescript
const [preferredLanguage, setPreferredLanguage] = useState('EN')
const [marketingOptIn, setMarketingOptIn] = useState(true)
```

2. Add language dropdown between phone and password fields:
```tsx
{/* Preferred Language */}
<div className="relative">
  <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1208]/30 pointer-events-none" />
  <select
    value={preferredLanguage}
    onChange={(e) => setPreferredLanguage(e.target.value)}
    style={{ border: '1px solid #E8ECE4', outline: 'none' }}
    className="w-full h-[52px] rounded-xl pl-11 pr-4 text-sm bg-white text-[#1A1208] focus:!border-[#6B7F5E] transition-colors appearance-none cursor-pointer"
  >
    <option value="EN">English</option>
    <option value="ZH">中文</option>
  </select>
</div>
```

3. Add marketing checkbox after confirm password, before submit:
```tsx
{/* Marketing opt-in */}
<label className="flex items-start gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={marketingOptIn}
    onChange={(e) => setMarketingOptIn(e.target.checked)}
    className="mt-0.5 w-4 h-4 accent-[#5B8C3E] cursor-pointer"
  />
  <span className="text-xs text-[#1A1208]/60 leading-relaxed">
    {t('marketingOptIn')}
  </span>
</label>
```

4. Add `Globe` to lucide-react imports.

5. Include new fields in fetch body:
```typescript
body: JSON.stringify({ name, email, phone, password, confirmPassword, preferredLanguage, marketingOptIn }),
```

**Step 4: Update i18n messages**

Add to `messages/en.json` inside `auth.register`:
```json
"preferredLanguage": "Email Language",
"marketingOptIn": "Receive updates about events, seasonal menus, and special offers from Bobo's Farm"
```

Add to `messages/zh.json` inside `auth.register`:
```json
"preferredLanguage": "邮件语言",
"marketingOptIn": "接收 Bobo's Farm 的活动、时令菜单和优惠信息"
```

**Step 5: Verify build**

Run: `cd next-app && npm run build`
Expected: Build passes.

**Step 6: Commit**

```bash
git add src/lib/validations/auth.ts src/app/api/auth/register/route.ts "src/app/(auth)/register/page.tsx" messages/en.json messages/zh.json
git commit -m "feat(auth): add language preference and marketing opt-in to registration"
```

---

### Task 6: Unsubscribe Page — One-click token-based unsubscribe/resubscribe

**Files:**
- Create: `src/app/unsubscribe/page.tsx`

**Step 1: Create the unsubscribe page**

This is a server component that:
1. Reads `?token=xxx` from search params
2. If no token → shows error
3. Looks up user by `unsubscribeToken`
4. If not found → shows "invalid link" error
5. If found and `action=resubscribe` → sets `marketingOptIn = true`, shows "resubscribed" message
6. Otherwise → sets `marketingOptIn = false`, shows "unsubscribed" with resubscribe button

```typescript
// src/app/unsubscribe/page.tsx
import { prisma } from "@/lib/prisma";

interface Props {
  searchParams: Promise<{ token?: string; action?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token, action } = await searchParams;

  if (!token) {
    return /* error UI: "Invalid unsubscribe link" */;
  }

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, marketingOptIn: true },
  });

  if (!user) {
    return /* error UI: "This unsubscribe link is invalid or has expired" */;
  }

  const resubscribe = action === "resubscribe";

  await prisma.user.update({
    where: { id: user.id },
    data: { marketingOptIn: resubscribe },
  });

  if (resubscribe) {
    return /* success UI: "You have been resubscribed!" */;
  }

  return /* success UI: "You have been unsubscribed" + resubscribe button linking to ?token=xxx&action=resubscribe */;
}
```

The page uses the farm brand header (green gradient), simple centered layout, and clear messaging in English (since unsubscribe links are in the email's own language, but the page itself is simple enough to be single-language with both EN/ZH text).

Actually — the page should respect the user's `preferredLanguage`. Query it alongside `marketingOptIn` and render accordingly.

**Step 2: Verify build**

Run: `cd next-app && npm run build`
Expected: Build passes, `/unsubscribe` route appears.

**Step 3: Commit**

```bash
git add src/app/unsubscribe/
git commit -m "feat(email): add one-click unsubscribe/resubscribe page"
```

---

### Task 7: Auth Options — Generate unsubscribeToken for Google OAuth users

**Files:**
- Modify: `src/lib/auth-options.ts:179-202`

**Step 1: Update Google OAuth new user creation**

In the `signIn` callback where new Google users are created (line 179), add `unsubscribeToken` and `marketingOptIn`:

```typescript
const newUser = await prisma.user.create({
  data: {
    email,
    name: user.name,
    image: user.image,
    emailVerified: new Date(),
    role: "CUSTOMER",
    preferredLanguage: "EN",
    marketingOptIn: true,
    unsubscribeToken: crypto.randomUUID(),
  },
});
```

**Step 2: Commit**

```bash
git add src/lib/auth-options.ts
git commit -m "feat(auth): generate unsubscribeToken for Google OAuth registrations"
```

---

### Task 8: Wire Resend List-Unsubscribe headers for marketing emails

**Files:**
- Modify: `src/lib/email.ts`

**Step 1: Update the email send helper**

In `email.ts`, add a helper or update each `send*` function to include `List-Unsubscribe` headers when `type === 'marketing'`. Since all current templates are transactional, this is prep work for future marketing emails. Add a documented exported function:

```typescript
/**
 * Send a marketing email with proper List-Unsubscribe headers.
 * Usage: call this for promotional/campaign emails (not transactional).
 */
export async function sendMarketingEmail(
  to: string,
  subject: string,
  body: string
): Promise<EmailResult> {
  const client = await getResend();
  if (!client) return { success: false, error: "API key not configured" };
  const emailFrom = await getEmailFrom();
  const lang = await getUserLang(to);
  const siteUrl = process.env.NEXTAUTH_URL || "https://bobosfarm.com";

  const user = await prisma.user.findUnique({
    where: { email: to },
    select: { marketingOptIn: true, unsubscribeToken: true },
  });

  if (!user?.marketingOptIn) {
    return { success: false, error: "User has unsubscribed from marketing emails" };
  }

  const html = emailWrapper(body, {
    lang,
    type: "marketing",
    unsubscribeToken: user.unsubscribeToken ?? undefined,
    siteUrl,
  });

  const unsubUrl = user.unsubscribeToken
    ? `${siteUrl}/unsubscribe?token=${user.unsubscribeToken}`
    : undefined;

  await client.emails.send({
    from: emailFrom,
    to,
    subject,
    html,
    headers: unsubUrl
      ? {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });

  return { success: true };
}
```

**Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): add sendMarketingEmail with List-Unsubscribe headers"
```

---

### Task 9: Final verification

**Step 1: Full build check**

Run: `cd next-app && npm run build`
Expected: Build passes with 0 errors.

**Step 2: Type check**

Run: `cd next-app && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Verify all new routes**

Check that `/unsubscribe` appears in the build output as a dynamic route.

**Step 4: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: lint fixes and final cleanup for email i18n"
```
