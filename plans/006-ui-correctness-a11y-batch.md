# Plan 006: Fix user-facing copy, error-boundary i18n, average sentinel, and icon-button a11y

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- lib/i18n/dictionaries/ components/poker/ "app/[lang]/game/[id]/page.tsx" TODO.md tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plans 002–005; avoid running
  concurrently with plan 004 only because both touch `components/poker/`)
- **Category**: bug
- **Planned at**: commit `8b771d7`, 2026-06-12

## Why this matters

Four small, verified user-facing defects, all in the same area of the
codebase — batched so one executor pass fixes them together:

1. After votes are revealed, English users see "Session not ready for
   voting! Wait for moderator to start" — the message is factually wrong
   for that game state (French already says "Session terminée !").
2. The game error boundary renders hardcoded English and leaks raw
   `error.message` strings (internal error codes) to end users.
3. When no numeric votes exist, the results header shows an "Avg: -" badge
   instead of hiding it, due to a `0`-truthiness footgun.
4. Icon-only buttons in the timer have no reliable accessible name
   (`title` only, or nothing), failing WCAG 4.1.2 for screen-reader users.

## Current state

All excerpts verified at commit `8b771d7`.

**Repo conventions**: client components translate via
`const { t } = useI18n()` (see `components/poker/card-picker.tsx` for the
pattern). Server components load `getDictionary(locale)` from
`lib/i18n/dictionaries.ts` (see `app/[lang]/page.tsx` for the pattern;
`getDictionary` is `server-only` and cached). Dictionaries are flat JSON at
`lib/i18n/dictionaries/{en,fr}.json` — both files must always change
together.

### Defect 1 — wrong EN string at reveal

- `lib/i18n/dictionaries/en.json:75`:
  `"notReady": "Session not ready for voting! Wait for moderator to start"`
- `lib/i18n/dictionaries/fr.json:75`: `"notReady": "Session terminée !"`
- `components/poker/card-picker.tsx:52` — shown only when finished:

```tsx
{!isFinished ? t('cardPicker.cta') : t('cardPicker.notReady')}
```

(`isFinished = game.gameStatus === Status.Finished`, line 44.)

### Defect 2 — error boundary copy

`components/poker/poker-error-boundary.tsx` (class component, no i18n
access; full fallback block at lines 37–56):

```tsx
return (
  <div className="p-6 text-center">
    <p className="text-sm text-destructive">
      {isRedirectError
        ? 'Unable to continue with the current session.'
        : this.state.error?.message ||
          'An error occurred loading the game.'}
    </p>
    <button ... >
      Retry
    </button>
  </div>
);
```

It is rendered from the server page `app/[lang]/game/[id]/page.tsx:57`:

```tsx
<PokerErrorBoundary>
  <Poker ... />
</PokerErrorBoundary>
```

That page currently does NOT import `getDictionary` — it will need to.

### Defect 3 — average sentinel

`components/poker/hooks/use-game-average.ts:39` — returns `0` when no
player cast a countable vote (`if (!count) return 0;`); it already returns
`null` for T-shirt decks (line 13) — `null` means "no average to show".

Consumer `components/poker/game-controller/index.tsx:75–80`:

```tsx
const averageValue = useGameAverage(game, players);
const canShowAverage = averageValue !== null;
const averageLabel =
  game.gameStatus === Status.Finished && averageValue
    ? averageValue.toFixed(2)
    : '-';
```

Actual symptom: with `averageValue === 0` (all-coffee votes — or a
legitimate all-zeros vote), `canShowAverage` is `true` but the truthiness
check makes the label `'-'`, so users see a meaningless "Avg: -" badge. A
genuine average of exactly `0` is also displayed as `'-'`.

### Defect 4 — icon-button accessible names

`components/poker/timer/timer-progress-popup.tsx`, moderator view:

- Sound toggle (~line 412): `<Button title={...} size="icon-xs" ...>` with
  an `aria-hidden` icon child — accessible name comes from `title` only
  (weak fallback).
- Close button (~line 487): same pattern with `title={t('timer.closeTitle')}`.
- `TimerControlButton` instances (play/pause, around the same region) —
  check that component's definition in the same file; if it renders a
  button with only an `aria-hidden` icon and no `title`/`aria-label`, it
  has NO accessible name at all (the worst case).
