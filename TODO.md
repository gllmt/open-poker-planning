# TODO

## Frontend (Optimistic UI)
- [ ] Add visible error feedback for `autoReveal` failures.
  - Implementation: display a small inline error below the toggle or show a toast when the Convex mutation fails and rollback occurs.
  - File: `components/poker/game-controller/index.tsx`.
- [ ] Add controller regression tests before migrating to Convex optimistic updates.
  - Cover rapid A → B voting, exact rollback after a rejected vote, and a server push during an optimistic reveal.
  - Simulate failures for `onReveal`, `onReset`, and `onTimerUpdate`, then assert that each action restores the exact previous state.
  - Migrate one mutation at a time (`vote`, `reveal`, then `reset`) and remove the reducer only after the last migration.
  - Preserve rapid-vote coalescing with a minimal local draft instead of stacking the current overlay with a Convex optimistic update.
  - File: test setup needed for `components/poker/use-poker-controller.ts` (framework choice required).
