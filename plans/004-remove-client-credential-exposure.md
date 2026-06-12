# Plan 004: Remove bearer-credential token hashes from localStorage and API JSON responses

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- types/player.ts lib/browser-storage.ts lib/api/games.ts app/api/games/route.ts "app/api/games/[gameId]/join/route.ts" "app/api/games/[gameId]/session/route.ts" components/poker/create-game.tsx components/poker/join-game.tsx components/poker/use-poker-controller.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the create/join/rejoin flows end to end)
- **Depends on**: plans/002-convex-authz-tests.md (regression net for the
  auth flows this touches)
- **Category**: security
- **Planned at**: commit `8b771d7`, 2026-06-11

## Why this matters

In this app's auth model, the SHA-256 "token hashes" are not just stored
fingerprints — they are the **presented credentials**: Convex mutations
authorize by comparing the client-presented hash to the stored hash
(`convex/games.ts`, e.g. `timingSafeStringEqual(caller.playerTokenHash,
playerTokenHash)`). Whoever holds a player's or admin's token hash can act
as them for ~the lifetime of the game.

Today those credentials are (a) returned in JSON from the create/join API
routes and (b) persisted in `localStorage` for up to 20 games — where any
XSS, malicious browser extension, or shared-machine snoop can read them.
And it's all **dead weight**: the game page derives the hashes server-side
from HttpOnly cookies on every load, and nothing ever reads the cached
hash fields back for behavior. This plan deletes the exposure chain:
localStorage keeps only display metadata (id/name/createdBy), and the API
responses stop echoing credentials the client doesn't use.

## Current state

All excerpts verified at commit `8b771d7`.

**Where the real session comes from (do not touch — context only):**
`app/[lang]/game/[id]/page.tsx:26–34` reads the HttpOnly cookies, hashes
server-side, and passes `initialSession` to the client (in memory only).
This is why the cached copies are redundant.

**The exposure chain to remove:**

1. `types/player.ts:11–22` — the cached record type:

```ts
export interface PlayerGame {
  id: string;
  name: string;
  createdById: string;
  createdBy: string;
  playerId: string;
  joinToken?: string;
  joinTokenHash?: string;
  playerTokenHash?: string;
  adminTokenHash?: string;
  isAllowMembersToManageSession?: boolean;
}
```

2. `app/api/games/route.ts:87–96` — create response returns `joinToken`,
   `joinTokenHash`, `playerTokenHash`, `adminTokenHash` in JSON (the
   plaintext tokens also go into HttpOnly cookies at lines 99–108 — keep
   the cookies).

3. `app/api/games/[gameId]/join/route.ts:59–66` — join response returns
   `playerTokenHash` and `joinTokenHash` in JSON.

4. `lib/api/games.ts:19–26, 41–49` — the fetch wrappers' return types
   mirror those JSON shapes.

5. `components/poker/create-game.tsx:166–187` — destructures the hashes
   from the response and writes them into the cache via `upsertPlayerGame`.

6. `components/poker/join-game.tsx:127–144` — same pattern, including
   `joinToken: state.inviteToken` (the **plaintext** invite token).

7. `components/poker/use-poker-controller.ts:305–320` — on every server
   snapshot, re-upserts the cache including
   `playerTokenHash: authRef.current.playerTokenHash`,
   `adminTokenHash: authRef.current.adminTokenHash`, and preserves
   `cached?.joinToken` / `cached?.joinTokenHash`.

8. `lib/browser-storage.ts:110–125` — `clearPlayerGameSession` nulls the
   token fields on exit (evidence they were always write-only).

9. `app/api/games/[gameId]/session/route.ts:29–35` — the GET handler
   returns `playerTokenHash` and `adminTokenHash` in its JSON `'active'`
   branch. Verified at planning time: the ONLY in-repo call to this path
   is `clearGameSession` (`lib/api/games.ts:70–77`), which uses the
   DELETE method — the GET response currently has zero consumers.

**Consumer audit (verified):** the only reads of the cache are
`components/poker/recent-games.tsx:13` (uses `id`, `name`, `createdBy`
only) and `use-poker-controller.ts:305` (reads `cached?.joinToken` /
`joinTokenHash` solely to write them back). Invite links are minted fresh
via `POST /api/games/[gameId]/invite` (`lib/api/games.ts:58–68`); the
cached `joinToken` is never displayed. Re-verify before starting:

```
grep -rn "joinToken\|playerTokenHash\|adminTokenHash" app components lib types --include='*.ts*' | grep -v "app/api" | grep -v "app/\[lang\]"
```