- Results table headers `components/poker/results/results-section.tsx:49–54`:
  two `<th>` without `scope="col"`.

NOT a defect (verified, do not "fix"): the auto-reveal switch
(`components/poker/game-controller/auto-reveal-toggle.tsx:17–29`) uses
`<Label htmlFor="auto-reveal">` and the `id` is forwarded to Base UI's
`Switch.Root`, which renders a native `<button role="switch">` — native
label association already provides its accessible name. The stale entry in
`TODO.md:21–24` asking for an aria-label should be removed as part of this
plan (step 5).

## Commands you will need

| Purpose   | Command       | Expected on success                       |
|-----------|---------------|-------------------------------------------|
| Tests     | `pnpm test`   | all pass                                  |
| Lint+types| `pnpm lints`  | exit 0                                    |
| Build     | `pnpm build`  | exit 0                                    |

## Scope

**In scope** (the only files you should modify/create):
- `lib/i18n/dictionaries/en.json`, `lib/i18n/dictionaries/fr.json`
- `components/poker/poker-error-boundary.tsx`
- `app/[lang]/game/[id]/page.tsx` (pass translated strings only)
- `components/poker/hooks/use-game-average.ts`
- `components/poker/game-controller/index.tsx` (the `averageLabel` lines only)
- `components/poker/timer/timer-progress-popup.tsx` (aria-labels only)
- `components/poker/results/results-section.tsx` (`scope="col"` only)
- `TODO.md` (remove the satisfied aria-label entry)
- `tests/i18n-dictionaries.test.ts` (create)

**Out of scope** (do NOT touch):
- `components/poker/use-poker-controller.ts` (plan 004 territory)
- `convex/**` (plans 002/003/008 territory)
- The timer's time-keeping logic (plan 008 territory) — this plan only
  adds aria attributes there.
- `components/ui/sileo-toaster.tsx` — its theme inversion is deliberate
  (high-contrast toasts); do not "correct" it.

## Git workflow

- Branch: `advisor/006-ui-correctness-a11y-batch`
- Commit message style: `fix: correct reveal copy, error fallback i18n, average sentinel, icon a11y`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the EN reveal string

In `en.json`, change `cardPicker.notReady` to text that is correct for the
finished state, e.g. `"Voting is closed — votes are revealed"`. Leave the
FR value as-is (already correct). Do not rename the key (it's referenced
in `card-picker.tsx`).

**Verify**: `grep -n "notReady" lib/i18n/dictionaries/*.json` → EN value no
longer mentions waiting/starting; `pnpm lints` → exit 0.

### Step 2: Localize the error boundary and stop leaking error messages

1. In `poker-error-boundary.tsx`, add optional string props with the
   current English values as defaults:

```tsx
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sessionErrorMessage?: string; // default 'Unable to continue with the current session.'
  genericErrorMessage?: string; // default 'An error occurred loading the game.'
  retryLabel?: string;          // default 'Retry'
}
```

2. In `render()`, use them — and remove the raw message leak: replace
   `this.state.error?.message || '...'` with `genericErrorMessage` only
   (the error is still logged via the existing `componentDidCatch`).
3. In `app/[lang]/game/[id]/page.tsx`, load the dictionary and pass the
   strings. Add new dictionary keys (both EN and FR), e.g. under a
   `"errorBoundary"` object: `sessionError`, `genericError`, `retry`.
   Follow the existing server-side pattern — `app/[lang]/page.tsx` shows
   how `getDictionary` is imported and awaited. Access keys per that
   page's convention (check whether it indexes the dictionary object
   directly, e.g. `dict.errorBoundary.retry`, or uses a helper — match it).

**Verify**: `pnpm lints && pnpm build` → exit 0;
`grep -n "error?.message" components/poker/poker-error-boundary.tsx` → no
match in the rendered JSX (only in `componentDidCatch` logging, if at all).

### Step 3: Fix the average sentinel

1. `use-game-average.ts:39`: change `if (!count) return 0;` to
   `if (!count) return null;`.
