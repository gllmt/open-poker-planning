# TODO

## Backend (Route Handlers)
- [ ] Add lightweight logging in `after()` callbacks to avoid silent failures.
  - Implementation: replace `.catch(() => {})` with `.catch((error) => console.error('Broadcast failed:', error))` in the 5 route handlers.
  - Files: `app/api/games/[gameId]/auto-reveal/route.ts`, `app/api/games/[gameId]/reset/route.ts`, `app/api/games/[gameId]/reveal/route.ts`, `app/api/games/[gameId]/story/route.ts`, `app/api/games/[gameId]/timer/route.ts`.
- [ ] (Optional) Evaluate `waitUntil()` for critical broadcasts.
  - Implementation: use `event.waitUntil(broadcastPromise)` only if broadcasts must be guaranteed; otherwise keep `after()` for lowest latency.

## Frontend (Optimistic UI)
- [ ] Add visible error feedback for `autoReveal` failures.
  - Implementation: display a small inline error below the toggle or show a toast when the API call fails and rollback occurs.
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
