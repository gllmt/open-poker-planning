# Plan 003: Stop sending other players' votes to clients before reveal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- convex/games.ts convex/games.test.ts components/poker/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (A new `convex/games.test.ts` from
> plan 002 is expected, not drift.)

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED (touches the realtime payload every client consumes)
- **Depends on**: plans/002-convex-authz-tests.md (the characterization
  suite must exist and pass before this change)
- **Category**: security
- **Planned at**: commit `8b771d7`, 2026-06-11

## Why this matters

This is a planning poker app: the entire point is that votes are hidden
until reveal. But the Convex query every client subscribes to,
`getViewerGameState`, returns **every player's `value` and `emoji` at all
times**, regardless of game status. The UI hides the cards, but the data is
in the WebSocket frames — any player can open DevTools (or React DevTools)
and read everyone's vote before reveal. This silently defeats the product's
core mechanic. The fix is server-side masking: other players' vote values
must not leave the backend until `gameStatus === 'finished'`.

## Current state

- `convex/games.ts:83–91` — `sanitizePlayer` always includes the vote:

```ts
function sanitizePlayer(player: PlayerDoc): Player {
  return {
    id: player.playerId,
    name: player.name,
    status: player.status as Status,
    value: player.value ?? undefined,
    emoji: player.emoji ?? undefined,
  };
}
```

- `convex/games.ts:315–322` — `getViewerState` sends it to every subscriber
  (this is the only call site of `sanitizePlayer` — verify with
  `grep -n "sanitizePlayer" convex/games.ts`):

```ts
  const players = await getActivePlayersByGameId(ctx, gameId);

  return {
    type: 'ready',
    currentPlayerId: viewer.playerId,
    game: sanitizeGame(game),
    players: players.map(sanitizePlayer),
  };
```

- Game status values: `types/status.ts` — `Status.NotStarted`,
  `Status.InProgress`, `Status.Started`, `Status.Finished` (check exact
  string values in that file). Votes become public only at
  `Status.Finished`.
- `status` per player (`'finished'` = has voted) **must stay visible** at
  all times — the UI renders face-down cards for players who voted
  (`components/poker/player-card.tsx`).
- The viewer's OWN `value`/`emoji` must stay visible — the client overlays
  pending votes and checks sync against it
  (`components/poker/use-poker-controller.ts:266–288`, the `pendingVote`
  sync check compares `me.value === pendingVote.value`).
- Client snapshot dedup uses a signature including each player's
  `value`/`emoji` (`components/poker/use-poker-controller.ts:75–98`).
  Masked values are stable (`undefined`), so signatures stay stable until
  reveal flips the status — no client change needed.
- Post-reveal consumers (`components/poker/hooks/use-game-average.ts`,
  `components/poker/results/results-section.tsx`,
  `isTieResult` in `components/poker/hooks/use-confetti.ts`) all run when
  `gameStatus === Finished`, where values are unmasked.
- Auto-reveal path: the `vote` mutation itself flips `gameStatus` to
  finished when the last player votes (`convex/games.ts:566–588`), so the
  next pushed snapshot is already in the unmasked state. No special case
  needed.

## Commands you will need

| Purpose   | Command       | Expected on success                          |
|-----------|---------------|----------------------------------------------|
| Tests     | `pnpm test`   | all pass (incl. plan 002 suite + new tests)  |
| Lint+types| `pnpm lints`  | exit 0                                       |
| Build     | `pnpm build`  | exit 0                                       |

## Scope

**In scope** (the only files you should modify):
- `convex/games.ts` (the masking logic)
- `convex/games.test.ts` (new tests; file created by plan 002)

**Out of scope** (do NOT touch):
- Any client file under `components/` or `app/` — the client already
  renders pre-reveal players from `status` alone; if you find a client spot
  that breaks under masking, that's a STOP condition, not a license to edit.
- `convex/schema.ts` — no schema change is needed.
- `types/player.ts` — `value` and `emoji` are already optional on `Player`.

## Git workflow