2. `game-controller/index.tsx:77–80`: remove the truthiness footgun:

```tsx
const averageLabel =
  game.gameStatus === Status.Finished && averageValue !== null
    ? averageValue.toFixed(2)
    : '-';
```

With `null` now meaning "nothing to average", `canShowAverage` hides the
badge entirely in the all-sentinel case, and a genuine `0` average
displays as `0.00`.

**Verify**: `pnpm lints` → exit 0.

### Step 4: Accessible names for icon-only timer buttons + table scope

1. In `timer-progress-popup.tsx`, for every interactive icon-only button:
   add `aria-label` reusing the exact localized string already passed to
   `title` (e.g. sound toggle:
   `aria-label={soundOn ? t('timer.disableSound') : t('timer.enableSound')}`;
   close: `aria-label={t('timer.closeTitle')}`). Locate the
   `TimerControlButton` component definition in the same file: if its
   rendered button lacks any accessible name, thread an `ariaLabel` (or
   `title`) prop through it and supply localized labels at the call sites
   (reuse existing `timer.*` dictionary keys where one fits; add new keys
   to BOTH dictionaries if none fits).
2. In `results-section.tsx`, add `scope="col"` to both `<th>` elements.

**Verify**: `pnpm lints` → exit 0;
`grep -c "aria-label" components/poker/timer/timer-progress-popup.tsx` → ≥ 3.

### Step 5: Remove the satisfied TODO entry and add a dictionary parity test

1. In `TODO.md`, delete the "Add `aria-label` to the Auto Reveal switch"
   section (lines 21–24 at plan time) — verified already satisfied via the
   native label association.
2. Create `tests/i18n-dictionaries.test.ts` (model on
   `tests/validation.test.ts` — plain vitest, node env). Import both JSON
   files directly (`import en from '@/lib/i18n/dictionaries/en.json'`),
   flatten nested keys to dot-paths, and assert:
   - both files have exactly the same key set (report the diff on failure),
   - no value is an empty string,
   - every `{placeholder}` token appearing in an EN value appears in the
     FR value for the same key, and vice versa.

This pins the defect class behind Defect 1 (the two files drifting).

**Verify**: `pnpm test` → all pass including the new file (3+ new tests).

### Step 6: Full gate

**Verify**: `pnpm lints && pnpm test && pnpm build` → all exit 0.

## Test plan

- New: `tests/i18n-dictionaries.test.ts` (step 5) — parity, no-empty,
  placeholder consistency.
- The other fixes are markup/copy-level; they are covered by the grep-based
  done criteria and the type-checked build (no component test harness
  exists in this repo — do not add jsdom for this).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lints`, `pnpm test`, `pnpm build` all exit 0
- [ ] EN `cardPicker.notReady` no longer says "Wait for moderator to start"
- [ ] `tests/i18n-dictionaries.test.ts` exists and passes
- [ ] `poker-error-boundary.tsx` renders no `error?.message` and no
      hardcoded user-facing English (defaults in prop declarations are
      acceptable)
- [ ] `use-game-average.ts` contains `return null` for the zero-count case
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The dictionary JSON files have structurally diverged from flat
  nested-object shape (e.g. arrays or ICU plural objects) making the
  parity test design wrong.
- `app/[lang]/game/[id]/page.tsx` cannot use `getDictionary` (import error
  from `server-only`) — that would mean the page isn't a server component
  anymore, which contradicts this plan's premise.
- The auto-reveal switch turns out NOT to forward `id` to the underlying
  button (check rendered DOM or `components/ui/switch.tsx`) — then the
  TODO entry is real and removing it (step 5.1) is wrong; report instead.
- Fixing `averageLabel` requires touching files beyond the two listed
  (e.g. the label is computed elsewhere too).

## Maintenance notes

- The parity test makes adding a dictionary key in one language fail
  `pnpm test` until the other language is updated — that's the point; tell
  translators to update both files in one commit.
- Plan 008 will edit other parts of `timer-progress-popup.tsx`; if both
  run, sequence them (this one first — it's smaller).
- Deferred deliberately: localizing `not-found.tsx` and the access page's
  edge strings; converting the error boundary to a functional wrapper.
