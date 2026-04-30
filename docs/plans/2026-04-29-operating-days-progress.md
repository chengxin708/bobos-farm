# Operating Days — Implementation Progress

**Date completed:** 2026-04-29
**Branch:** `main` (worked directly, no feature branch)
**Plan:** `docs/plans/2026-04-29-operating-days-plan.md`
**Spec:** `docs/plans/2026-04-29-operating-days-design.md`

## Summary

Shipped the v1 operating-days feature: weekday-closed-by-default + weekend-open-by-default,
with explicit per-date overrides (`OPEN` / `CLOSED` / `PRIVATE_EVENT`). Customer-facing
calendar greys out non-OPEN dates and routes those clicks into the inquiry form. Admins
get a tinted month/week/day calendar with a click-to-set popup. New reservations on a
default-closed weekday auto-promote that date to `PRIVATE_EVENT` to keep the existing
booking semantics consistent.

Final verification: **156/156 tests green**, **`tsc --noEmit` clean**, **lint clean on
touched files** (the existing 23 errors / 54 warnings on `npm run lint` are all
pre-existing on untouched files; verified by re-running lint against `5eb1b55` versions
of the touched files and getting identical output).

## Tasks 1–9

| # | Task | Commits | Notes |
|---|------|---------|-------|
| 1 | Schema + migration + backfill | `0375c79`, `6e09979` | Migration SQL hand-authored (dev pooler refused auth); backfill ET-DOW fix below |
| 2 | Pure `effectiveOperatingMode` helper + tests | `799b968`, `3f935fa` | Plan's `T00:00:00Z` fixtures rebased to `T12:00:00Z` to be ET/UTC-stable |
| 3 | Admin API (`/api/operating-days`) + server helper | `6dc3184`, `70da99d` | Auth path is `@/lib/auth-options`; ActivityLog audit + 404 on missing row |
| 4 | Slots API + availability/check integration | `0b95b5d`, `024dc64`, `5e817be`, `6e0945a` | Two timezone bugs caught in review (see deviations) |
| 5 | Customer calendar greys non-OPEN dates | `2bd7e98`, `9cf0821` | Renamed internal `'closed'` → `'outside'`; i18n aria-label + legend |
| 6 | Inquiry form prefill banner | `8b1700d` | Straightforward — no deviations |
| 7 | Admin calendar tint + popup + week/day filter | `4d3bf1b`, `bf7b3e0` | Multiple UX-polish follow-ups (click rule, a11y, optimistic update, empty week) |
| 8 | Auto-promote on reservation create + inquiry convert | `65638ba`, `b965db8` | Helper extracted with 7 unit tests |
| 9 | Final verification + progress doc | _this commit_ | — |

## Deviations from the plan

1. **Migration authored by hand (Task 1).** Dev DB connection-pooler refused auth
   during `prisma migrate dev`, so the `add_operating_days/migration.sql` was authored
   by hand and verified to match Prisma's auto-gen format byte-for-byte. Will be
   applied via `migrate deploy` against prod.

2. **ET DOW bug + race fix in backfill (Task 1).** `@db.Date` rows materialize at
   midnight UTC, so formatting in `America/New_York` shifts to the previous calendar
   day. Fix: format `@db.Date` reads with `timeZone: 'UTC'` (the `dbDateToCalendarKey`
   path). Also switched the apply path to `createMany({ skipDuplicates: true })` for
   atomic, race-safe inserts.

3. **Test fixtures shifted to noon UTC (Task 2).** The plan's
   `effectiveOperatingMode` fixtures used `T00:00:00Z` dates labeled
   "Saturday"/"Monday" — these labels disagreed with the helper's ET-based DOW.
   Tests adjusted to `T12:00:00Z` (noon UTC = same calendar date in both zones), and
   `2026-07-04` (a Saturday) was corrected to `2026-07-03` (Friday) for the
   "weekday with row OPEN" case. Helper unchanged (matches plan verbatim).

4. **Auth import + status-code split (Task 3).** Plan referenced `@/lib/auth`; the
   codebase uses `@/lib/auth-options`. The 401/403 split is now a discriminated-union
   `requireAdmin` return. Added a compile-time `_modeParity` assertion in
   `src/lib/operating-day.ts` to catch future drift between Prisma's enum and our
   shared TS literal type.

5. **Audit log + 404 (Task 3).** Per codebase convention, POST/PATCH/DELETE write
   ActivityLog entries; PATCH/DELETE return 404 (not 500) on missing rows.

