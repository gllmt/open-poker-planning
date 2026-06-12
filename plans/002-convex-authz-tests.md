# Plan 002: Add characterization tests for token authorization in Convex functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- convex/ vitest.config.ts package.json tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive — production code must NOT change)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `8b771d7`, 2026-06-11

## Why this matters

`convex/games.ts` (~800 lines) contains every game mutation and all of the
app's authorization logic — token-hash comparison, moderator privileges,
invite validation with a legacy fallback, owner-only deletion. It has **zero
test coverage**, and it is the highest-churn backend file in the repo. The
repo's own `TODO.md` lists this as the top gap. Plans 003 and 004 modify
adjacent security code; these characterization tests must exist first so
those changes can't silently break an auth guard.

**This plan is characterization only: it pins down CURRENT behavior. If a
test you write fails, your test is wrong (or you found drift) — do not
"fix" `convex/games.ts`.** If you believe you found a genuine bug, record it
in your report and move on with a test matching actual behavior.

## Current state

- `convex/games.ts` — all queries/mutations. Public API surface:
  `getViewerGameState` (query), `createGame`, `createInvite`, `joinGame`,
  `leaveGame`, `vote`, `reveal`, `reset`, `updateTimer`, `setAutoReveal`,
  `removePlayer`, `deleteGame` (mutations).
- `convex/schema.ts` — three tables: `games` (with `joinTokenHash`,
  `adminTokenHash`), `players` (with `playerTokenHash`, `membershipStatus`),
  `gameInvites` (with `tokenHash`, `revokedAt`, `revokedReason`).
- `convex/validation.ts` — pure helpers, already tested in
  `tests/validation.test.ts`.
- `vitest.config.ts` — `environment: 'node'`, include `'**/*.test.ts'`,
  alias `@` → repo root.
- Existing test style exemplar: `tests/validation.test.ts` (plain
  `describe`/`it`/`expect` from vitest, no mocking framework).
- All errors are thrown as `new ConvexError('<CODE>')` with string codes:
  `INVALID_INPUT`, `NOT_FOUND`, `UNAUTHORIZED`, `INVALID_INVITE`,
  `GAME_FINISHED`, `TOO_MANY_INVITES`.

Key authorization behaviors to pin down (verified against `8b771d7`):

1. **`assertCanManage`** (`convex/games.ts:222–249`) — gates `reveal`,
   `reset`, `updateTimer`, `setAutoReveal`, `removePlayer`. Admin token hash
   always authorizes. Otherwise requires `game.isAllowMembersToManageSession
   === true` AND an *active* caller player whose stored `playerTokenHash`
   equals the presented one.

2. **`removePlayer`** (`convex/games.ts:726–775`) — additionally, only the
   admin may remove the game creator (`games.ts:756–762`); a managing member
   cannot evict the owner. Removing a player also revokes all active invites
   with reason `player_removed` (`games.ts:772`).

3. **`deleteGame`** (`convex/games.ts:777–804`) — admin-token-only,
   regardless of `isAllowMembersToManageSession`.

4. **`hasValidInviteToken`** (`convex/games.ts:149–170`) — used by
   `joinGame`. Matching `gameInvites` row → valid iff `revokedAt === null`.
   No matching row but *some* invite rows exist → invalid. Zero invite rows
   (legacy game) → falls back to comparing against `game.joinTokenHash`.

5. **`vote`** (`convex/games.ts:522–590`) — requires active player + token
   hash match; rejects when `gameStatus === 'finished'` (`GAME_FINISHED`),
   rejects values not in the deck (`INVALID_INPUT`); with `autoReveal: true`,
   the last voter flips `gameStatus` to finished.

6. **`leaveGame`** (`convex/games.ts:487–520`) — requires active player +
   token hash match; sets `membershipStatus: 'left'` and zeroes the vote.

7. **`getViewerGameState`** (`convex/games.ts:325–333`) — returns
   `{type:'not_found'}` for unknown game; `{type:'revoked', reason:
   'missing-session'|'left'|'removed'}` per viewer membership; `'ready'`
   with sanitized game+players otherwise. Sanitized output must NOT contain
   `joinTokenHash`, `adminTokenHash`, or `playerTokenHash`.

8. **`createInvite`** (`convex/games.ts:405–441`) — authorized by admin hash
   OR any active player with matching token hash (no
   `isAllowMembersToManageSession` requirement). Enforces
   `LIMITS.invitesPerGame` (100) active invites via `reserveInviteSlot`
   (`TOO_MANY_INVITES`).

Token hashes are 64-char lowercase hex strings (`assertTokenHash`,
`convex/validation.ts:67–72`). In tests, fabricate them, e.g.
`'a'.repeat(64)`, `'b'.repeat(64)` — never reuse the same fake hash for two
different credentials in one test.

## Commands you will need

| Purpose   | Command       | Expected on success                       |
|-----------|---------------|-------------------------------------------|
| Install   | `pnpm install`| exit 0                                    |
| Tests     | `pnpm test`   | all pass (24 existing + your new ones)    |
| Lint+types| `pnpm lints`  | exit 0                                    |
| Build     | `pnpm build`  | exit 0                                    |

