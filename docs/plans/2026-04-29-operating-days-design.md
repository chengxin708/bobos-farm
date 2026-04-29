# Operating Days — Design

**Date:** 2026-04-29
**Status:** Approved by operator (chengxin); ready for implementation plan
**Driver:** Bobo's Farm only operates weekends + holidays. Mon-Fri must default to closed for the public; admin retains override for private VIP events.

## Problem

Until now, every future date in the customer booking calendar has been bookable, gated only by yurt capacity / reservation count. The actual venue is closed Mon-Fri except for selected holidays and admin-arranged private events. As a result, customers can — and do — book weekday slots they should never have been offered. Admins must catch and reject those manually, or convert them to inquiry tickets after the fact.

We need a venue-level "is this date a working day?" concept that the booking flow respects, while preserving admin power to:

1. Open a specific weekday for a holiday or special event (公开节日加开)
2. Mark a closed weekday for a VIP / private event (关闭日 + 私人预订标记)
3. Close a normally-open weekend (停业维护)

## Operating Rule (the model)

A new table `OperatingDay`:

```
model OperatingDay {
  id        String              @id @default(cuid())
  date      DateTime            @db.Date  @unique
  mode      OperatingDayMode
  note      String?
  createdAt DateTime            @default(now())
  createdBy String?             // admin user id
}

enum OperatingDayMode {
  OPEN     // bookable by public (overrides default closed)
  VIP      // closed to public; admin manages a private/special booking
  CLOSED   // explicitly closed (overrides default open weekend)
}
```

**Day-of-week resolution:** Reservation dates are stored at UTC midnight (Prisma `@db.Date`). To compute the local day-of-week for "is it a weekend?", convert the UTC date to **America/New_York** time before reading the day-of-week, matching the rest of the codebase's ET-bias (e.g. the T-7 cron). Saturday = ET DOW 6, Sunday = ET DOW 0.

**Effective state for a date:**

| Day of week | Has row? | Effective state |
|---|---|---|
| Sat / Sun | no | OPEN (rule-based default) |
| Sat / Sun | row=CLOSED | CLOSED (maintenance) |
| Sat / Sun | row=OPEN | OPEN (no-op but valid) |
| Sat / Sun | row=VIP | VIP (rare; weekend reserved for private event) |
| Mon-Fri | no | CLOSED (rule-based default) |
| Mon-Fri | row=OPEN | OPEN (holiday or admin-extended) |
| Mon-Fri | row=VIP | VIP (admin-arranged private event) |
| Mon-Fri | row=CLOSED | CLOSED (no-op but valid) |

A pure helper `isOperatingDay(date, operatingDayMap): { mode, isPublic }` derives the effective state. `isPublic = true` only for OPEN. VIP and CLOSED are equivalent to the customer.

## User Behavior

### Customer-facing

- `/booking/date` calendar:
  - OPEN dates → green/normal, bookable.
  - CLOSED + VIP dates → grey, **not** bookable, click handler routes to `/inquiries/new?date=…&from=closed-day`. Same UX whether the date is plainly closed or held for a VIP event.
  - The booking-confirm probe (Task 5 of the dynamic-yurt-allocation plan) gains a "is operating day?" pre-check; non-operating → `shouldInquire: true, reason: 'closed_day'`.

### Admin-facing

- **Month view (admin calendar):** Layout unchanged. A subtle background tint distinguishes CLOSED weekdays from OPEN/VIP days. VIP gets a small gold badge; explicit OPEN-on-weekday gets a blue / "extended" badge.
- **Week view + Day view (admin calendar):** Filter to operating days (OPEN ∪ VIP) plus any date that has at least one reservation/inquiry. Closed days with no data are omitted from the compressed view.
- **Click-on-date popup in month view:**
  - Currently CLOSED weekday → menu: [Mark Open] [Enable VIP] [Cancel]
  - Currently OPEN weekday → menu: [Close] [Convert to VIP] [Cancel]
  - Currently VIP weekday → menu: [Close] [Make Public OPEN] [Cancel]
  - Currently OPEN weekend (default rule) → no menu opens by default; long-press / "More" surfaces [Mark Closed for Maintenance].
  - Currently VIP/CLOSED weekend (override) → menu: [Restore Default OPEN] [other modes] [Cancel].

The popup is one new UI piece, not a separate page. Admins manage operating-day status in-context.

## Auto-promote-to-VIP on Reservation Create

When admin creates a reservation (or converts an inquiry to a reservation) on a date whose effective state is CLOSED (no `OperatingDay` row, or row=CLOSED), the system **automatically** writes/updates the row to `mode=VIP, note='auto-set on reservation create'`. Reasons:

1. The new reservation is a real bookings on a closed day; the calendar must surface it.
2. Admins shouldn't need a second click ("first mark VIP, then create reservation") — the act of creating the reservation is the intent.
3. Audit log records who/why via `OperatingDay.createdBy + note`.

Same auto-promotion runs for inquiry → reservation conversion when the chosen date is closed.

## Migration / Backfill

Historical reservations on weekdays already exist (the recent 102-row CSV import + production data). On migration:

1. Run a backfill script: for every existing `Reservation` whose `date.day_of_week ∈ {Mon..Fri}` and which has no corresponding `OperatingDay` row, insert `OperatingDay { date, mode: 'VIP', note: 'backfill: weekday with existing reservation', createdBy: null }`.

