# TODO

## Backend (Convex)
- [ ] Add focused tests for token authorization in Convex mutations.
  - Implementation: cover invalid invite tokens, removed members, and non-moderator management attempts.
  - Files: test setup needed for `convex/games.ts`.

## Frontend (Optimistic UI)
- [ ] Add visible error feedback for `autoReveal` failures.
  - Implementation: display a small inline error below the toggle or show a toast when the Convex mutation fails and rollback occurs.
  - File: `components/poker/game-controller/index.tsx`.
- [ ] (Optional) Extract `useOptimisticToggle` hook for `autoReveal`.
  - Implementation: move `autoRevealValue`, `autoRevealPending`, `autoRevealPendingSync` logic into a reusable hook; return `{ value, pending, toggle }`.
  - Files: new hook in `components/poker/hooks/use-optimistic-toggle.ts`, usage in `components/poker/game-controller/index.tsx`.

## Quality / Tests
- [ ] Add unit tests for optimistic rollback.
  - Implementation: simulate API failure for `onReveal`, `onReset`, `onTimerUpdate` and assert UI state returns to previous values.
  - Files: test setup needed for `components/poker/poker.tsx` (framework choice required).

## Accessibility
- [ ] Add `aria-label` to the Auto Reveal switch.
  - Implementation: pass a localized label to the button for screen readers.
  - File: `components/poker/game-controller/auto-reveal-toggle.tsx`.
