# Plan 009: Hygiene bundle — dep vulnerability bumps, docs truth-up, and small confirmed fixes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. Each numbered item is independent — if one hits a STOP
> condition, skip it, finish the others, and report which were skipped and
> why. When done, update the status row for this plan in `plans/README.md`
> — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- package.json pnpm-lock.yaml README.md CLAUDE.md next.config.ts app/layout.tsx components/poker/use-poker-controller.ts .env.example`
> Earlier plans are expected to have touched `package.json` (002 adds the
> `convex-test` devDependency), `use-poker-controller.ts` (004), and
> `README.md` (007) — reconcile with their diffs rather than treating
> those as drift. Anything else changed in the excerpted regions is drift.

## Status

- **Priority**: P3
- **Effort**: S–M (sum of small parts)
- **Risk**: LOW–MED (the dependency bumps are the only risk-bearing items)
- **Depends on**: none. Coordinate with 004 (shared file
  `use-poker-controller.ts`, disjoint regions).
- **Category**: tech-debt
- **Planned at**: commit `8b771d7`, 2026-06-12

## Why this matters

Accumulated small-but-real items from two audit passes, none worth a solo
plan, all worth fixing: known dependency vulnerabilities (2 high, dev-only;
2 moderate, build-time), project docs that describe an architecture that no
longer exists (actively misleading for contributors and executor agents),
a stale error message that survives game resets, a CLI tool shipped as a
runtime dependency, private LAN IPs committed to config, a duplicated
analytics host, and redundant lint scripts.

## Current state

All excerpts verified at commit `8b771d7`. `pnpm audit` on 2026-06-11:

- **high ×2**: `vite` ≤7.3.1 (fs.deny bypass GHSA-v2wj-q39q-566r, ws file
  read GHSA-p9ff-h696-f583, path traversal GHSA-4w7w-66w2-5vf9) via
  `vitest>vite` and `vitest>@vitest/mocker>vite` — dev-only.
- **moderate ×2**: `postcss` <8.5.10 (GHSA-qx2v-qp2m-jg93) via
  `next>postcss` and `@posthog/next>next>postcss` — build-time.

Manifest facts (`package.json`): `"next": "16.2.7"` (exact pin),
`"vitest": "^4.1.8"`, `"shadcn": "^4.11.0"` in `dependencies` (it's a
scaffolding CLI; `grep -rn "from 'shadcn'" app components lib types convex`
→ zero imports), scripts include both `"lint": "biome lint ."` and
`"lint:biome": "biome lint ."` (identical), and there is NO top-level
`packageManager` field (local pnpm verified at 11.5.3 on 2026-06-12 —
without the field, Vercel/corepack may resolve a different pnpm version
than local, risking lockfile drift).

Docs drift:
- `README.md:28` — "DB is managed by Convex; all reads/writes go through
  `app/api/**`" — FALSE: gameplay mutations call Convex directly from the
  browser (`components/poker/use-poker-controller.ts:175–181` creates
  `useMutation(api.games.vote)` etc.). Route handlers cover only
  create/join/invite/leave/session.
- `README.md:30` — "Realtime uses a Convex query subscription to detect
  updates and refetch state" — stale: the subscription streams the state
  itself (`useQuery(api.games.getViewerGameState, ...)`), no refetch.
- `CLAUDE.md` "Security Model" — "Tokens: 256-bit random strings, SHA256
  hashed before storage" — needs nuance: for the browser→Convex mutation
  path the hash itself is the presented bearer credential.

Code items:
- `components/poker/use-poker-controller.ts` — `onVote` clears the vote
  error (`dispatch({ type: 'set-vote-error', value: null })`, line 560)
  but `onReset` (lines 408–471) never does, so a failed-vote error message
  persists across round resets until the next vote attempt.
- `next.config.ts:75–81` — `allowedDevOrigins: ["192.168.1.10",
  "192.168.1.20", "10.0.5.109", "10.0.5.88"]` — private LAN IPs committed;
  dev-only Next.js option.
- Umami host duplicated: `next.config.ts:3`
  (`const umamiHost = "https://umami.pierreguillemot.dev"` — used in CSP)
  and `app/layout.tsx:63–67` (`<Script src="https://umami.pierreguillemot.dev/script.js"
  data-website-id="..." strategy="afterInteractive" />`). The website-id is
  public-by-design (served to every visitor) — not a secret.

## Commands you will need

| Purpose   | Command            | Expected on success                  |
|-----------|--------------------|---------------------------------------|
| Install   | `pnpm install`     | exit 0                                |
| Audit     | `pnpm audit`       | after item 1: no high findings        |
| Lint+types| `pnpm lints`       | exit 0                                |
| Tests     | `pnpm test`        | all pass                              |
| Build     | `pnpm build`       | exit 0                                |

## Scope

**In scope** (the only files you should modify):
- `package.json`, `pnpm-lock.yaml`
- `README.md`, `CLAUDE.md`
- `components/poker/use-poker-controller.ts` (one dispatch in `onReset`)
- `next.config.ts`, `app/layout.tsx` (umami constant + dev origins)
- `.env.example` (document new optional vars; names only)

**Out of scope** (do NOT touch):
- Anything covered by other plans: tests (002), Convex code (003/008),
  credential storage (004), rate limiting (005), dictionaries/components
  (006), PostHog config (007).
- CSP nonce work (`'unsafe-inline'`) — known, deliberately deferred; too
  big for this bundle.
- Do not upgrade React, Convex, Tailwind, Biome, or TypeScript — only the
  packages named in item 1.

## Git workflow

- Branch: `advisor/009-hygiene-bundle`
- One commit per item below (e.g. `chore(deps): patch vite/postcss advisories`,
  `docs: align README with direct-convex data flow`, `fix: clear vote error on reset`, ...).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Item 1: Dependency advisory bumps

1. `pnpm update vitest` (pulls vite ≥7.3.2 transitively; vitest is
   semver-ranged `^4.1.8`).
2. `next` is pinned exactly at `16.2.7`. Check the latest 16.x patch:
   `pnpm view next versions --json | tail -20`. Bump the pin to the latest
   **16.x** (no major jump) in `package.json`, then `pnpm install`.
3. Re-run `pnpm audit`. If postcss is still <8.5.10 via next's pin, add a
   pnpm override in `package.json`:
   `"pnpm": { "overrides": { "postcss": ">=8.5.10" } }` and `pnpm install`.

**Verify**: `pnpm audit` → no high-severity findings (moderate gone too if
the override applied); `pnpm lints && pnpm test && pnpm build` → all exit 0.

### Item 2: Docs truth-up (README + CLAUDE.md)

Rewrite `README.md` "How It Works (Security)" to state, accurately:
- create/join/invite/leave/session flows go through `app/api/**` route
  handlers (they need HttpOnly cookie access);
- gameplay (vote/reveal/reset/timer/autoReveal/removePlayer/deleteGame)
  calls Convex mutations directly from the browser, authorized by token
  hashes;
- realtime state streams via a Convex `useQuery` subscription (no
  refetch);
- tokens are 256-bit random values stored in HttpOnly cookies; the SHA-256
  hash of a token is what Convex stores AND what the browser presents on
  the direct-mutation path (i.e. the hash is the bearer credential for
  gameplay actions).

Apply the same data-flow corrections to the `CLAUDE.md` "Security Model"
and "Data Flow" sections. **First check `plans/README.md`**: if plan 004
is DONE, describe the post-004 state (no hashes in localStorage or JSON
responses); if not, don't mention localStorage either way (004 will change
it).

**Verify**: `grep -n "all reads/writes" README.md` → no match;
`pnpm lints` → exit 0 (markdown isn't linted, but catch accidental code
edits).

### Item 3: Clear vote error on reset

In `components/poker/use-poker-controller.ts`, inside `onReset` right
after `clearPendingVote();` (line 418 at `8b771d7`), add:

```ts
dispatch({ type: 'set-vote-error', value: null });
```

(Coordination: plan 004 edits `applyServerState` in the same file —
different region; rebase normally if both are in flight.)

**Verify**: `pnpm lints` → exit 0; `grep -n "set-vote-error" components/poker/use-poker-controller.ts`
→ ≥3 matches (reducer case, onVote, onReset).

### Item 4: package.json hygiene — `shadcn` placement and `packageManager` pin

1. Move `"shadcn"` from `dependencies` to `devDependencies` (it's the
   component-scaffolding CLI used with `components.json`; never imported).
2. Add a top-level `"packageManager": "pnpm@11.5.3"` field (use the exact
   output of `pnpm -v` if it differs) so Vercel/corepack resolve the same
   pnpm version as local installs.
3. Run `pnpm install` to refresh the lockfile.

**Verify**: `pnpm lints && pnpm build` → exit 0; `node -e "const p=require('./package.json'); if (p.dependencies.shadcn || !p.packageManager) process.exit(1)"` → exit 0.

### Item 5: De-hardcode dev origins and the Umami host

1. `next.config.ts`: replace the literal `allowedDevOrigins` array with
   an env-driven value:

```ts
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
```

   and pass it to the config (omit the key entirely when the array is
   empty, to keep default behavior). Document `ALLOWED_DEV_ORIGINS` in
   `.env.example` with a comment that it's a dev-only comma-separated
   list (no values).
2. Umami: read host and website id from env with the current values as
   fallback so deployments don't break:
   in `next.config.ts`, `const umamiHost = process.env.NEXT_PUBLIC_UMAMI_HOST ?? "https://umami.pierreguillemot.dev";`
   and in `app/layout.tsx` build the script src/website-id from
   `process.env.NEXT_PUBLIC_UMAMI_HOST` / `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
   with the same fallbacks. Render the `<Script>` only when a host is
   resolved (always true with the fallback). Add both names to
   `.env.example`.

**Verify**: `pnpm build` → exit 0 and the CSP in `.next` output still
contains the umami host (`grep -r "umami" .next/server/*.js | head -1` or
simply confirm `pnpm build` succeeded and `next.config.ts` compiles);
`pnpm lints` → exit 0.

### Item 6: De-duplicate lint scripts

In `package.json` scripts: delete `"lint:biome"` (identical to `"lint"`).
Keep `lint`, `lints`, `biome:check`, `biome:fix`, `format`, `format:check`
as-is. Update the command table in `CLAUDE.md` if it lists `lint:biome`
(at `8b771d7` it does not — check anyway).

**Verify**: `pnpm lint` → exit 0; `grep -c "biome lint" package.json` → 1.

### Item 7: Full gate

**Verify**: `pnpm install && pnpm lints && pnpm test && pnpm build` → all
exit 0; `pnpm audit` → no high findings.

## Test plan

No new tests — every item is config/docs/one-liner scale, each with its
own command-level verification above. The existing suite plus `pnpm build`
is the regression net.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm audit` reports zero high-severity advisories
- [ ] `pnpm lints`, `pnpm test`, `pnpm build` all exit 0
- [ ] README no longer claims all reads/writes go through `app/api/**`
- [ ] `onReset` dispatches `set-vote-error: null`
- [ ] `shadcn` absent from `dependencies` (present in `devDependencies`)
- [ ] `package.json` has a `packageManager` field pinning pnpm
- [ ] No literal LAN IPs in `next.config.ts` (`grep -E "192\.168|10\.0\." next.config.ts` → no match)
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated (note any skipped items)

## STOP conditions

(Per the header: STOP applies per-item — skip that item, continue the rest.)

- Item 1: the latest next 16.x patch introduces breaking changes visible
  in `pnpm build` or `pnpm test`, or only a major (17.x) fixes the
  advisory — skip the next bump, keep the vitest bump, report.
- Item 2: README has been substantially rewritten since `8b771d7` (drift)
  — reconcile manually only if the inaccurate claims are still present
  verbatim; otherwise skip.
- Item 3: plan 004 landed changes that moved/renamed `onReset` — re-locate
  it by the `resetRequestIdRef` reference; if the structure differs
  materially from the excerpt, skip and report.
- Item 5: `next.config.ts` cannot read env at config time in this setup
  (build fails) — revert that sub-item, keep the rest.

## Maintenance notes

- The pnpm `overrides` entry (if added in item 1) should be deleted once
  `next` ships with postcss ≥8.5.10 — leave a dated comment next to it.
- After item 5, local multi-device dev needs `ALLOWED_DEV_ORIGINS` set in
  `.env.local` — mention it to the maintainer in your report (their LAN
  IPs are no longer baked in).
- The CSP nonce migration (`'unsafe-inline'` removal) remains the largest
  deferred hygiene item; it interacts with the inline theme script in
  `app/layout.tsx:16–17` and should be its own plan if selected later.
