# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mobile-first visual redesign of all customer-facing pages — COLLINS/Sweetgreen-inspired warm organic style with new color system, typography, navigation, and interactions. All functionality preserved.

**Architecture:** Pure UI-layer rewrite. Same Next.js App Router structure, same API routes, same BookingContext, same i18n, same auth. Replace globals.css theme + rewrite every customer component and page. Admin pages untouched.

**Tech Stack:** Next.js 16 + Tailwind CSS v4 + DM Serif Display + DM Sans + Lucide React + framer-motion (new, for page transitions)

**Design Doc:** `docs/plans/2026-04-10-frontend-redesign.md`

---

## Task 1: Foundation — Theme & Fonts

**Files:**
- Modify: `src/app/globals.css` (full rewrite of theme + component classes)
- Modify: `src/app/layout.tsx` (swap fonts to DM Serif Display + DM Sans)
- Modify: `package.json` (add framer-motion)

**Step 1: Install framer-motion**

```bash
cd next-app && npm install framer-motion
```

**Step 2: Update root layout fonts**

Replace `Libre_Baskerville` + `Source_Sans_3` with `DM_Serif_Display` + `DM_Sans` from `next/font/google`. Keep Noto Serif SC + Noto Sans SC for Chinese fallback. Update CSS variable names to match.

```typescript
import { DM_Serif_Display, DM_Sans, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";

const dmSerif = DM_Serif_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});
```

Body class: `${dmSerif.variable} ${dmSans.variable} ${notoSerifSC.variable} ${notoSansSC.variable} antialiased`

**Step 3: Rewrite globals.css theme**

Replace the entire `@theme` block with new color system. Keep admin colors unchanged.

New customer colors:
```css
@theme {
  /* === Customer — Organic Warm Palette === */
  --color-off-white: #F8F7F4;
  --color-off-black: #1A1208;
  --color-sage: #6B7F5E;
  --color-sage-light: #E8ECE4;
  --color-sage-dark: #4F6344;
  --color-warm-gray: #8C8478;
  --color-terracotta: #C47D52;
  --color-terracotta-light: #F5EBE2;
  --color-cream: #F2EDE6;

  /* === Admin Colors (unchanged) === */
  --color-sidebar-bg: #1E1A14;
  /* ... keep all admin colors as-is ... */

  /* === Font Stacks === */
  --font-serif: var(--font-serif), var(--font-noto-serif-sc), "Songti SC", "SimSun", serif;
  --font-sans: var(--font-sans), var(--font-noto-sans-sc), "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

Update base layer:
```css
@layer base {
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--font-sans);
    background-color: #F8F7F4;
    color: #1A1208;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
  }
  ::selection {
    background-color: rgba(107, 127, 94, 0.2);
    color: #1A1208;
  }
}
```

Replace animations:
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

.animate-fade-up {
  animation: fadeUp 0.3s ease-out both;
}
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
```

Replace component classes:
```css
/* Pill button */
.btn-pill {
  border-radius: 999px;
  transition: background-color 0.2s ease, transform 0.15s ease;
}
.btn-pill:hover { filter: brightness(0.9); }
.btn-pill:active { transform: scale(0.97); }

/* Card */
.card-organic {
  border-radius: 16px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card-organic:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(26, 18, 8, 0.06);
}

/* Skeleton */
.skeleton-pulse {
  background-color: #F2EDE6;
  animation: pulse 1.5s ease-in-out infinite;
  border-radius: 8px;
}

/* Focus */
:focus-visible {
  outline: 2px solid #6B7F5E;
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Step 4: Verify build passes**

```bash
npm run build
```

Expected: Build passes. Visual appearance may look broken (colors changed but components still reference old classes) — that's fine, we fix components next.

**Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx package.json package-lock.json
git commit -m "feat(redesign): new theme — sage green palette, DM Serif/Sans fonts, organic animations"
```

---

## Task 2: Mobile Bottom Tab Navigation

**Files:**
- Create: `src/components/customer/BottomTabs.tsx`
- Modify: `src/components/customer/Navbar.tsx` (rewrite for desktop-only top nav)
- Modify: `src/app/(customer)/layout.tsx` (add BottomTabs, adjust padding)

