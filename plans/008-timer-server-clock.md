# Plan 008: Anchor the shared timer to server-stamped start times

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- convex/games.ts convex/validation.ts components/poker/timer/ tests/ convex/games.test.ts`
> Plans 002/003 are EXPECTED to have added `convex/games.test.ts` and
> changed `convex/games.ts` (vote masking in `getViewerState`) before this
> plan runs — that is not drift. Anything else changed in the excerpted
> regions below is.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (touches the realtime timer protocol; optimistic UI must
  stay smooth)
- **Depends on**: plans/002-convex-authz-tests.md (test harness), and run
  AFTER plans/003-mask-prereveal-votes.md and
  plans/006-ui-correctness-a11y-batch.md to avoid merge conflicts in
  `convex/games.ts` and `timer-progress-popup.tsx`
- **Category**: bug
- **Planned at**: commit `8b771d7`, 2026-06-12

## Why this matters

The shared countdown timer is anchored to the **moderator's device
clock**: when the mod presses start, the client computes
`startedAt = Date.now() - elapsed*1000` and stores that timestamp; every
viewer then renders `now() - startedAt` using their own clock. A moderator
with a skewed clock skews the timer for everyone; a skewed viewer sees a
shifted countdown. This plan moves the authoritative `startedAt` stamp to
the Convex mutation (server time), removing the moderator-clock component
entirely. **Honest limitation**: each viewer still compares against their
own clock, so viewer-vs-server skew (typically <1–2s on NTP-synced
devices) remains; that residual is accepted and out of scope.

## Current state

All excerpts verified at commit `8b771d7`.

### How the timer flows today

1. Mod interacts with `TimerProgressMod` in
   `components/poker/timer/timer-progress-popup.tsx`. Start handler
   (lines 294–310):

```tsx
const startTimer = useCallback(() => {
  cancelPendingUpdate();
  const baseElapsed = pausedAt ?? 0;
  const startAt = Date.now() - baseElapsed * 1000;
  onTimerStateUpdate({
    startedAt: startAt,
    pausedAt: null,
    totalSeconds: resolvedDraftTotal,
    soundOn,
  });
}, [...]);
```

   Pause (lines 312–319) sends `{ startedAt: null, pausedAt: clampedElapsed,
   totalSeconds, soundOn }`. Completion effect (lines 219–245) fires on the
   mod's clock when `remaining` hits 0 and writes
   `{ startedAt: null, pausedAt: 0, ... }`.

2. `components/poker/timer/timer.tsx` wraps the popup; its
   `onTimerStateUpdate` merges `timerVisible` and forwards to
   `onTimerUpdate` (fire-and-forget). It ALSO contains a legacy-migration
   effect that computes `const legacyStartedAt = Date.now() - currentSeconds * 1000`
   for old games (search for `legacyMigrationRef`).

3. `components/poker/use-poker-controller.ts:473–506` (`onTimerUpdate`)
   applies the update optimistically to local state, then calls the
   `updateTimer` mutation with the same payload.

4. `convex/games.ts` `updateTimer` mutation (lines 666–695 at `8b771d7`)
   validates via `assertTimerInput` and stores the payload as-is:

```ts
const timerProps = assertTimerInput(args.timerProps);
const now = Date.now();
await ctx.db.patch(game._id, { timerProps, updatedAt: now });
```

5. `convex/validation.ts` — `TIMER_FIELDS` whitelist (lines 23–31):
   `startedAt, pausedAt, totalSeconds, soundOn, timerVisible,
   currentSeconds, timerPaused`. `assertTimerInput` (lines 162–180)
   rejects unknown keys and non-finite numbers (bound: `LIMITS.timerNumber
   = 1e15`).

6. Viewers compute elapsed in both popup components:
   `Math.floor((now - startedAtValue) / 1000)` where `now` comes from a
   shared 1-second `nowStore` (`Date.now()` based).

### Design (decided at planning time)

Client keeps sending its provisionally computed `startedAt` (so the
optimistic UI stays instant), and ADDS an explicit
`elapsedSeconds` command field when starting/resuming. The mutation, when
it sees `elapsedSeconds`, **recomputes `startedAt = Date.now() -
elapsedSeconds * 1000` with server time, stores that, and strips
`elapsedSeconds`** from the persisted object. Pause/stop payloads
(`startedAt: null`) pass through untouched. Stored shape is unchanged, so
viewer rendering code needs no changes.

## Commands you will need

| Purpose   | Command       | Expected on success                       |
|-----------|---------------|-------------------------------------------|
| Tests     | `pnpm test`   | all pass (incl. plan 002/003 suites)      |
| Lint+types| `pnpm lints`  | exit 0                                    |
| Build     | `pnpm build`  | exit 0                                    |

## Scope

**In scope** (the only files you should modify):
- `convex/validation.ts` (whitelist + strip logic)
- `convex/games.ts` (`updateTimer` handler only)
- `convex/games.test.ts` (new tests; exists once plan 002 landed)
- `components/poker/timer/timer-progress-popup.tsx` (`startTimer` only)
- `components/poker/timer/timer.tsx` (legacy-migration effect only)
- `tests/validation.test.ts` (extend for the new field)

**Out of scope** (do NOT touch):
- `components/poker/use-poker-controller.ts` — the optimistic merge
  forwards whatever object it gets; no change needed (plan 004 territory).
- The completion effect's mod-clock trigger (lines 219–245) — with a
  server-stamped `startedAt`, the mod's completion check is at worst off
  by the mod's own NTP skew; accepted.
- `convex/schema.ts` — `timerProps` is `v.any()`; no schema change.
- Viewer-side clock-offset estimation — explicitly deferred.

## Git workflow

- Branch: `advisor/008-timer-server-clock`
- Commit message style: `fix: stamp timer start on the server to remove moderator clock skew`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Accept and validate `elapsedSeconds` in validation.ts

1. Add `'elapsedSeconds'` to `TIMER_FIELDS`.
2. In `assertTimerInput`, after the existing per-key validation, add:
   if `out.elapsedSeconds` is present it must be a number ≥ 0 and ≤
   `LIMITS.timerNumber` (the generic check already enforces
   finite+bounded; add the non-negative check) — else
   `throw new ConvexError('INVALID_INPUT')`.

Note: `pickTimerFields` (the lenient re-derive helper) also iterates
`TIMER_FIELDS`; that is harmless because step 2 strips `elapsedSeconds`
before anything is persisted, so stored objects never contain it.

**Verify**: `pnpm test` → existing validation tests still pass.

### Step 2: Server-stamp in the updateTimer mutation

In `convex/games.ts` `updateTimer`, between validation and the patch:

```ts
const timerProps = assertTimerInput(args.timerProps);
const now = Date.now();

