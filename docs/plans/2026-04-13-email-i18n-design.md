# Email i18n + Template Redesign + Marketing Unsubscribe

**Date:** 2026-04-13
**Status:** Approved

## Overview

Redesign the email system to support bilingual (EN/ZH) templates, add language preference selection at registration, redesign email visual style with farm branding, and add marketing email unsubscribe infrastructure.

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| i18n approach | Translation dictionary in `email-strings.ts` | Type-safe, centralized, zero runtime overhead |
| Default email language | English | Most accessible default |
| Admin email language | Fixed Chinese | Admin team is Chinese-speaking |
| Language selection at registration | Dropdown in form | Explicit, simple |
| Date format | Follows email language | en-US for English, zh-CN for Chinese |
| Footer language hint | In footer above address, with link to settings | Visible but non-intrusive |
| Email visual style | Farm branding (green gradient header, cream cards) + high-readability body font | Brand consistency + clarity |
| Body font | Arial/Helvetica (system sans-serif) | Maximum email client compatibility and readability |
| Logo font | Georgia/serif (unchanged) | Brand identity |
| Marketing subscribe | Opt-in checkbox at registration, default checked | Respects user choice, good conversion |
| Unsubscribe | One-click token link, no login required | CAN-SPAM compliant |

## Architecture

### File Structure

```
src/lib/
├── email.ts              # Send functions (refactored: lang param, getUserLang)
├── email-strings.ts      # NEW: en/zh dictionaries for all 8 templates
└── email-template.ts     # NEW: emailWrapper + shared HTML helpers (extracted)

src/app/
└── unsubscribe/
    └── page.tsx           # NEW: one-click unsubscribe page
```

### Database Changes

```prisma
model User {
  // existing fields...
  marketingOptIn    Boolean   @default(true)
  unsubscribeToken  String?   @unique
}
```

- New users: `unsubscribeToken` generated at registration via `crypto.randomUUID()`
- Existing users: migration script generates tokens in bulk

### Email String Dictionary

```typescript
// email-strings.ts
type Lang = 'en' | 'zh';

const reservationCreated: Record<Lang, { subject: string; title: string; body: string; ... }> = {
  en: { subject: "Bobo's Farm — Reservation Created", title: "Reservation Created", ... },
  zh: { subject: "Bobo's Farm — 预订已创建", title: "预订已创建", ... }
};

// 8 customer templates × 2 languages
// Admin templates remain Chinese-only (not in dictionary)
```

### Language Resolution

```typescript
async function getUserLang(email: string): Promise<Lang> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { preferredLanguage: true }
  });
  return user?.preferredLanguage === 'ZH' ? 'zh' : 'en';
}
```

### Email Template Wrapper

```typescript
function emailWrapper(body: string, options: {
  lang: Lang;
  type: 'transactional' | 'marketing';
  unsubscribeToken?: string;
  siteUrl: string;
}): string
```

- `transactional`: footer = language switch hint (with link) + address
- `marketing`: footer = language switch hint + address + "Unsubscribe" link + `List-Unsubscribe` header

### Visual Redesign

**Header:**
- Green gradient: `linear-gradient(135deg, #4A7C59, #5B8C3E)`
- Logo: "Bobo's Farm" in Georgia/serif, white
- Subtitle: "波姐农家乐" in `rgba(255,255,255,0.7)`

**Info Cards:**
- Background: `#FFF8F0` (cream)
- Left border: `4px solid #5B8C3E` (green accent)

**CTA Button:**
- Color: `#5B8C3E` (brighter green)
- Border radius: `10px`

**Body Text:**
- Font: Arial, 'Helvetica Neue', Helvetica, sans-serif
- Color: `#4A4A4A` (improved contrast from #5A5A5A)

**Footer:**
- Language hint with link: "您可以访问网站更改邮件语言偏好。" / "You can change your email language preference on our website."
- Separator line
- Address + auto-message notice
- [Marketing only] Unsubscribe link

### Registration Page Changes

1. **Language dropdown** — below phone field, above password
   - Options: English (default), 中文
   - Field: `preferredLanguage`

2. **Marketing checkbox** — below confirm password, above submit
   - Default: checked
   - EN: "Receive updates about events, seasonal menus, and special offers"
   - ZH: "接收活动、时令菜单和优惠信息"

3. **Validation schema** addition:
   ```typescript
   preferredLanguage: z.enum(['EN', 'ZH']).default('EN'),
   marketingOptIn: z.boolean().default(true)
   ```

### Unsubscribe Flow

```
Email "Unsubscribe" link
  → GET /unsubscribe?token=xxx
    → Server validates token
    → Sets marketingOptIn = false
    → Shows confirmation page with "Resubscribe" button
    → Resubscribe: sets marketingOptIn = true
```

### Resend Headers (Marketing Emails)

```typescript
headers: {
  'List-Unsubscribe': '<https://bobosfarm.com/unsubscribe?token=xxx>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
}
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `marketingOptIn`, `unsubscribeToken` to User |
| `src/lib/email-strings.ts` | Create | 8 templates × 2 languages dictionary |
| `src/lib/email-template.ts` | Create | emailWrapper + HTML helpers extracted from email.ts |
| `src/lib/email.ts` | Refactor | Add lang param, getUserLang, reference dictionary |
| `src/app/api/auth/register/route.ts` | Modify | Accept preferredLanguage, marketingOptIn, generate token |
| `src/app/(auth)/register/page.tsx` | Modify | Add language dropdown + marketing checkbox |
| `src/lib/validations/auth.ts` | Modify | Add preferredLanguage, marketingOptIn to schema |
| `src/app/unsubscribe/page.tsx` | Create | One-click unsubscribe/resubscribe page |
| `messages/en.json` | Modify | Registration form new field labels |
| `messages/zh.json` | Modify | Registration form new field labels |

## Not Changed

- Admin emails (2): remain Chinese hardcoded
- NextAuth config: preferredLanguage already in JWT callback
- Middleware: no changes needed
- Language enum: EN/ZH already exists