6. **Two timezone bugs in availability path (Task 4).**
   - `checkAvailabilityForDate` initially built a UTC-midnight `Date` for
     `effectiveOperatingMode`; fixed to a noon-UTC sibling anchor so ET-DOW matches.
   - `loadOperatingDayMap` keyed its map by `etDateKey` of `@db.Date` rows
     (off-by-one) — fixed to use `dbDateToCalendarKey` (UTC calendar slice).
   - Extracted `closedDayProbeResult()` helper for testability.
   - Added "DO NOT USE for `@db.Date` rows" warning to `etDateKey` JSDoc.

7. **DateStatus naming (Task 5).** Internal `'closed'` cell status (used for past or
   outside-window cells) renamed to `'outside'` to free `'closed'` for the new public
   `DateStatus` value coming from the slots API. Follow-up commit added i18n
   aria-label + a legend chip.

8. **Task 6.** No deviations.

9. **Admin calendar UX polish (Task 7).** Several follow-ups beyond the plan's bare
   "popup":
   - Desktop month-cell click rule unified with mobile: empty cell → popup,
     busy cell → drill in (no longer weekday/weekend dependent).
   - `OperatingDayActionsMenu` got `role="dialog"`, `aria-modal`, Esc-to-close,
     and first-button auto-focus.
   - `handleOperatingDayAction` is optimistic (SWR `mutate` with rollback on error).
   - Empty-week fallback placeholder in week view.
   - Mobile filter excludes inquiries (mobile doesn't fetch them).

10. **Auto-promote helper extraction (Task 8).** Inlined logic was extracted to
    `autoPromoteIfClosed` with 7 unit tests covering OPEN / PRIVATE_EVENT / CLOSED,
    no-row-on-weekday vs no-row-on-weekend, and the `@db.Date` midnight-UTC boundary.
    Customer flow is **not** auto-promoted (Task 4's probe gates customer-facing
    closed dates into the inquiry funnel instead).

## Test counts (chronological)

```
122 (baseline)
133 (Task 2 helper + tests)
144 (Task 2 polish: hoist Intl + DST + all-DOW)
146 (Task 4 slots + check integration)
147 (Task 4 timezone fix)
149 (Task 4 closedDayProbeResult helper + JSDoc)
156 (Task 8 autoPromoteIfClosed extraction + tests)
```

## Verification (Task 9)

Run on `b965db8`:

```
npx jest             → 17 suites, 156 tests, all passing
npx tsc --noEmit     → clean (no output)
npm run lint         → 23 errors / 54 warnings overall
                       all errors/warnings on touched files are PRE-EXISTING
                       (verified by re-linting baseline 5eb1b55 versions of
                        CalendarDesktop.tsx, CalendarMobile.tsx,
                        api/reservations/route.ts → identical output)
```

Lint warnings on touched files (none new):
- `src/components/admin/calendar/CalendarDesktop.tsx`: `assignedCountByDate` unused
  (pre-existing).
- `src/components/admin/calendar/CalendarMobile.tsx`: `getWeekOfMonth` /
  `hasPending` / `isNewMonth` unused, `today` exhaustive-deps,
  `mutateSelectedResLogs` missing-dep (all pre-existing).
- `src/app/api/reservations/route.ts`: `assignYurtsForDate` /
  `checkDateAnomalies` unused (pre-existing).
- `src/lib/__tests__/operating-day.test.ts`: `_args` unused — matches the
  underscore-prefix mock-param convention used in the existing
  `claim-flow.test.ts` / `claim-token.test.ts`.

## Operator post-merge steps (manual)

These were intentionally not done in this session:

1. `vercel env pull --environment=production .env.local`
2. `DOTENV_CONFIG_PATH=.env.local npx prisma migrate deploy` — applies the
   `add_operating_days` migration.
3. `DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/backfill-operating-days.ts`
   — dry-run.
4. `DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/backfill-operating-days.ts --apply`
   — writes `PRIVATE_EVENT` rows for existing weekday reservations.
5. Manual smoke per plan Task 9 step 5 (customer calendar greys closed dates,
   inquiry form banner shows, admin can OPEN/CLOSED/PRIVATE_EVENT a date,
   weekday booking auto-promotes that date in the admin calendar).

## Punted to v2 (per design doc)

- Recurring open-day rules (e.g. "every Friday in October is OPEN").
- Customer-facing PRIVATE_EVENT access tokens.
- Holiday calendar import.