## Suggested executor toolkit

- Library: [`convex-test`](https://docs.convex.dev/testing/convex-test) —
  official in-memory mock of the Convex backend for vitest. Read its setup
  docs before starting; the API surface is
  `convexTest(schema, modules)` → `t.query(api.games.X, args)` /
  `t.mutation(api.games.X, args)` / `t.run(ctx => ...)` for direct db access.

## Scope

**In scope** (the only files you should modify/create):
- `package.json` (devDependencies: add `convex-test` and, if required by its
  docs for the edge-runtime environment, `@edge-runtime/vm`)
- `pnpm-lock.yaml` (via `pnpm add -D`)
- `vitest.config.ts` (only if convex-test setup requires it, e.g.
  `server.deps.inline: ['convex-test']`)
- `convex/games.test.ts` (create — co-located so `import.meta.glob` can load
  the convex modules with relative paths)

**Out of scope** (do NOT touch):
- `convex/games.ts`, `convex/schema.ts`, `convex/validation.ts` — this is
  characterization; production behavior must be byte-identical.
- `convex/_generated/**` — committed generated code.
- Existing tests in `tests/`.

## Git workflow

- Branch: `advisor/002-convex-authz-tests`
- Commit message style: imperative with prefix, e.g.
  `test: add characterization tests for convex token authorization`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install convex-test

`pnpm add -D convex-test` (add `@edge-runtime/vm` too if the convex-test
docs for your installed version require the `edge-runtime` vitest
environment).

**Verify**: `pnpm install` → exit 0; `node -e "console.log(require('convex-test/package.json').version)"`
→ prints a version.

### Step 2: Create the test harness and a first smoke test

Create `convex/games.test.ts`. Declare the environment per-file so the
existing node-environment tests are untouched:

```ts
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/!(*.*.*)*.*s');

const HASH_A = 'a'.repeat(64); // join token hash
const HASH_B = 'b'.repeat(64); // admin token hash
const HASH_C = 'c'.repeat(64); // creator player token hash
const HASH_D = 'd'.repeat(64); // second player token hash
const HASH_X = 'f'.repeat(64); // wrong/unknown hash

const CARDS = [
  { value: 1, displayValue: '1', color: '#fff' },
  { value: 2, displayValue: '2', color: '#fff' },
];

async function setupGame(opts?: { allowMembersToManage?: boolean }) {
  const t = convexTest(schema, modules);
  await t.mutation(api.games.createGame, {
    gameId: 'game-1',
    name: 'Test game',
    createdBy: 'Alice',
    createdById: 'player-alice',
    gameType: 'fibonacci',
    cards: CARDS,
    isAllowMembersToManageSession: opts?.allowMembersToManage ?? false,
    joinTokenHash: HASH_A,
    adminTokenHash: HASH_B,
    playerTokenHash: HASH_C,
  });
  return t;
}
```

Notes:
- `gameType` must be a member of the `GameType` enum in `types/game.ts` —
  check that file and use a valid value (`assertGameType` rejects others).
  If `'fibonacci'` is not in the enum, substitute one that is.
- If `// @vitest-environment edge-runtime` fails to resolve, fall back to
  the plain node environment first — convex-test may work there; only add
  config/deps that its error messages actually demand.

Smoke test: `getViewerGameState` with `HASH_C` returns `type: 'ready'`,
`currentPlayerId: 'player-alice'`; with `HASH_X` returns
`{type:'revoked', reason:'missing-session'}`.

**Verify**: `pnpm test` → existing 24 tests + your smoke tests pass.

### Step 3: Authorization matrix for manage-gated mutations

Add tests (use `reveal` as the representative mutation, plus one each for
`reset` and `setAutoReveal` to confirm the gate is shared):

| Case | Setup | Call | Expect |
|---|---|---|---|
| admin hash authorizes | default game | `reveal` with `adminTokenHash: HASH_B` | resolves; `getViewerGameState` shows `gameStatus: 'finished'` |
| wrong admin hash rejected | default game | `reveal` with `adminTokenHash: HASH_X` | rejects with ConvexError `UNAUTHORIZED` |
| member w/o flag rejected | `allowMembersToManage: false`, join 2nd player | `reveal` with `callerPlayerId` + `playerTokenHash: HASH_D` | rejects `UNAUTHORIZED` |
| member with flag authorized | `allowMembersToManage: true`, join 2nd player | same call | resolves |
| member with flag but wrong token | `allowMembersToManage: true` | `playerTokenHash: HASH_X` | rejects `UNAUTHORIZED` |
| removed member with flag rejected | flag on, join then `removePlayer` (as admin) the 2nd player | `reveal` as 2nd player | rejects `UNAUTHORIZED` |

To join the 2nd player: `t.mutation(api.games.joinGame, { gameId: 'game-1',
playerId: 'player-bob', playerName: 'Bob', playerTokenHash: HASH_D,
joinTokenHash: HASH_A })`.

To assert a ConvexError code, match on `error.data`:
`await expect(...).rejects.toMatchObject({ data: 'UNAUTHORIZED' })` — if
that shape doesn't match how `ConvexError` surfaces through convex-test,
inspect one rejection with `.catch(e => console.log(e))`, adapt once, and
use the same pattern everywhere.

**Verify**: `pnpm test` → all pass.

### Step 4: Owner protection and admin-only deletion

- `removePlayer` targeting the creator (`playerId: 'player-alice'`) as a
  managing member (flag on, valid `HASH_D`) → rejects `UNAUTHORIZED`.
- Same call with `adminTokenHash: HASH_B` → resolves; afterwards
  `getViewerGameState` with `HASH_C` returns
  `{type:'revoked', reason:'removed'}`.
- `removePlayer` on a non-creator also revokes invites: after removing Bob
  (as admin), `joinGame` with a third player using `joinTokenHash: HASH_A`
  → rejects `INVALID_INVITE` (the creation-time invite row was revoked).
- `deleteGame` with member credentials (flag on) → rejects `UNAUTHORIZED`;
  with `adminTokenHash: HASH_B` → resolves and `getViewerGameState` returns
  `{type:'not_found'}`.

**Verify**: `pnpm test` → all pass.

### Step 5: Invite validation in joinGame

- Valid invite: fresh game, `joinGame` with `joinTokenHash: HASH_A` →
  resolves (the `createGame` mutation inserts an invite row for the join
  token, `convex/games.ts:395–401`).
- Unknown invite token while invite rows exist → `INVALID_INVITE`.
- Revoked invite: revoke via admin `removePlayer` of a joined player (or
  patch the row directly with `t.run`) then `joinGame` → `INVALID_INVITE`.
- Legacy fallback: use `t.run(async (ctx) => { ... })` to delete ALL
  `gameInvites` rows for the game, then `joinGame` with `HASH_A` → resolves
  (falls back to `game.joinTokenHash`); with `HASH_X` → `INVALID_INVITE`.
- New invite token: `createInvite` as admin with `tokenHash: 'e'.repeat(64)`,
  then `joinGame` with that hash → resolves.

**Verify**: `pnpm test` → all pass.

### Step 6: vote and leaveGame guards

- `vote` with wrong `playerTokenHash` → `UNAUTHORIZED`.
- `vote` with value not in deck (e.g. `99`) → `INVALID_INPUT`.
- `vote` after `reveal` (game finished) → `GAME_FINISHED`.
- autoReveal: flag on via `setAutoReveal` (admin), two active players, both
  vote → `getViewerGameState` shows `gameStatus: 'finished'` after the
  second vote.
- `leaveGame` with wrong token → `UNAUTHORIZED`; with the right token →
  viewer state becomes `{type:'revoked', reason:'left'}`.

**Verify**: `pnpm test` → all pass.

### Step 7: No-secrets-in-output check

Assert the `'ready'` payload of `getViewerGameState` contains no hash
fields: `JSON.stringify(result)` must not contain `HASH_A`, `HASH_B`,
`HASH_C`, `HASH_D`, nor the substrings `TokenHash`.

**Verify**: `pnpm test && pnpm lints` → all pass, exit 0.

## Test plan

This plan IS the test plan. Final shape: `convex/games.test.ts` with ~20
cases organized in `describe` blocks per mutation, modeled structurally on
`tests/validation.test.ts` (plain describe/it/expect, no shared mutable
state between tests — build a fresh `convexTest` per test via `setupGame`).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm test` exits 0; total test count ≥ 42 (24 existing + ≥18 new)
- [ ] `pnpm lints` exits 0
- [ ] `pnpm build` exits 0
- [ ] `git diff --stat` touches ONLY: `convex/games.test.ts`,
      `package.json`, `pnpm-lock.yaml`, and (optionally) `vitest.config.ts`
- [ ] `git diff convex/games.ts convex/schema.ts convex/validation.ts` is empty
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `convex-test` is incompatible with vitest 4 (install or import errors that
  its docs don't resolve) — report the exact error; the fallback decision
  (downgrade vitest vs. different harness) belongs to the operator.
- Any characterization test reveals behavior contradicting the table in
  "Current state" (e.g. a member without the manage flag CAN reveal) — that
  is either drift or a real vulnerability; report it, do not fix it.
- You need to modify `convex/games.ts` to make anything testable.
- `import.meta.glob` of convex modules pulls in `_generated` files that
  crash the harness and you cannot exclude them via the glob pattern.

## Maintenance notes

- Plans 003 (vote masking) and 004 (credential exposure) change
  `convex/games.ts` and MUST keep this suite green; plan 003 additionally
  extends it.
- When a new mutation is added to `convex/games.ts`, the PR reviewer should
  require a corresponding authorization test here — that's the point of
  this suite.
- Deferred: tests for `updateTimer` payload validation (covered indirectly
  by `tests/validation.test.ts`) and for route handlers (`app/api/**`) —
  smaller value, and they can follow the same pattern later.
