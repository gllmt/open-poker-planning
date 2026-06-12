# Plan 005: Add rate limiting and close the /api gap in the site-access gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- proxy.ts "app/[lang]/access/actions.ts" app/api/games/ lib/security/ tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (a too-strict limiter can lock out legitimate users; the
  proxy change touches every request)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8b771d7`, 2026-06-11

## Why this matters

Three unauthenticated abuse surfaces exist today:

1. `POST /api/games` inserts 3 rows into Convex (game + player + invite)
   per anonymous request, with no throttle — a trivial script can fill the
   database and burn the Convex quota of this free app.
2. The optional `SITE_ACCESS_CODE` gate **explicitly exempts `/api`**
   (`proxy.ts:100–106`), so even a "private" deployment exposes all write
   endpoints publicly.
3. The access-code form itself (`app/[lang]/access/actions.ts`) accepts
   unlimited guesses, so a short access code can be brute-forced.

This plan adds a small in-memory fixed-window rate limiter for the route
handlers and the access action, and extends the access gate to cover
`/api`. On serverless (Vercel), an in-memory limiter is per-instance and
therefore best-effort — that is accepted and documented here; it still
stops naive single-source abuse, which is the realistic threat for this
app.

## Current state

All excerpts verified at commit `8b771d7`.

- `proxy.ts` (root) is the Next.js middleware ("proxy" is Next 16's name
  for it). The exemption:

```ts
// proxy.ts:100–106
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }
```

  Further down (`proxy.ts:117–129`), for page routes: if
  `process.env.SITE_ACCESS_CODE` is set and the request lacks a valid
  HMAC-signed `pp_site_access` cookie, it redirects to `/{locale}/access`.
  The cookie validator is `isValidAccessCookie(value, secret)`
  (`proxy.ts:28–46`), already implemented in this file.

- `app/[lang]/access/actions.ts:19–50` — `submitAccessCode` server action:
  validates with timing-safe `safeEqual(code, secret)`, no attempt limit.
  It already imports from `lib/security/*`.

- Route handlers to protect (all under `app/api/games/`):
  - `app/api/games/route.ts` — POST, creates a game. No auth of any kind.
  - `app/api/games/[gameId]/join/route.ts` — POST, requires a valid invite
    token (checked in Convex) but inserts a player row per success and
    costs a Convex call per attempt.
  - `app/api/games/[gameId]/invite/route.ts` — POST, requires player
    cookie; Convex enforces a 100-active-invite cap per game.
- Error-response convention in these handlers:
  `NextResponse.json({ error: '...' }, { status: NNN })` — the invite route
  already returns a 429 for `TOO_MANY_INVITES` (`invite/route.ts:50–55`);
  match that shape.
- `lib/security/` — server-only modules (`tokens.ts` starts with
  `import 'server-only'` — check and match). New limiter goes here.
- Test exemplar: `tests/safe-redirect.test.ts` (plain vitest, node env,
  imports via `@/` alias).
- There is NO Redis/KV anywhere in this stack — do not add one.

## Commands you will need

| Purpose   | Command       | Expected on success                       |
|-----------|---------------|-------------------------------------------|
| Tests     | `pnpm test`   | all pass (existing + new limiter tests)   |
| Lint+types| `pnpm lints`  | exit 0                                    |
| Build     | `pnpm build`  | exit 0                                    |

## Scope

**In scope** (the only files you should modify/create):
- `lib/security/rate-limit.ts` (create)
- `tests/rate-limit.test.ts` (create)
- `app/api/games/route.ts`
- `app/api/games/[gameId]/join/route.ts`
- `app/api/games/[gameId]/invite/route.ts`
- `app/[lang]/access/actions.ts`
- `proxy.ts`

**Out of scope** (do NOT touch):
- `convex/**` — backend-side limits (e.g. the invite cap) already exist;
  adding a Convex rate-limiter component is a separate decision.
- `app/api/games/[gameId]/leave/route.ts` and `session/route.ts` —
  cookie-gated, low write cost; leaving them unthrottled is deliberate.
- Gameplay mutations (vote/reveal/reset) — they go browser→Convex directly
  and cannot be limited here.
- Any new dependency. The limiter is ~40 lines of stdlib code.

## Git workflow

- Branch: `advisor/005-rate-limiting-abuse-controls`
- Commit message style: `fix: rate limit public endpoints and gate /api behind site access`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the limiter

Create `lib/security/rate-limit.ts` — fixed-window, in-memory, injectable
clock for tests:

```ts
import 'server-only';

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000; // hard cap so the map itself can't be a DoS vector

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Drop expired entries; if still full, fail open (availability first).
      for (const [k, w] of buckets) {
        if (w.resetAt <= now) buckets.delete(k);
      }
      if (buckets.size >= MAX_BUCKETS) return false;
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  existing.count += 1;
  return existing.count > limit;
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? 'unknown';
}
```

Important: `server-only` cannot be imported by vitest node tests. To keep
the logic testable, EITHER split the pure logic into an internal function
the test imports via a separate non-`server-only` module, OR follow the
existing repo pattern — check how `tests/safe-redirect.test.ts` imports
`lib/security/safe-redirect.ts`: if that module does NOT import
`server-only`, mirror its structure (pure logic module without the import)
and rely on it never touching env/secrets. Match whichever pattern
`safe-redirect.ts` actually uses.

**Verify**: `pnpm lints` → exit 0.

### Step 2: Unit-test the limiter

Create `tests/rate-limit.test.ts` (model on `tests/safe-redirect.test.ts`):

- under the limit → not limited (call N=limit times, all `false`)
- call limit+1 within the window → `true`
- window expiry: advance the injected `now` past `windowMs` → `false` again
- independent keys don't interfere
- `getClientIp`: takes first entry of comma-separated `x-forwarded-for`;
  falls back to `x-real-ip`; falls back to `'unknown'`

**Verify**: `pnpm test` → all pass including the new file.

### Step 3: Apply to the three route handlers

At the top of each handler, before any body parsing or Convex call:

```ts
const ip = getClientIp(request.headers);
if (isRateLimited(`create-game:${ip}`, 10, 60_000)) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

Limits (per IP, per minute): `create-game` 10, `join-game:${gameId}` 20,
`create-invite:${gameId}` 30. Use those exact bucket prefixes. Note the
join/invite keys include the gameId so one hot game can't starve others
from the same NAT.

In `app/api/games/route.ts` the handler signature is
`POST(request: Request)` — `request.headers` is a standard `Headers`
object; same for the other two.

**Verify**: `pnpm lints` → exit 0; `pnpm build` → exit 0.

### Step 4: Limit access-code attempts

In `app/[lang]/access/actions.ts`, before comparing the code: read the IP
from `headers()` (`import { headers } from 'next/headers'`, it is async in
Next 16 — `const ip = getClientIp(await headers())`). If
`isRateLimited(\`access-code:${ip}\`, 5, 60_000)`, redirect to the error
state exactly like a wrong code (`?error=1`) — do not reveal that
rate limiting (rather than a wrong code) triggered the rejection, to keep
the response uniform.

**Verify**: `pnpm lints` → exit 0.

### Step 5: Close the /api hole in the access gate

In `proxy.ts`, replace the blanket `/api` exemption. Target behavior:

- `/_next` and `PUBLIC_FILE` requests: unchanged, always pass.
- `pathname.startsWith('/api')`:
  - if `process.env.SITE_ACCESS_CODE` is unset → `NextResponse.next()`
    (current behavior for unconfigured deployments);
  - if set and the request carries a valid access cookie
    (`isValidAccessCookie`) → `NextResponse.next()`;
  - otherwise → `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
    (NOT a redirect — these are fetch calls).
- Page routes: existing locale + access-gate logic unchanged.

Keep the locale handling completely out of the `/api` branch (no locale
cookie set on API responses). The access cookie is HttpOnly and scoped to
`path: '/'`, so browsers that passed the page gate send it on same-origin
`fetch('/api/...')` automatically — no client change needed.

**Verify**: `pnpm lints && pnpm build` → exit 0.

### Step 6: Manual verification (needs a Convex dev deployment)

If `.env.local` is absent, skip and note it in your report.

1. Without `SITE_ACCESS_CODE`: `pnpm dev`; create a game via the UI →
   works. Then `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/games -H 'content-type: application/json' -d '{"name":"x","createdBy":"y","gameType":"fibonacci","cards":[{"value":1,"displayValue":"1","color":"#fff"}]}'; done`
   → first ~10 return 201/400, the rest 429.
2. With `SITE_ACCESS_CODE=test-code` in `.env.local` (restart dev server):
   `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/games ...`
   without a cookie → 401. Pass the gate in the browser, create a game →
   works end to end.
3. Access form: submit 6 wrong codes quickly → still lands on
   `?error=1` (uniform), and a correct code on the 6th attempt within the
   window is also rejected (limited).

**Verify**: behaviors above match; then `pnpm lints && pnpm test && pnpm build` → all exit 0.

## Test plan

- `tests/rate-limit.test.ts` (step 2): 5+ cases listed there, pure unit
  tests with injected `now`.
- Proxy and route-handler integration is covered by the manual script in
  step 6 (no HTTP-level test harness exists in this repo; adding one is
  out of scope).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lints`, `pnpm test`, `pnpm build` all exit 0
- [ ] `tests/rate-limit.test.ts` exists with ≥5 passing tests
- [ ] `grep -n "isRateLimited" app/api/games/route.ts "app/api/games/[gameId]/join/route.ts" "app/api/games/[gameId]/invite/route.ts" "app/[lang]/access/actions.ts"` → one match per file
- [ ] `grep -n "startsWith('/api')" proxy.ts` shows the branch returning a
      401 JSON when the secret is set and the cookie is absent/invalid
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `lib/security/safe-redirect.ts` turns out to import `server-only` AND
  its test imports it anyway via some vitest config trick you can't find —
  the testability strategy for the limiter needs an operator decision.
- `headers()` in a server action behaves differently than described
  (cannot obtain the request IP) — do not silently skip the access-code
  limiter; report it.
- The proxy change breaks the locale redirect flow in any way visible in
  `pnpm build` or manual nav — revert the proxy edit and report.
- You are tempted to add Redis/Upstash/a rate-limit package — that's an
  infra decision the operator must make; the in-memory limiter is the
  agreed scope.

## Maintenance notes

- The limiter is per-serverless-instance: under multi-instance load real
  limits are N× the configured numbers, and instances reset on cold start.
  If the app outgrows this, the upgrade path is the official Convex
  rate-limiter component (`@convex-dev/rate-limiter`) enforced inside
  mutations — revisit then, don't bolt KV onto Vercel for this.
- If gameplay-mutation abuse (vote spam via direct Convex calls) ever
  becomes real, it must be solved in `convex/games.ts`, not here.
- Reviewer should sanity-check the chosen limits against real usage
  (a workshop of 30 people behind one corporate NAT joining one game:
  `join-game:${gameId}` at 20/min/IP may need raising to ~40).
