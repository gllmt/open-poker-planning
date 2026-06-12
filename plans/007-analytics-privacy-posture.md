# Plan 007: Make analytics cookieless-by-default and document the privacy posture

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8b771d7..HEAD -- components/analytics/ app/layout.tsx README.md .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW (analytics fidelity trade-off, no product behavior change)
- **Depends on**: none
- **Category**: security (privacy)
- **Planned at**: commit `8b771d7`, 2026-06-12

## Why this matters

The app runs TWO analytics systems with no consent UI:

- **PostHog** — initialized for every visitor when the env key is set.
  Session recording, surveys, conversations, and product tours are already
  disabled (good), but **autocapture is on by default** (captures clicks/
  form interactions), pageviews are tracked with a **persistent
  distinct_id** (PostHog's default persistence is localStorage+cookie),
  and custom events carry `game_id`.
- **Umami** — cookieless, loaded in parallel from a self-hosted instance.

For an EU-hosted product (French maintainer, fr locale), persistent-
identifier analytics without consent is at minimum a deliberate decision
to make, not a default to inherit. The chosen posture (decided when this
plan was selected): **keep both tools but configure PostHog cookieless —
memory-only persistence, no autocapture** — which removes the
consent-triggering elements while keeping pageview/event counts, and
document exactly what is collected. No consent banner.

## Current state

All excerpts verified at commit `8b771d7`.

- `components/analytics/posthog-provider.tsx` (whole file is 38 lines) —
  current client options:

```tsx
<PostHogProvider
  apiKey={posthogKey}
  clientOptions={{
    advanced_disable_flags: true,
    defaults: '2026-01-30',
    disable_conversations: true,
    disable_external_dependency_loading: true,
    disable_product_tours: true,
    disable_session_recording: true,
    disable_surveys: true,
    ...(posthogHost ? { api_host: posthogHost } : {}),
  }}
>
  <Suspense fallback={null}>
    <PostHogPageView />
  </Suspense>
  {children}
</PostHogProvider>
```

  Note `defaults: '2026-01-30'` — PostHog's dated defaults preset; check
  what it implies for `capture_pageview` before changing anything (the
  `PostHogPageView` component suggests manual pageview capture is in use).

- `app/layout.tsx:59–67` — provider wraps the whole app; Umami loads
  `afterInteractive` from `https://umami.pierreguillemot.dev/script.js`
  with a hardcoded public `data-website-id`.
- Custom event call sites (event names + properties):
  - `components/poker/create-game.tsx:189–195` —
    `planning_poker_game_created` with `game_id`, `game_type`,
    `cards_count`, `has_member_session_controls`, `locale`.
  - `components/poker/join-game.tsx:146–151` —
    `planning_poker_game_joined` with `game_id`, `join_source`, `locale`,
    `reason`.
- `.env.example` documents `NEXT_PUBLIC_POSTHOG_KEY` and
  `NEXT_PUBLIC_POSTHOG_HOST` (names only — never copy values from any env
  file into this plan or your report).
- README has no analytics section at all.

## Commands you will need

| Purpose   | Command       | Expected on success                       |
|-----------|---------------|-------------------------------------------|
| Lint+types| `pnpm lints`  | exit 0                                    |
| Tests     | `pnpm test`   | all pass                                  |
| Build     | `pnpm build`  | exit 0                                    |

## Suggested executor toolkit

- PostHog JS config reference:
  https://posthog.com/docs/libraries/js/config — verify the exact option
  names for the installed `@posthog/next` version (it wraps `posthog-js`;
  `clientOptions` passes through). Key options this plan relies on:
  `persistence: 'memory'`, `autocapture: false`, and the EU/cookieless
  guidance at https://posthog.com/docs/privacy .

## Scope

**In scope** (the only files you should modify):
- `components/analytics/posthog-provider.tsx`
- `README.md` (new "Analytics & privacy" section)
- `.env.example` (comment lines next to the PostHog keys, names only)

**Out of scope** (do NOT touch):
- The Umami `<Script>` tag in `app/layout.tsx` — it stays as-is
  (cookieless already). De-hardcoding its host is plan 009's job.
- The custom `posthog.capture` calls in create-game/join-game — the event
  payloads are pseudonymous and stay.
- No consent-banner component — explicitly decided against.
- `next.config.ts` CSP — PostHog host is already allowlisted via env.

## Git workflow

- Branch: `advisor/007-analytics-privacy-posture`
- Commit message style: `fix: make posthog cookieless and document analytics posture`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Configure PostHog cookieless

In `posthog-provider.tsx`, extend `clientOptions`:

```tsx
clientOptions={{
  advanced_disable_flags: true,
  autocapture: false,
  defaults: '2026-01-30',
  disable_conversations: true,
  disable_external_dependency_loading: true,
  disable_product_tours: true,
  disable_session_recording: true,
  disable_surveys: true,
  persistence: 'memory',
  ...(posthogHost ? { api_host: posthogHost } : {}),
}}
```

Keep the existing options byte-identical; add only `autocapture: false`
and `persistence: 'memory'`, keeping the object's alphabetical-ish
ordering. Add a brief comment above the options block stating the
posture: cookieless analytics — memory persistence (new distinct_id per
page load), no autocapture, no recordings; only manual pageviews and the
two custom events.

**Verify**: `pnpm lints && pnpm build` → exit 0.

### Step 2: Document the posture

1. In `README.md`, add an "Analytics & privacy" section stating: which two
   tools run (PostHog self-config'd cookieless + self-hosted Umami,
   cookieless by design); that no cookies/localStorage are used for
   analytics identity; what is captured (pageviews, game created/joined
   events with pseudonymous game ids); and that both are disabled locally
   by leaving the env keys unset.
2. In `.env.example`, add one comment line above the PostHog keys noting
   that analytics is cookieless and optional (key names only, no values).

**Verify**: `grep -n "Analytics" README.md` → section present;
`pnpm lints` → exit 0.

### Step 3: Runtime sanity check (best effort)

If `.env.local` with a PostHog key is available: `pnpm dev`, load the home
page, and in DevTools confirm (a) no `ph_*` entry appears in localStorage
or cookies, and (b) a pageview request still fires to the PostHog host.
If no key is configured locally, skip and note it in your report —
the config change is still verified by types/build.

**Verify**: `pnpm lints && pnpm test && pnpm build` → all exit 0.

## Test plan

No unit tests — this is third-party client configuration; the assertions
that matter (no persistent storage, events still fire) are the manual
checks in step 3. Do not add a test that mocks posthog-js internals.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `posthog-provider.tsx` contains `persistence: 'memory'` and
      `autocapture: false`
- [ ] All previously present clientOptions are unchanged
- [ ] README has an Analytics & privacy section
- [ ] `pnpm lints`, `pnpm test`, `pnpm build` all exit 0
- [ ] `git status` shows only the three in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The installed `@posthog/next` version's `clientOptions` rejects
  `persistence` or `autocapture` (type error) — the wrapper may have
  renamed passthrough options; report the accepted shape instead of
  guessing.
- You find evidence that `defaults: '2026-01-30'` already implies
  cookieless/memory persistence (making the change a no-op) — report;
  the README documentation half of the plan still applies.
- Anyone asks you to add a consent banner — that reverses a decision made
  at planning time; it needs the operator, not you.

## Maintenance notes

- Memory persistence means PostHog funnels/retention across visits stop
  being meaningful (each page load is a fresh distinct_id) — if the
  maintainer later wants user-level retention metrics, that's the moment
  to revisit consent, not silently flip persistence back.
- If a future feature adds PostHog `identify()` or feature flags, the
  cookieless posture must be re-evaluated (flags are currently disabled
  via `advanced_disable_flags`).
- Server-side IP discarding is a PostHog *project setting*, not client
  config — note for the maintainer to toggle in the PostHog dashboard;
  it cannot be done from this repo.
