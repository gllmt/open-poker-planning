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
- DB is managed by **Convex**; all reads/writes go through `app/api/**`.
- Realtime uses a **Convex query subscription** to detect updates and refetch state.

## Usage Notes

- Creating a game returns an **invite token**; share `/join/<gameId>?token=...`.
- Admin/player tokens are stored in **HttpOnly cookies** scoped per game.

## Deploy

Deploy on Vercel and set the same environment variables in the Vercel project settings.