**Step 1: Create BottomTabs component**

New file `src/components/customer/BottomTabs.tsx`:

```tsx
"use client"
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, UtensilsCrossed, CalendarDays, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

const tabs = [
  { key: 'home', href: '/', icon: Home },
  { key: 'menu', href: '/menu', icon: UtensilsCrossed },
  { key: 'book', href: '/booking/date', icon: CalendarDays },
  { key: 'my', href: '/reservations', icon: User },
]

export default function BottomTabs() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                    bg-[#F8F7F4] border-t border-[#E8ECE4]
                    h-16 flex items-center justify-around
                    safe-area-bottom">
      {tabs.map(({ key, href, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link key={key} href={href}
            className={`flex flex-col items-center gap-0.5 text-[11px]
              ${active ? 'text-[#6B7F5E]' : 'text-[#8C8478]'}
              transition-colors duration-200`}>
            <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            <span>{t(key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

**Step 2: Rewrite Navbar for desktop + mobile minimal top bar**

Rewrite `src/components/customer/Navbar.tsx`:
- Desktop (md+): Logo left, nav links center (Menu, About, Gallery), language + auth right. Transparent initially, Off-White on scroll.
- Mobile: Minimal top bar with logo only (navigation handled by BottomTabs). No hamburger menu needed.
- Remove glass-nav, remove amber colors, use new sage palette.

Key changes:
- Background: transparent → `bg-[#F8F7F4]/95 backdrop-blur-md` on scroll
- Links hover: sage green underline
- Book Now button: `bg-sage text-white rounded-full px-5 py-2`
- Language toggle: subtle pill, sage when active
- Mobile: just logo centered, language toggle right, no hamburger

**Step 3: Update customer layout**

Modify `src/app/(customer)/layout.tsx`:
- Add `<BottomTabs />` at bottom
- Add `pb-16 md:pb-0` to main content for bottom tab spacing on mobile
- Hide bottom tabs on booking flow routes (already has its own bottom bar)

**Step 4: Add i18n keys for bottom tabs**

Check existing i18n messages for 'nav.home', 'nav.menu', 'nav.book', 'nav.my' — add if missing.

**Step 5: Verify on mobile viewport**

```bash
npm run dev
```

Open http://localhost:3000, use browser devtools mobile view (375px). Verify:
- Bottom tabs visible with 4 icons
- Active tab is sage green
- Tapping navigates correctly
- Top nav shows only logo on mobile

**Step 6: Commit**

```bash
git add src/components/customer/BottomTabs.tsx src/components/customer/Navbar.tsx src/app/(customer)/layout.tsx
git commit -m "feat(redesign): mobile bottom tab nav + simplified desktop top nav"
```

---

## Task 3: Footer Redesign

**Files:**
- Modify: `src/components/customer/Footer.tsx`

**Step 1: Rewrite Footer**

New design:
- Background: `bg-[#1A1208]` (keep dark)
- Simplified layout: Logo + tagline top, then 2-column links, then copyright bottom
- Text: Off-White `#F8F7F4` with `opacity-60` for secondary
- Links hover: sage green
- Remove 4-column layout, simplify to stacked on mobile, 2-col on desktop
- Keep bilingual branding

**Step 2: Hide footer on mobile** (optional — bottom tabs replace footer nav)

On mobile, footer only shows on pages you scroll to the bottom. Add adequate spacing above bottom tabs.

**Step 3: Verify and commit**

```bash
git add src/components/customer/Footer.tsx
git commit -m "feat(redesign): minimal organic footer"
```

---

## Task 4: Landing Page

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

**Step 1: Rewrite hero section**

- Full-viewport farm photo background
- NO dark overlay — use bottom gradient (transparent → Off-White) for text readability
- Brand name: DM Serif Display, white, positioned bottom-left
- Location: DM Sans, smaller, white/80
- Single CTA: "Book a Visit" sage green pill button
- Image: use `next/image` with `fill` + `object-cover` + `priority`

**Step 2: Rewrite story section**

- Serif heading "From Our Farm to Your Table"
- 2-3 lines of description in Warm Gray
- One large rounded (16px) photo
- Mobile: stacked. Desktop: text left, image right

**Step 3: Rewrite experience cards**

- 3 cards: Whole Roasted Lamb / Yurt Dining / Farm Walk
- Cream background (#F2EDE6), 16px radius
- Lucide icon (Flame, Tent, Leaf) in sage green
- Serif card title + sans description
- Mobile: vertical stack. Desktop: 3-column row

**Step 4: Rewrite CTA section**

- Large atmospheric photo (full width, rounded corners)
- Below photo: serif heading + sage pill button
- Clean, no overlay needed

**Step 5: Remove unnecessary sections**

- Remove: "How It Works" numbered grid (too template-like)
- Remove: Gallery masonry (too cluttered)
- Keep it minimal: Hero → Story → Experience → CTA → Footer

**Step 6: Add scroll fade-up animations**

Use framer-motion `motion.div` with `whileInView` for each section:
```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-50px" }}
  transition={{ duration: 0.4, ease: "easeOut" }}
>
```

**Step 7: Verify mobile + desktop**

Check at 375px and 1280px. Verify:
- Hero photo fills screen, text readable without overlay
- Cards stack properly on mobile
- Animations trigger on scroll
- CTA button navigates to /booking/date

**Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(redesign): organic landing page — hero, story, experience cards, CTA"
```

---

## Task 5: Menu Page

**Files:**
- Modify: `src/app/(customer)/menu/page.tsx` (full rewrite)

**Step 1: Rewrite category tabs**

- Horizontal scrolling container with `overflow-x-auto`, hide scrollbar
- Pill-shaped tabs: active = `bg-sage text-white`, inactive = `border border-sage/30 text-off-black`
- Keep emoji + category name
- Smooth scroll on tap

**Step 2: Rewrite menu item list**

Replace 3-column card grid with list layout:
- Each item: 60x60 rounded-xl image left, content right
- Content: name (serif, 18px) + English subtitle (sans, 13px, warm-gray) + description (14px, 2-line clamp)
- Price: terracotta color, right-aligned or below description
- Tags: small pills with sage-light background
- Divider: 1px `border-cream` between items
- No card shadows, no hover lift

**Step 3: Add item detail expansion**

On tap, item expands inline:
- Large image (full width, rounded 16px)
- Full description text
- All tags visible
- Pre-order notice if applicable
- Smooth height animation (framer-motion `AnimatePresence` + `motion.div`)

**Step 4: Preserve all existing logic**

Keep unchanged:
- SWR fetch for categories and items
- Auth overlay for non-authenticated users
- Skeleton loading states (update to use `skeleton-pulse` class)
- i18n translations

**Step 5: Verify and commit**

```bash
git add src/app/(customer)/menu/page.tsx
git commit -m "feat(redesign): menu page — list layout, pill tabs, inline expansion"
```

---

## Task 6: Booking Step 1 — Date Selection

**Files:**
- Modify: `src/app/(customer)/booking/date/page.tsx` (full rewrite)
- Modify: `src/app/(customer)/booking/layout.tsx` (remove old stepper, add step indicator)
- Delete or archive: `src/components/customer/BookingStepper.tsx` (replace with simple text)

**Step 1: Simplify booking layout**

Replace `BookingStepper` component with minimal step indicator:
- Top bar: `← Back` button left, `Step N/4` text right
- Remove circle+connector progress bar entirely
- Keep `BookingProvider` context wrapper

```tsx
// In booking layout top bar
<div className="flex items-center justify-between px-4 py-3">
  <button onClick={() => router.back()} className="text-off-black">
    <ChevronLeft size={24} />
  </button>
  <span className="text-sm text-warm-gray">Step {step}/4</span>
</div>
```

**Step 2: Rewrite date page**

- Serif title "Select a Date" + small English subtitle
- Calendar: sage green selected circle, warm-gray text, large touch targets (min 44px)
- Available dates: normal text
- Limited: orange dot indicator below date number
- Full: gray strikethrough text
- Past dates: very light opacity
- Bottom fixed bar: full-width sage green pill button "Next"

**Step 3: Preserve all data logic**

Keep unchanged:
- SWR fetches for availability, settings, yurts
- BookingContext state management
- Date validation (min/max advance days)
- Navigation guards

**Step 4: Verify and commit**

```bash
git add src/app/(customer)/booking/layout.tsx src/app/(customer)/booking/date/page.tsx
git commit -m "feat(redesign): booking date — clean calendar, minimal step indicator"
```

---

## Task 7: Booking Step 2 — Yurt Selection

**Files:**
- Modify: `src/app/(customer)/booking/yurt/page.tsx` (full rewrite)

**Step 1: Rewrite yurt cards**

- Vertical card list (not grid)
- Each card: large photo (aspect-[4/3], rounded 16px) + name (serif) + capacity badge + description
- Available: sage green "Available" pill badge on image
- Booked: gray "Booked" badge, card reduced opacity
- Selected state: 2px sage green border around entire card + small check icon
- Mobile: full-width cards stacked. Desktop: max-width 600px centered

**Step 2: Preserve logic**

Keep: SWR fetch, redirect if no date, BookingContext updates, empty states.

**Step 3: Verify and commit**

```bash
git add src/app/(customer)/booking/yurt/page.tsx
git commit -m "feat(redesign): booking yurt — vertical cards, sage selection state"
```

---

## Task 8: Booking Step 3 — Guest Details

**Files:**
- Modify: `src/app/(customer)/booking/details/page.tsx` (full rewrite)

**Step 1: Rewrite form inputs**

- Large rounded inputs: `rounded-xl border border-cream focus:border-sage`
- Floating labels that animate up on focus (CSS transition)
- Input height: 52px for comfortable touch
- Guest counter: `- [count] +` with pill-shaped minus/plus buttons
- Special requests: rounded textarea, auto-grow

**Step 2: Rewrite capacity notice**

- Sage-light background pill with info icon
- Dismissible with X button

**Step 3: Bottom fixed button**

- Full-width sage green pill "Next"
- Disabled state: reduced opacity when form invalid

**Step 4: Preserve logic**

Keep: validation, touched state tracking, session pre-fill, BookingContext updates.

**Step 5: Verify and commit**

```bash
git add src/app/(customer)/booking/details/page.tsx
git commit -m "feat(redesign): booking details — organic form inputs, floating labels"
```

---

## Task 9: Booking Step 4 — Confirmation

**Files:**
- Modify: `src/app/(customer)/booking/confirm/page.tsx` (full rewrite)

**Step 1: Rewrite summary card**

- Cream background, rounded 16px
- Date, yurt, guests, contact info listed with clear labels
- Serif heading "Your Reservation"
- Deposit amount: large terracotta text

**Step 2: Rewrite payment section**

- Zelle instructions as numbered steps in clean cards
- Copy buttons: pill-shaped with sage outline
- Payment memo in a highlighted cream box

**Step 3: Rewrite upload zone**

- Rounded 16px dashed border area
- Sage green upload icon
- Preview: rounded image or file icon
- Drag & drop + tap to upload

**Step 4: Rewrite countdown timer**

- Clean text display: "Payment due in 11:42:30"
- Changes to terracotta when < 6 hours
- Expired state: red text + disabled submit

**Step 5: Final submit button**

- Terracotta pill button (not sage — this is the final action, needs visual distinction)
- Terms checkbox above, aligned left

**Step 6: Preserve logic**

Keep: reservation creation on mount, file upload to Supabase, countdown timer, success/expired states.

**Step 7: Verify and commit**

```bash
git add src/app/(customer)/booking/confirm/page.tsx
git commit -m "feat(redesign): booking confirm — summary card, terracotta CTA, clean upload"
```

---

## Task 10: Login & Register Pages

**Files:**
- Modify: `src/app/(auth)/login/page.tsx` (full rewrite)
- Modify: `src/app/(auth)/register/page.tsx` (full rewrite)

**Step 1: Rewrite login page**

- Mobile: centered white card on off-white background, no split layout
- Desktop: split layout — left: full-height farm photo, right: form card
- Form: serif heading "Welcome Back", rounded inputs, sage green pill submit button
- Error: terracotta text with subtle background
- OAuth: outlined pill button for Google
- Register link at bottom

**Step 2: Rewrite register page**

- Same layout pattern as login
- Fields: name, email, password, confirm password
- Sage green submit button

**Step 3: Preserve logic**

Keep: signIn/signOut, callbackUrl routing, error handling, OAuth config.

**Step 4: Verify and commit**

```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/register/page.tsx
git commit -m "feat(redesign): auth pages — organic form, split layout desktop"
```

---

## Task 11: Secondary Pages

**Files:**
- Modify: `src/app/(customer)/reservations/page.tsx`
- Modify: `src/app/(customer)/settings/page.tsx`
- Modify: `src/app/(customer)/pre-order/page.tsx`
- Modify: `src/app/(customer)/cancellation/page.tsx`
- Modify: `src/app/(customer)/privacy/page.tsx`
- Modify: `src/app/(customer)/terms/page.tsx`

**Step 1: Reservations page**

- Reservation cards: cream background, rounded 16px
- Status badges: sage (confirmed), terracotta (pending), warm-gray (cancelled)
- Date/yurt info with serif headings
- Empty state: illustration or simple text + CTA to book

**Step 2: Settings page**

- Clean form with rounded inputs matching booking details style
- Section cards with cream background

**Step 3: Pre-order page**

- Same list layout as menu page
- Add-to-cart interaction with sage green button

**Step 4: Legal pages (privacy, terms, cancellation)**

- Clean serif headings, sans body text
- Off-white background, max-width 680px centered
- Adequate line height and paragraph spacing

**Step 5: Verify and commit**

```bash
git add src/app/(customer)/reservations/page.tsx src/app/(customer)/settings/page.tsx src/app/(customer)/pre-order/page.tsx src/app/(customer)/cancellation/page.tsx src/app/(customer)/privacy/page.tsx src/app/(customer)/terms/page.tsx
git commit -m "feat(redesign): secondary pages — reservations, settings, pre-order, legal"
```

---

## Task 12: Polish & Final Verification

**Files:**
- All customer-facing files

**Step 1: Cross-page consistency check**

- Verify all pages use new color tokens (no leftover amber, brown, old cream references)
- Verify all buttons use pill style
- Verify all cards use 16px radius
- Verify all inputs use 12px radius with sage focus

**Step 2: Mobile viewport testing**

Test at 375px width:
- [ ] Landing page scrolls smoothly, hero fills screen
- [ ] Bottom tabs visible and functional on all pages
- [ ] Menu page: tabs scroll horizontally, items tap to expand
- [ ] Booking flow: each step fills screen, bottom button always visible
- [ ] Login/register: form centered and comfortable

**Step 3: Desktop viewport testing**

Test at 1280px width:
- [ ] Top nav visible, bottom tabs hidden
- [ ] Landing page: sections expand to use space with max-width
- [ ] Menu: list items comfortable width (max ~800px centered)
- [ ] Booking: centered content, not stretched full width

**Step 4: Animation smoothness**

- Verify fade-up on scroll is smooth (no jank)
- Verify booking step transitions are smooth
- Verify no layout shifts during loading

**Step 5: Build verification**

```bash
npm run build
```

Expected: 0 errors, all routes compile.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(redesign): polish — consistency, responsive fixes, animation tuning"
```

---

## Summary

| Task | Scope | Key Changes |
|------|-------|-------------|
| 1 | Foundation | New colors, fonts, animations, globals.css |
| 2 | Navigation | Mobile bottom tabs + desktop top nav |
| 3 | Footer | Simplified dark footer |
| 4 | Landing | Hero + story + experience cards + CTA |
| 5 | Menu | List layout, pill tabs, inline expansion |
| 6 | Booking Date | Clean calendar, minimal step indicator |
| 7 | Booking Yurt | Vertical cards, sage selection |
| 8 | Booking Details | Organic inputs, floating labels |
| 9 | Booking Confirm | Summary card, terracotta CTA |
| 10 | Auth | Login + register redesign |
| 11 | Secondary | Reservations, settings, pre-order, legal |
| 12 | Polish | Consistency, responsive, animations |

**Total: 12 tasks, all customer-facing. Admin untouched.**