if (timerProps && typeof timerProps.elapsedSeconds === 'number') {
  timerProps.startedAt = now - timerProps.elapsedSeconds * 1000;
  timerProps.pausedAt = null;
  delete timerProps.elapsedSeconds;
}

await ctx.db.patch(game._id, { timerProps, updatedAt: now });
```

Match the file's style (it already uses `const now = Date.now()`).

**Verify**: `pnpm lints` → exit 0.

### Step 3: Send `elapsedSeconds` from the two client start paths

1. `timer-progress-popup.tsx` `startTimer`: keep the provisional
   `startedAt` (optimistic UI) and add the command field:

```tsx
const startTimer = useCallback(() => {
  cancelPendingUpdate();
  const baseElapsed = pausedAt ?? 0;
  onTimerStateUpdate({
    startedAt: Date.now() - baseElapsed * 1000, // provisional; server re-stamps
    elapsedSeconds: baseElapsed,
    pausedAt: null,
    totalSeconds: resolvedDraftTotal,
    soundOn,
  });
}, [...]);
```

2. `timer.tsx` legacy-migration effect: in the `timerPaused === false`
   branch, add `elapsedSeconds: currentSeconds` alongside the existing
   `legacyStartedAt`.
3. Update the `TimerProps`/`GameTimerProps` type that these payloads flow
   through (`types/game.ts` — find the timer type and add
   `elapsedSeconds?: number`). If the type lives elsewhere, follow the
   import in `timer.tsx`.

**Verify**: `pnpm lints && pnpm build` → exit 0.

### Step 4: Tests

1. In `tests/validation.test.ts` (pattern: existing cases in that file):
   `assertTimerInput` accepts `{ elapsedSeconds: 5, startedAt: 123,
   pausedAt: null, totalSeconds: 300 }`; rejects `elapsedSeconds: -1`;
   rejects `elapsedSeconds: 'x'`.
2. In `convex/games.test.ts` (harness from plan 002 — `setupGame`,
   admin hash constant): a `describe('updateTimer server stamping')` block:
   - start payload with `elapsedSeconds: 10` and a deliberately skewed
     `startedAt` (e.g. `Date.now() + 9_999_999`): after the mutation,
     read the game via `t.run` (or `getViewerGameState`) and assert stored
     `timerProps.startedAt` is within ~2000ms of `Date.now() - 10_000`,
     `pausedAt === null`, and `elapsedSeconds` is absent from the stored
     object.
   - pause payload (`{ startedAt: null, pausedAt: 42, totalSeconds: 300 }`)
     passes through unchanged.
   - unauthorized caller still rejected (reuse plan 002's pattern) —
     confirms the auth path wasn't disturbed.

**Verify**: `pnpm test` → all pass, including ≥5 new tests.

### Step 5: Manual check (needs a Convex dev deployment; skip+note if absent)

Two browsers on the same game (mod + player). Mod starts a 1-minute timer;
both countdowns agree within ~1s. Pause → both freeze at the same value.
Resume → both continue. To simulate skew without changing the OS clock is
not practical — rely on the unit test's skewed-`startedAt` case for that.

**Verify**: `pnpm lints && pnpm test && pnpm build` → all exit 0.

## Test plan

Covered in step 4: validation cases in `tests/validation.test.ts`,
behavioral cases in `convex/games.test.ts` (server re-stamp, passthrough,
auth unchanged, stored object never contains `elapsedSeconds`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lints`, `pnpm test`, `pnpm build` all exit 0
- [ ] `grep -n "elapsedSeconds" convex/validation.ts convex/games.ts components/poker/timer/timer-progress-popup.tsx components/poker/timer/timer.tsx` → present in all four
- [ ] New tests from step 4 exist and pass
- [ ] Stored timer objects never contain `elapsedSeconds` (asserted by test)
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 002's `convex/games.test.ts` harness does not exist or fails on
  your starting commit (dependency not met).
- `assertTimerInput`'s shape has changed since `8b771d7` beyond plan 003's
  expected edits (drift in the exact function this plan modifies).
- The optimistic flicker turns out user-visible anyway (e.g. the
  controller strips unknown fields before merging, discarding the
  provisional `startedAt`) — report what the controller actually does
  rather than modifying it (it's out of scope).
- You find a second place that computes `Date.now() - ... * 1000` to
  produce a `startedAt` besides the two listed (grep first:
  `grep -rn "Date.now() -" components/poker/`) — the plan missed a write
  path; report it.

## Maintenance notes

- Any future timer feature (e.g. add-30-seconds) must send
  `elapsedSeconds` rather than computing `startedAt` client-side —
  reviewers should reject new client-computed absolute timestamps.
- If viewer-side skew ever matters (complaints of ±2s), the next step is
  a server-time offset estimate (Convex action returning server now, or
  deriving offset from `game.updatedAt` at snapshot arrival) applied in
  `nowStore` — designed but deferred.
- The legacy `currentSeconds`/`timerPaused` migration path can be deleted
  once no pre-migration games remain; it predates this plan.
