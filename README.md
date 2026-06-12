# Free Planning Poker (Next.js + Convex)

Real-time planning poker built with **Next.js App Router** and **Convex**.

## Setup

1) Run `pnpm install`.

2) Initialize Convex (creates `convex/_generated` and fills `.env.local`):
- `npx convex dev`

3) Create `.env.local` from `.env.example` for optional settings:
- `NEXT_PUBLIC_CONVEX_URL` (public)
- `CONVEX_DEPLOYMENT` (server-only)
- Optional: `SITE_ACCESS_CODE` (server-only) to enable the global access-code gate at `/access`
- Optional: `SITE_URL` (server-only) absolute URL used for SEO metadata and sitemap

## Commands

- Dev: `pnpm dev`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Run production: `pnpm start`

## How It Works (Security)

- No login: access is **token-based**.
- Create, join, invite, leave, and session flows go through `app/api/**` Route
  Handlers because they need HttpOnly cookie access.
- Gameplay actions (vote, reveal, reset, timer, auto-reveal, remove player, and
  delete game) call Convex mutations directly from the browser, authorized by
  token hashes.
- Realtime game state streams through a Convex `useQuery` subscription.
- Tokens are 256-bit random values stored in HttpOnly cookies. Convex stores
  SHA-256 token hashes; for direct gameplay mutations, the browser presents
  those hashes as bearer credentials.

## Usage Notes

- Use the **Invite** button to generate and share `/join/<gameId>?token=...`.
- Admin/player tokens are stored in **HttpOnly cookies** scoped per game.

## Analytics & Privacy

Analytics is optional in local development: leave the analytics environment
variables unset to disable it.

When enabled, the app uses two browser analytics tools:

- **PostHog** is configured cookieless: memory-only identity, no autocapture,
  no session recording, no surveys, no conversations, and no product tours.
- **Umami** is self-hosted and cookieless by design.

Analytics identity is not stored in cookies or localStorage. The app captures
pageviews plus two explicit product events: game created and game joined. Those
events include pseudonymous game ids and non-secret metadata such as game type,
card count, join source, reason, and locale.

## Deploy

Deploy on Vercel and set the same environment variables in the Vercel project settings.
