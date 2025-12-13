# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router pages and API Route Handlers (`app/api/**`).
- `components/`: client UI for the poker flows (create/join/game, timer, players).
- `lib/`: shared utilities:
  - `lib/api/`: browser fetch wrappers for `/api/**`.
  - `lib/security/`: token + cookie helpers (server-only).
  - `lib/supabase/`: Supabase clients (service role on server) + Realtime broadcast.
- `supabase/schema.sql`: Postgres schema (Phase 1 uses `games` + `players`).
- `public/`: static assets (e.g. `public/timer-notification.mp3`).

## Build, Test, and Development Commands

- Install: `pnpm install`
- Dev: `pnpm dev` (runs Next.js locally)
- Lint: `pnpm lint` (ESLint + `eslint-config-next`)
- Build: `pnpm build` (typecheck + production build)
- Start: `pnpm start` (serve the production build)

## Coding Style & Naming Conventions

- TypeScript-first. Prefer named exports for components and small, typed helpers in `lib/`.
- Tailwind for styling; keep UI logic in `components/` and data/security in `app/api/**` + `lib/security/**`.
- Server-only code must live behind `server-only` imports and must never touch `NEXT_PUBLIC_*` values.

## Security & Configuration Tips

- Copy `.env.example` to `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` is **server-only** (never expose it to the client).
- DB is intended to be private: RLS is enabled and there are no public policies; all DB access goes through Route Handlers using the service role key.
- Access is token-based (no login): admin/player tokens are stored in HttpOnly cookies; invite token is required to join.

## Commit & Pull Request Guidelines

- Current history is minimal (“Initial commit…”). Use clear, imperative subjects (optionally `feat:` / `fix:`).
- PRs: describe behavior changes, include screenshots for UI changes, and ensure `pnpm lint` + `pnpm build` pass.