- Branch: `advisor/003-mask-prereveal-votes`
- Commit message style: `fix: mask other players' votes until reveal`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add masking in `getViewerState`

In `convex/games.ts`, change the `'ready'` branch of `getViewerState`
(lines 315–322) so that while the game is not finished, every player other
than the viewer is serialized without `value`/`emoji`. Suggested shape —
keep `sanitizePlayer` as-is and mask at the call site:

```ts
  const players = await getActivePlayersByGameId(ctx, gameId);
  const revealed = game.gameStatus === STATUS.Finished;

  return {
    type: 'ready',
    currentPlayerId: viewer.playerId,
    game: sanitizeGame(game),
    players: players.map((player) => {
      const sanitized = sanitizePlayer(player);
      if (revealed || player.playerId === viewer.playerId) return sanitized;
      return { ...sanitized, value: undefined, emoji: undefined };
    }),
  };
```

Match the file's existing style (the `STATUS` constant is already in scope
at the top of the file).

**Verify**: `pnpm lints` → exit 0; `pnpm test` → the plan 002 suite still
passes EXCEPT any test that asserted other players' values are visible
pre-reveal — if such a test exists, updating it is part of step 2.

### Step 2: Add masking tests in `convex/games.test.ts`

Using the harness from plan 002 (`setupGame`, `HASH_*` constants), add a
`describe('vote masking', ...)` block:

1. **Pre-reveal, others masked**: creator + Bob join; Bob votes `2`; fetch
   `getViewerGameState` as the creator (`HASH_C`) → Bob's entry has
   `status: finished` (per `types/status.ts` value) but `value` and `emoji`
   are `undefined`/absent.
2. **Pre-reveal, self visible**: same state, fetch as Bob (`HASH_D`) →
   Bob's own entry has `value: 2`.
3. **Post-reveal, all visible**: admin calls `reveal`; fetch as creator →
   Bob's `value: 2` present.
4. **Reset re-masks**: admin calls `reset`, Bob votes again, fetch as
   creator → Bob's value absent again.
5. **Auto-reveal end-state**: `setAutoReveal(true)`; both players vote →
   fetched state has `gameStatus` finished and both values visible.
6. **Serialized payload contains no foreign votes**: pre-reveal, as
   creator, `JSON.stringify(result)` does not contain Bob's vote value in
   Bob's player object (assert on the object, not the whole string — the
   deck cards legitimately contain numbers).

**Verify**: `pnpm test` → all pass, including 6 new tests.

### Step 3: Full gate

**Verify**: `pnpm lints && pnpm test && pnpm build` → all exit 0.

## Test plan

Covered in step 2 — six new server-side tests in `convex/games.test.ts`,
modeled on the plan 002 suite. No client tests (no client change).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm test` exits 0, with ≥6 new masking tests
- [ ] `pnpm lints` and `pnpm build` exit 0
- [ ] `git diff --stat` touches ONLY `convex/games.ts` and `convex/games.test.ts`
- [ ] In `convex/games.ts`, `getViewerState` returns masked `value`/`emoji`
      for non-viewer players whenever `gameStatus !== Finished` (visible in
      the diff)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 002's suite does not exist or does not pass on your starting commit
  (dependency not met).
- Any component under `components/poker/` turns out to read another
  player's `value` pre-reveal for rendering (e.g. a card flip animation
  driven by the value) — masking would visibly break the UI and the client
  needs a coordinated change the operator should scope.
- The `Status` enum values in `types/status.ts` don't match the
  `game.gameStatus` strings stored in the DB (would make the `revealed`
  check silently wrong).

## Maintenance notes

- Any future query that returns player rows (e.g. a spectator mode or round
  history) must apply the same masking rule; reviewers should grep for new
  `sanitizePlayer`/player serialization call sites.
- If plan 004 (credential exposure) lands first, there is no conflict —
  different regions of different files.
- Deferred intentionally: masking the *number* of changed votes during a
  round (timing side channels) — not worth the complexity for this product.