2. Idempotent: re-running is safe (the `@@unique date` constraint prevents duplicates; the script checks-then-inserts).

3. Cancelled / expired reservations don't trigger backfill (they don't represent real activity).

## API

### New: `/api/operating-days`

Admin only. Routes:

- `GET /api/operating-days?startDate=&endDate=` — list rows in range
- `POST /api/operating-days` — body `{ date, mode, note? }`
- `PATCH /api/operating-days/[id]` — body `{ mode?, note? }`
- `DELETE /api/operating-days/[id]` — restore default rule

### Modified: `/api/availability/slots`

Add `mode: 'OPEN' | 'VIP' | 'CLOSED'` to each per-date entry so the customer calendar can grey out non-OPEN dates without a separate fetch.

### Modified: `/api/availability/check`

In `checkAvailabilityForDate`, before running `computeAvailabilityProbe`:

```
const effective = effectiveOperatingMode(date, operatingDayMap)
if (effective !== 'OPEN') {
  return { canFit: false, allYurtsFullForCount: true,
           anomalyReason: 'closed_day', shouldInquire: true }
}
// existing probe path …
```

So a customer attempting to book a closed weekday gets routed to inquiry without ever being told "no yurt fits" (which would be misleading — the day is closed regardless of fit).

### Modified: reservation create paths

Two locations:
1. `/api/reservations` POST — add the auto-promote-to-VIP step at the end of the transaction
2. `/api/inquiries/[id]/convert` POST — same auto-promote step

Both wrap the OperatingDay write in the same Prisma transaction as the reservation create, so a failed reservation never leaves a stale OperatingDay row.

## Frontend Changes

### Customer calendar (`/booking/date`)
- Fetch slots data already includes `mode` (per the slots API change above).
- `DatePickerCalendar` reads `mode` and applies `disabled + grey` styling to non-OPEN dates.
- Click handler on a non-OPEN date routes to `/inquiries/new?date=…&from=closed-day`.

### Admin calendar (`CalendarDesktop` + `CalendarMobile`)
- New SWR fetch for `/api/operating-days` over the visible window.
- Month view: tint weekday cells based on effective state. VIP badge for VIP days.
- Week / Day view: filter to OPEN ∪ VIP ∪ (dates with reservations or inquiries).
- New popup component `OperatingDayActionsMenu` rendered on date-cell click. Submits to `/api/operating-days` on action.

### Inquiry form (`/inquiries/new`)
- Read new query param `from=closed-day`. When present, prepend a one-line note to the form: "您选择的日期不在常规营业日,请告诉我们具体计划,我们会尽快回复 / This date is outside our regular operating days. Tell us about your plans and we'll get back to you."

## i18n Keys

New keys under existing namespaces. Bilingual (en + zh):

- `admin.calendar.operatingDay.markOpen` / `enableVip` / `markClosed` / `restoreDefault` / `convertToVip` / `makePublic`
- `admin.calendar.operatingDay.modeBadge.open` / `vip` / `closed`
- `customer.booking.closedDayInquireLabel` (the grey-day click label)
- `customer.inquiries.fromClosedDayBanner`

## Edge Cases & Decisions

- **Cancelling the last reservation on a VIP day:** Do NOT auto-revert VIP back to CLOSED. The admin set VIP intentionally; if they want to close it, they do so explicitly via the menu. Keeps the workflow predictable.
- **Multiple yurts closed on the same date (existing `YurtAvailability`):** Orthogonal to OperatingDay. A date can be `OPEN` (operating) but have all 3 yurts closed via `YurtAvailability` (rare, but legal). The slots API already handles per-yurt closures; OperatingDay layers on top.
- **Holidays imported from a static list:** Out of scope. Admins manage holidays manually via the calendar popup (one-click "Mark Open" per holiday, ~10 dates per year).
- **Customer's existing reservation on a closed date:** They can still see / modify / cancel it via `/admin/reservations` and customer flows. OperatingDay only gates NEW booking creation, not existing reservation management.
- **T-7 freeze interaction:** Within T-7, OperatingDay is still queried for display, but the closed/open status doesn't affect the freeze guard's behavior (freeze is about reshuffling existing assignments, not about new bookings, which are blocked anyway by the operating-day check at the customer probe).

## Out of Scope (v2 candidates)

- Recurring open-day rules (e.g. "every 3rd Friday", "Memorial Day weekend Friday")
- VIP-only customer-facing flow (customers with a token / role accessing closed days)
- Automatic holiday import from a calendar feed
- Operator-facing dashboard widget showing "next 30 days operating breakdown"
- Multi-venue / multi-region operating rules (Bobo's Farm is single-venue today)

## Implementation Sketch (rough phases — full plan to follow)

1. Prisma schema + migration + backfill script
2. Pure helper `effectiveOperatingMode(date, operatingDayMap)` + tests
3. `/api/operating-days` endpoint + tests
4. Slots API + availability/check API integration + customer calendar consumes mode
5. Inquiry form prefill banner for `from=closed-day`
6. Admin calendar — month-view tint + click popup + week/day view filter
7. Auto-promote-to-VIP in reservation create + inquiry convert
8. End-to-end smoke (manual): customer books weekend OK / customer clicks weekday → inquiry / admin opens a Monday → customer can book / admin VIP-flag a Tuesday → customer still sees grey, admin creates reservation, system auto-confirms VIP row
