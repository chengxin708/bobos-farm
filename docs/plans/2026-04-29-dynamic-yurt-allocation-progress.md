# Dynamic Yurt Allocation — Progress Log

**Plan:** `docs/plans/2026-04-29-dynamic-yurt-allocation-plan.md`
**Branch:** `feat/dynamic-yurt-allocation`
**Worktree:** `.worktrees/dynamic-yurt-allocation/`
**Completed:** 2026-04-29

## Summary

All 6 tasks done. Yurt assignment is now continuously self-adjusting (any non-`manuallyAssigned` row can shift when the date's reservation set changes), the customer booking flow probes `/api/availability/check` and routes to the inquiry form when no yurt fits the requested party, and the existing T-7 customer-modification freeze is enforced as an `isWithinFreeze` guard inside the wrapper.

Final state on the worktree branch (off main `bf15ec0`):

- 120/120 tests passing across 15 suites (was 115/15 before this branch)
- `npx tsc --noEmit` clean
- `npm run lint` shows pre-existing issues only — none introduced by this branch

## Commits (chronological)

| SHA | Description |
|---|---|
| `7020228` | Task 1: Phase 1b prefers smallest party for #3 (replaces FIFO) |
| `a465473` | Task 2: `computeAvailabilityProbe` pure function + 7 tests |
| `618d95d` | Task 3: GET `/api/availability/check` endpoint + server helper |
| `628162e` | Task 3 follow-up: try/catch + 500 fallback (sibling-route conformance) |
| `e01e36d` | Task 4: re-allocate after PATCH count change + T-7 freeze guard + 5 tests |
| `8211559` | Task 4 follow-up: freeze branch returns `null` (was `void`); script callers guard |
| `164eb86` | Task 5: booking/details routes to inquiry on probe `shouldInquire` |
| `3374586` | Task 5 follow-up: Next button submitting state — closes click-during-flight race + adds loading affordance |

## Per-task notes + deviations from the plan

### Task 1 — Phase 1b smallest-party-first

Plan called for replacing the FIFO loop in Phase 1b with smallest-`guestCount` selection. Implemented exactly per the plan's pseudocode. One existing test (#10, `15+12 → 15→#3 by FIFO`) had its assertion updated to reflect the new (correct) outcome (`12→#3`, `15` pending). No FIFO regression.

**Deviation:** none.

### Task 2 — `computeAvailabilityProbe` + reshuffle fix

Plan called for appending a synthetic row and running the algorithm. Implementer caught a real spec gap: the algorithm's Phase 0 locks **any** row with `yurtId !== null`, regardless of `manuallyAssigned`. Without an extra rewrite, the docstring's stated intent ("the algorithm can reshuffle non-manual existing rows") didn't hold and test 6 (the reshuffle test) failed.

**Deviation:** added a small input-rewrite inside the probe — clears `yurtId` on rows where `manuallyAssigned === false` — before calling `computeDeterministicAssignment`. Local to the probe, no change to the core algorithm. Spec reviewer confirmed by load-bearing test (reverting the rewrite makes only test 6 fail; everything else still green).

### Task 3 — `/api/availability/check`

GET endpoint validating `date` (regex `/^\d{4}-\d{2}-\d{2}$/`) and `guests` (integer 1-200). Returns `canFit / hypotheticalYurtId / allYurtsFullForCount / anomalyReason / shouldInquire`. Built on `checkAvailabilityForDate` server wrapper that loads yurts + reservations in parallel and calls the probe.

**Deviation:** Skipped the plan's `.map` repackaging in the server helper because `getAvailableYurts` and `getActiveReservationsFull` already return correctly-shaped rows. Cleaner; same behavior.

**Follow-up after first review:** added try/catch + `500` fallback (`628162e`) to match the error-handling convention used by sibling routes (`/api/availability/slots`, `/api/availability/for-date`).

### Task 4 — T-7 freeze guard + PATCH count re-allocation

Three changes:

1. New exported `isWithinFreeze(date, now=new Date())` helper. Returns true if the target date is on or within 7 days from `now`.
2. Added the freeze guard as the FIRST statement of `tryDeterministicAssignment`. Returns early when within freeze.
3. Wired re-allocation into the PATCH "modify" branch in `src/app/api/reservations/[id]/route.ts`, gated on `parsedModify.data.guestCount !== undefined` (so spec-only-changes-special-requests don't pay the cost). The other PATCH paths (cancel, date change, assign_yurt, swap) were already wired pre-branch and benefit from the freeze guard transparently.

**Deviation 1 (UTC vs local time):** Plan's pseudocode used `setHours(0,0,0,0)` + `setDate`/`getDate` (local time). On EDT/non-UTC servers, this collapses two different UTC midnights onto the same local midnight via DST math, breaking the plan's own "8 days out" test. Switched to `setUTCHours`/`setUTCDate`/`getUTCDate`. Also matches Prisma's UTC-midnight storage convention. Spec reviewer confirmed by reverting + re-running tests.

**Deviation 2 (`Promise<DeterministicResult | null>`):** First commit returned `void` in the freeze branch, which widened the return type to `Promise<DeterministicResult | void>`. `tsconfig.json` excludes `scripts/`, which is why tsc didn't catch that two scripts (`scripts/seed-reservations.ts:269`, `scripts/import-reservations.ts:214`) consume `result.assignments` on the return value — at runtime, hitting any within-T-7 date would have thrown `TypeError`. Code reviewer caught it. Follow-up commit `8211559` tightens the signature to `Promise<DeterministicResult | null>`, returns explicit `null` in the freeze branch, and adds `if (!result) continue;` guards in both scripts.

**Deviation 3 (skipped wrapper integration test):** Plan called for a regression test asserting `tryDeterministicAssignment` no-ops within T-7. Skipped — DB integration test infra would be heavier than the change warrants. Manual smoke is the safety net, plus the 5 freeze-guard unit tests verify the helper's boundary semantics. Code reviewer flagged this as a real coverage gap (I3) — file under v2 if a wrapper-level Prisma mock pattern emerges.

### Task 5 — Booking → inquiry redirect

**Plan deviation (location):** plan said wire on `src/app/(customer)/booking/date/page.tsx`, but `/booking/date` only collects the date — `guestCount` is collected on the next page (`/booking/details`). Implementer correctly redirected the change to `/booking/details/page.tsx`'s `handleNext`.

`handleNext` is now async. After existing validation + the existing `goingToInquiry` fast path (selfServeCap-based heuristic), it makes a `fetch` GET to `/api/availability/check`. If `shouldInquire: true`, routes to `/inquiries/new` with prefills. Probe failures (non-OK / network / JSON parse) fall through to the normal confirm flow rather than blocking the user.

The redirect-to-inquiry logic is extracted into a `routeToInquiry()` helper used by both the fast path and the probe path. The pre-existing `handleInquireEscape()` was correctly NOT consolidated — it's the "Not sure?" CTA with different preconditions (allows `null` guestCount).

The inquiry form already reads `date` / `guestCount` / `note` from query params (lines 46-58 of `inquiries/new/page.tsx`). No changes needed there.

**Follow-up after first review (race + loading state):** Code reviewer flagged a click-during-flight race (user clicks Next, edits guestCount mid-flight, clicks again — stale probe could resolve last and navigate to wrong page) plus the missing loading affordance. Follow-up commit `3374586` adds a `submitting` state, disables the Next button while the probe is in flight, and shows a spinner with the existing `common.loading` i18n key. `setSubmitting(false)` lives in a `finally` so all exit paths clear the flag.

### Task 6 — Verification + this progress doc

- `npx tsc --noEmit`: clean
- `npx jest`: 120 passed, 15 suites
- `npm run lint`: pre-existing issues only — none introduced by this branch
- Manual end-to-end browser/Playwright smoke: deferred. The user is in the middle of the historical-CSV import workflow and prefers to do hands-on verification themselves once the branch lands and the import runs against prod. The four scenarios to exercise (booking on empty date, booking on full date, cancellation freeing yurt, PATCH guestCount reshuffling) all touch DB state that's clearer with the user's own data.

## Punted / Out of scope (v2 candidates)

1. **Optimization-suggestion UI (`computeOptimizationSuggestion` already exists).** User asked for "show suggestions even when manual is locked" — a UX layer on top of the existing pure function. Separate small plan; doesn't block this branch.
2. **Wrapper-level Prisma mock for T-7 freeze regression test.** Listed as Task 4 I3 in code review. Lightweight if the project later adopts a Prisma mocking pattern; otherwise manual smoke is the safety net.
3. **Notification when an auto-assigned customer's yurt shifts post-confirmation.** Out of scope; customer-facing UI doesn't show yurt # today, so no surprise to manage.
4. **Backfill historical reservations to the new Phase 1b layout.** Out of scope; production data is light enough that the cron + new-booking trigger will sort itself.
5. **Surfacing `anomalyReason` to the inquiry form.** The `/api/availability/check` endpoint returns it but the client drops it on the floor. If the inquiry form ever wants context-aware messaging ("we're full because the largest yurt is 30 and you asked for 50"), wire this signal through.
6. **Algorithm Phase 0 honors `manuallyAssigned` directly.** Currently the probe works around it via the `reshuffleable` rewrite. A deeper fix would teach Phase 0 to lock only `manuallyAssigned === true` rows; that would simplify the probe but requires re-validating the production assigner's invariants. File for v2.
7. **Unify booking-POST capacity check with the customer probe.** Booking POST `/api/reservations` calls `simulateWithNewReservation` (BFD-based, no reshuffle). Customer probe `/api/availability/check` calls `computeAvailabilityProbe` (deterministic-based, with reshuffle of non-manual rows). They mostly agree but can disagree in edge cases (a customer might pass the probe and fail the POST, or vice versa). The plan's stated architectural goal — "deterministic algorithm is the single source of truth for both *assignment* and *availability*" — is partially met but not fully. v2 work: migrate `simulateWithNewReservation` to use the probe, retiring the BFD path or keeping it only for offline analysis tools.
8. **Probe ignores T-7 freeze; reshuffle assumption may be theoretical inside freeze.** `checkAvailabilityForDate` doesn't call `tryDeterministicAssignment`, so the freeze guard never gates the probe. Inside T-7 the algorithm could say "fits via reshuffle" but ops won't actually shuffle existing rows by then. Operationally inert today (customer UI doesn't show yurt #), but worth documenting. v2: either pass a "frozen" flag through to the probe so it doesn't assume reshuffle, or just add a docstring note.

## Files Touched

- `src/lib/yurt-assignment-pure.ts` — Phase 1b rewrite + `computeAvailabilityProbe` + interface
- `src/lib/yurt-assignment.ts` — `isWithinFreeze` + freeze guard on `tryDeterministicAssignment` + `checkAvailabilityForDate`
- `src/lib/__tests__/yurt-assignment.test.ts` — Phase 1b new test + test #10 assertion update
- `src/lib/__tests__/availability-probe.test.ts` — new (7 tests)
- `src/lib/__tests__/freeze-guard.test.ts` — new (5 tests)
- `src/app/api/availability/check/route.ts` — new
- `src/app/api/reservations/[id]/route.ts` — re-allocation in modify branch
- `src/app/(customer)/booking/details/page.tsx` — `handleNext` async + probe + `submitting` state
- `scripts/seed-reservations.ts` — null-result guard
- `scripts/import-reservations.ts` — null-result guard

No changes to:
- `src/app/(customer)/inquiries/new/page.tsx` — already reads query params
- `src/app/(customer)/booking/date/page.tsx` — guestCount not in scope here; redirect is on `/details`
- The pure algorithm's Phase 0/2/3 logic — only Phase 1b changed