**Convention note:** client code uses typed fetch wrappers in
`lib/api/games.ts`; server-only crypto lives in `lib/security/` (imports
`server-only`). Match these placements.

## Commands you will need

| Purpose   | Command       | Expected on success                       |
|-----------|---------------|-------------------------------------------|
| Tests     | `pnpm test`   | all pass                                  |
| Lint+types| `pnpm lints`  | exit 0                                    |
| Build     | `pnpm build`  | exit 0                                    |

## Scope

**In scope** (the only files you should modify):
- `types/player.ts`
- `lib/browser-storage.ts`
- `lib/api/games.ts`
- `app/api/games/route.ts`
- `app/api/games/[gameId]/join/route.ts`
- `app/api/games/[gameId]/session/route.ts` (GET response body only)
- `components/poker/create-game.tsx`
- `components/poker/join-game.tsx`
- `components/poker/use-poker-controller.ts`
- `tests/browser-storage.test.ts` (create, only if step 5's scrub logic is
  testable in the node environment — see step 5)

**Out of scope** (do NOT touch):
- Cookie handling (`lib/security/cookies.ts`, the `response.cookies.set`
  calls) — the HttpOnly cookie flow is the *correct* path and stays.
- `app/[lang]/game/[id]/page.tsx` — server-side hash derivation stays;
  the in-memory `initialSession`/reducer state is acceptable (ephemeral,
  not persisted).
- The DELETE handler in `session/route.ts` — only the GET response
  changes.
- `convex/**` — no backend change.
- The `leave` and `invite` routes.

## Git workflow

- Branch: `advisor/004-remove-client-credential-exposure`
- Commit message style: `fix: stop persisting token hashes in localStorage and API responses`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Shrink the `PlayerGame` type

In `types/player.ts`, remove `joinToken`, `joinTokenHash`,
`playerTokenHash`, `adminTokenHash` from `PlayerGame`. Keep `playerId`,
`createdById`, `isAllowMembersToManageSession` (display/metadata, not
credentials).

**Verify**: `pnpm lints` → FAILS with type errors at exactly the call
sites listed in "Current state" items 5–8. (This failure is the expected
checkpoint; fix in the next steps.)

### Step 2: Update the cache writers

- `components/poker/create-game.tsx` — drop the removed fields from the
  `upsertPlayerGame` call and from the destructuring of `createGame(...)`.
- `components/poker/join-game.tsx` — same; stop passing
  `joinToken: state.inviteToken`.
- `components/poker/use-poker-controller.ts` (`applyServerState`,
  lines 305–320) — drop the `cached` lookup and the four token fields from
  the upsert (the `getPlayerGamesFromCache` import may become unused —
  remove it if so).
- `lib/browser-storage.ts` — simplify `clearPlayerGameSession` to only
  reset `playerId` (the token fields no longer exist on the type).

**Verify**: `pnpm lints` → exit 0.

### Step 3: Stop returning credentials in JSON

- `app/api/games/route.ts:87–96` — response body becomes
  `{ gameId, joinToken, playerId }`. Keep `joinToken` ONLY if your step 2
  grep confirmed `create-game.tsx` was its last consumer and nothing else
  displays it — per the verified consumer audit it has no remaining reader,
  so the expected end state is `{ gameId, playerId }`.
- `app/api/games/[gameId]/join/route.ts:59–66` — response body becomes
  `{ playerId }`.
- `app/api/games/[gameId]/session/route.ts:29–35` — the GET `'active'`
  branch becomes `{ state: 'active', playerId: viewerState.currentPlayerId }`
  (drop `playerTokenHash` and `adminTokenHash`). Before changing it,
  re-verify the zero-consumer claim:
  `grep -rn "/session" app components lib --include='*.ts*' | grep -v "app/api"`
  → only `clearGameSession` in `lib/api/games.ts` (DELETE). Leave the
  hash computation that feeds `fetchQuery` untouched, and leave the
  DELETE handler untouched.
- `lib/api/games.ts` — update `createGame`/`joinGame` return types to
  match.

**Verify**: `pnpm lints` → exit 0;
`grep -n "TokenHash" app/api/games/route.ts "app/api/games/[gameId]/join/route.ts" "app/api/games/[gameId]/session/route.ts"`
→ matches only in variables passed to `fetchMutation`/`fetchQuery`
(server-side), none inside `NextResponse.json` bodies.

### Step 4: Scrub stale credentials from existing users' localStorage

