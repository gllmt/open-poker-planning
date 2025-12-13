# Free Planning Poker (Next.js + Supabase)

Real-time planning poker built with **Next.js App Router** and **Supabase Postgres + Realtime**.

## Setup

1) Create a Supabase project, then run the SQL in `supabase/schema.sql`.

2) Create `.env.local` from `.env.example`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser, used only for Realtime broadcast)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, used by Route Handlers)

## Commands

- Dev: `pnpm dev`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Run production: `pnpm start`

## How It Works (Security)

- No login: access is **token-based**.
- DB is **private** (RLS enabled, no public policies); clients never query Postgres directly.
- All reads/writes go through `app/api/**` using the Supabase **Service Role** key.
- Realtime uses a Supabase **broadcast channel** to notify clients to refetch state; broadcasts contain no sensitive data.

## Usage Notes

- Creating a game returns an **invite token**; share `/join/<gameId>?token=...`.
- Admin/player tokens are stored in **HttpOnly cookies** scoped per game.

## Deploy

Deploy on Vercel and set the same environment variables in the Vercel project settings.
