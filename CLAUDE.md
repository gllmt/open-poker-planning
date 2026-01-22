# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm build            # TypeScript check + production build
pnpm lint             # Run ESLint
pnpm lints            # Full lint suite: Biome + ESLint + TypeScript
pnpm biome:fix        # Auto-fix Biome issues
pnpm format           # Format code with Biome
```

## Architecture

Real-time planning poker app using **Next.js 16 App Router** + **Supabase** (Postgres + Realtime).

### Tech Stack
- **Frontend**: React 19, Tailwind CSS v4, Base UI, shadcn/ui, Lucide icons
- **Backend**: Next.js Route Handlers (all in `app/api/games/**`)
- **Database**: Supabase PostgreSQL with RLS (no public policies)
- **Realtime**: Supabase Broadcast channels for game state sync
- **i18n**: English (en) and French (fr) via `app/[lang]/` routes

### Key Directories
- `app/api/games/` - REST API endpoints (create, join, vote, reveal, reset, etc.)
- `app/[lang]/` - Locale-based pages (home, game view, join flow)
- `components/poker/` - Domain components (Poker, GameArea, Players, Timer, Results)
- `components/ui/` - Primitive UI components
- `lib/security/` - Token generation, hashing, cookie management (server-only)
- `lib/supabase/` - Supabase clients and broadcast logic
- `lib/api/` - Browser fetch wrappers for API calls
- `types/` - TypeScript interfaces (Game, Player, Status, CardConfig)
- `supabase/schema.sql` - PostgreSQL schema

### Security Model
- **No login**: Token-based access only
- **Tokens**: 256-bit random strings, SHA256 hashed before storage
- **Cookies**: HttpOnly, Secure (prod), SameSite=Lax, 30-day expiry
- **DB Access**: All queries via Service Role key in Route Handlers; clients never query Postgres directly
- **Broadcasts**: Notify clients to refetch; payloads contain no sensitive data

### Data Flow
1. Game creation returns `joinToken` (share via URL) and `adminToken` (stored in cookie)
2. Players join with invite token, receive `playerToken` in cookie
3. API routes verify tokens against hashed values in DB
4. State changes trigger Realtime broadcast → clients refetch via API
5. Recent commits use `after()` for non-blocking broadcast execution

## Coding Conventions

- TypeScript-first with strict mode
- Named exports for components
- Server-only code uses `server-only` import and must never touch `NEXT_PUBLIC_*` values
- Tailwind for styling; use existing `components/ui/` primitives
- Commit messages: imperative style with optional `feat:` / `fix:` prefix
- Ensure `pnpm lint` + `pnpm build` pass before PRs