Existing browsers still hold old `playerGames` entries containing hashes.
In `lib/browser-storage.ts`, make `getPlayerGamesFromCache` strip unknown/
removed fields defensively and re-persist once when it finds any:

```ts
const STRIPPED_KEYS = [
  'joinToken',
  'joinTokenHash',
  'playerTokenHash',
  'adminTokenHash',
] as const;
```

Parse the raw array; if any entry has one of those keys, map every entry
through a sanitizer that deletes them, call `updatePlayerGamesInCache`
with the cleaned array, and return the cleaned value. Keep the existing
`try/catch`-and-return-`[]` behavior for malformed JSON.

**Verify**: `pnpm lints` → exit 0.

### Step 5: Manual + automated verification

Automated: if a unit test is feasible in the node vitest environment,
create `tests/browser-storage.test.ts` that stubs
`globalThis.window = { localStorage: <in-memory stub> }` before importing,
seeds a legacy entry containing the four fields, and asserts
`getPlayerGamesFromCache()` returns entries without them AND the stub's
stored value no longer contains the substring `TokenHash`. Model the file
layout on `tests/safe-redirect.test.ts`. If module-load-time `window`
checks make this impractical without jsdom, SKIP the test file and note it
in your report instead of adding new dev dependencies.

Manual (requires a configured Convex dev deployment — if `.env.local` is
absent, skip and note it):
1. `pnpm dev`, create a game, open DevTools → Application → Local Storage:
   the `playerGames` entry contains no `TokenHash` substrings and no
   `joinToken`.
2. Reload the game page — the game still loads (session restored from
   HttpOnly cookies).
3. Network tab on create/join: response JSON contains no `TokenHash`
   fields.
4. Invite button still produces a working invite link (it mints a fresh
   token via `/api/games/<id>/invite`).
5. Recent games list on the home page still shows the game.

**Verify**: `pnpm lints && pnpm test && pnpm build` → all exit 0.

## Test plan

- Plan 002's Convex suite (must already pass) covers the backend auth
  behavior this plan must not disturb — it doesn't change `convex/`.
- New (best-effort, see step 5): `tests/browser-storage.test.ts` covering
  the legacy-entry scrub: entry with hashes → cleaned on read; clean entry
  → returned as-is; malformed JSON → `[]`.
- The decisive check is the grep-based done criteria below plus the manual
  flow if a dev deployment is available.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lints`, `pnpm test`, `pnpm build` all exit 0
- [ ] `grep -rn "playerTokenHash\|adminTokenHash\|joinTokenHash" types/player.ts lib/browser-storage.ts components/poker/create-game.tsx components/poker/join-game.tsx components/poker/recent-games.tsx` → no matches
- [ ] In `components/poker/use-poker-controller.ts`, the only remaining
      `TokenHash` references are the in-memory `PokerSession`/auth state and
      mutation arguments — none flow into `upsertPlayerGame`
- [ ] `grep -n "TokenHash" app/api/games/route.ts "app/api/games/[gameId]/session/route.ts"`
      shows no hash inside any `NextResponse.json` body
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The consumer-audit grep (Current state, bottom) reveals a NEW reader of
  cached `joinToken`/hash fields that didn't exist at `8b771d7` — the
  "write-only cache" premise would be false.
- Removing `joinToken` from the create response breaks a UI flow you can
  see in code (e.g. some component builds an invite URL from it) — the
  audit says none exists; finding one means drift.
- The rejoin flow (`app/[lang]/game/[id]/page.tsx` redirect to join page
  when cookies are absent) appears to depend on cached credentials in any
  way.
- The zero-consumer grep in step 3 finds a caller of GET `/session` that
  reads `playerTokenHash`/`adminTokenHash` from the response — the
  "write-only" premise for the session GET would be false; report it.
- You are tempted to add jsdom or any new dependency to write the storage
  test — skip the test instead (step 5).

## Maintenance notes

- The remaining exposure is the in-memory reducer state holding the
  session hashes (`use-poker-controller.ts`) — acceptable (required for
  direct browser→Convex mutations) but worth revisiting if the app ever
  adds third-party scripts beyond the current CSP allowlist.
- `README.md`/`CLAUDE.md` still describe tokens as "hashed before storage"
  as if that protects the mutation path; a docs truth-up was deliberately
  left out of this plan's scope (it was offered as a separate hygiene plan
  and not selected). Reviewers shouldn't block this PR on docs.
- If a future feature needs the invite token re-displayed after creation,
  mint a fresh invite via the existing `/invite` route instead of
  resurrecting the cached `joinToken`.
