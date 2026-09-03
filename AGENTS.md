# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router pages and API Route Handlers (`app/api/**`).
- `components/`: client UI for the poker flows (create/join/game, timer, players).
- `lib/`: shared utilities:
  - `lib/api/`: browser fetch wrappers for `/api/**`.
  - `lib/security/`: token + cookie helpers (server-only).
  - `lib/convex/`: Convex error helpers.
- `convex/`: Convex schema, queries, and mutations.
- `public/`: static assets (e.g. `public/timer-notification.mp3`).

## Build, Test, and Development Commands

- Install: `pnpm install`
- Dev: `pnpm dev` (runs Next.js locally)
- Lint: `pnpm lint` (Biome lint)
- Build: `pnpm build` (typecheck + production build)
- Start: `pnpm start` (serve the production build)
- Test: `pnpm test` (Vitest)

## Coding Style & Naming Conventions

- TypeScript-first. Prefer named exports for components and small, typed helpers in `lib/`.
- Tailwind for styling; keep UI logic in `components/` and data/security in `app/api/**` + `lib/security/**`.
- Server-only code must live behind `server-only` imports and must never touch `NEXT_PUBLIC_*` values.

## Security & Configuration Tips

- Copy `.env.example` to `.env.local`.
- Convex is the source of truth for game state; client subscriptions use `NEXT_PUBLIC_CONVEX_URL`.
- Access is token-based (no login): admin/player tokens are stored in HttpOnly cookies; invite token is required to join.
- Route Handlers are used where server-generated tokens or cookies are required; gameplay state changes use Convex queries/mutations.

## Commit & Pull Request Guidelines

- Use clear, imperative commit subjects (optionally `feat:` / `fix:`).
- PRs: describe behavior changes, include screenshots for UI changes, and ensure `pnpm lint`, `pnpm test`, and `pnpm build` pass.
