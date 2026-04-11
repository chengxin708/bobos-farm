# Bobo's Farm Frontend Redesign

**Date:** 2026-04-10
**Status:** Approved
**Reference:** COLLINS x Sweetgreen (https://wearecollins.com/case-studies/sweetgreen/)

## Overview

Mobile-first, design-driven visual restructure of Bobo's Farm customer-facing frontend. All existing functionality preserved. Design language inspired by COLLINS/Sweetgreen — warm, organic, sophisticated, modern.

## Design Principles

1. **Design-led** — functionality serves the design, not the other way around
2. **Mobile-first** — phone experience is primary, PC is an expansion
3. **Restraint** — few colors, generous whitespace, quality over quantity
4. **Organic warmth** — feels handcrafted and alive, not template-generated
5. **Clarity** — every screen has one clear purpose

---

## Color System

| Role | Hex | Usage |
|------|-----|-------|
| Off-White | `#F8F7F4` | Page background, warm not pure white |
| Off-Black | `#1A1208` | Primary text, deep brown not pure black |
| Sage Green | `#6B7F5E` | Brand primary — buttons, links, accents |
| Sage Light | `#E8ECE4` | Light green blocks, card backgrounds, sections |
| Warm Gray | `#8C8478` | Secondary text, helper text |
| Terracotta | `#C47D52` | Accent — CTA highlights, prices, badges |
| Cream | `#F2EDE6` | Alternating section backgrounds |

**Usage principle:** Pages are predominantly Off-White + Off-Black. Sage Green appears only at key moments (nav, buttons, icons). Terracotta is used sparingly (prices, urgent info).

---

## Typography

| Role | English | Chinese | Purpose |
|------|---------|---------|---------|
| Headlines | DM Serif Display | Noto Serif SC | Page titles, section headers, dish names |
| Body | DM Sans | Noto Sans SC | Body text, buttons, forms, navigation |

### Type Scale

| Element | Desktop | Mobile | Weight | Line Height |
|---------|---------|--------|--------|-------------|
| Hero title | 48px | 32px | 400 | 1.05 |
| Section title | 32px | 24px | 400 | 1.15 |
| Card title | 20px | 18px | 400 | 1.2 |
| Body | 16px | 15px | 400 | 1.6 |
| Helper text | 14px | 13px | 400 | 1.5 |
| Badge/label | 12px | 12px | 500 | 1.0, uppercase, tracking 0.05em |

---

## Spacing System (8px base)

| Token | Value | Usage |
|-------|-------|-------|
| xs | 8px | Internal element spacing |
| sm | 16px | Adjacent element gaps |
| md | 24px | Card internal padding |
| lg | 40px | Section content spacing |
| xl | 64px | Between sections |
| 2xl | 96px (mobile: 64px) | Major page blocks |

## Border Radius

| Element | Radius |
|---------|--------|
| Buttons, badges | 999px (pill) |
| Cards, images | 16px |
| Input fields | 12px |
| Modals, panels | 24px |

---

## Navigation

### Mobile — Bottom Tab Bar

- Fixed bottom, height 64px, Off-White background + top 1px border
- 4 tabs: Home / Menu / Book / My
- Active: Sage Green icon + text
- Inactive: Warm Gray icon + text
- Icons: Lucide outline style
- Hidden on desktop

### Desktop — Top Navigation

- Transparent on hero, Off-White + subtle shadow on scroll
- Logo left, nav links center, language switch + auth right
- Link hover: Sage Green underline slides in

### Page max-width: 1200px centered, 24px side padding (mobile: 16px)

---

## Page Designs

### Landing Page (Mobile-first)

1. **Hero** — Full-screen farm photo, no dark overlay. Text at bottom with gradient fade for readability. Brand name in serif, location in sans. Sage Green pill CTA "Book a Visit".

2. **Story section** — Serif heading + short paragraph (Warm Gray). Single large photo with 16px radius.

3. **Experience cards** — 3 vertical cards (Cream background, 16px radius): Whole Roasted Lamb / Yurt Dining / Farm Walk. Icon + title + short description.

4. **CTA section** — Large atmospheric photo + serif heading + pill button.

5. **Footer** — Off-Black background, minimal links, bilingual branding.

**PC expansion:** Experience cards in 3-column row. Story section: text + image side by side alternating.

### Menu Page

- Serif page title at top
- Horizontal scrolling pill tabs for categories (active: Sage Green fill + white text, inactive: transparent + border)
- List items: 60x60 rounded image left, name (serif) + English subtitle + description + price (Terracotta) right
- Thin 1px Cream dividers between items, no card shadows
- Tap to expand: large image + full description (inline expand, no page navigation)
- Tags as small pill badges with Sage Light background

### Booking Flow (4 steps)

**Common pattern per step:**
- Top bar: back arrow left, "Step N/4" text right
- Serif title + English subtitle
- Content area (full screen)
- Fixed bottom: full-width Sage Green pill button

**Step 1 — Date Selection:**
- Calendar grid, large touch targets (44px+)
- Selected: Sage Green circle
- Availability dots: green/orange/red
- Bottom legend

**Step 2 — Yurt Selection:**
- Vertical card list: large photo (16px radius) + name + capacity + description
- Selected state: Sage Green border
- Available/unavailable badge

**Step 3 — Guest Details:**
- Large rounded inputs (12px radius), focus state Sage Green border, floating labels
- Guest counter with +/- pill buttons
- Special requests textarea

**Step 4 — Confirmation:**
- Summary card (Cream background) with all details
- Payment instructions (Zelle)
- Upload zone for payment screenshot
- Terms checkbox
- Confirm button (Terracotta for emphasis — this is the final action)

### Login / Register

- Full-screen mobile: centered card with Off-White background
- Serif title, rounded inputs, Sage Green primary button
- PC: split layout (left: farm photo, right: form card)

---

## Motion & Interaction

### Page Transitions
- Content enters with fade-up (opacity 0→1, translateY 16px→0), 300ms ease-out
- Booking steps: horizontal slide (next slides from right, back slides from left)

### Scroll Animations
- Sections fade-up on viewport entry, staggered 100ms delay between children
- No parallax — keep it clean

### Interaction Feedback
- Button hover: background darkens 10%, 0.2s ease
- Button press: scale(0.97)
- Card hover (PC only): translateY(-2px) + shadow deepens
- Tab switch: background slides with 0.3s ease
- Input focus: border transitions to Sage Green, label floats up
- Calendar select: green circle scales in with spring easing

### Loading States
- Skeleton screens: Cream background with subtle opacity pulse (no sliding shimmer)
- Button loading: text replaced with bouncing dots

### Bottom Tab
- Active icon: scale spring-in + color change, no extra decoration

### Principle
All motion serves **confirmation of action**. No purely decorative animation. Interface feels alive but not noisy.

---

## Technical Notes

- Framework: Next.js (App Router) + Tailwind CSS v4
- Fonts: Google Fonts (DM Serif Display, DM Sans, Noto Serif SC, Noto Sans SC)
- Icons: Lucide React (outline style)
- Images: next/image for optimization (upgrade from current Unsplash CDN URLs)
- Animations: CSS transitions + Tailwind, framer-motion only if needed for complex gestures
- Responsive: mobile-first breakpoints (sm: 640px, md: 768px, lg: 1024px)
- All existing functionality, API routes, auth, i18n preserved — only UI layer changes
