# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm build            # TypeScript check + production build
pnpm lint             # Run Biome lint
pnpm test             # Run Vitest tests
pnpm lints            # Full lint suite: Biome + TypeScript
pnpm biome:fix        # Auto-fix Biome issues
pnpm format           # Format code with Biome
```

## Architecture

Real-time planning poker app using **Next.js 16 App Router** + **Convex**.

### Tech Stack
- **Frontend**: React 19, Tailwind CSS v4, Base UI, shadcn/ui, Lucide icons
- **Backend**: Convex queries/mutations plus Next.js Route Handlers for token and cookie flows
- **Database/Realtime**: Convex
- **i18n**: English (en) and French (fr) via `app/[lang]/` routes

### Key Directories
- `app/api/games/` - REST API endpoints (create, join, vote, reveal, reset, etc.)
- `app/[lang]/` - Locale-based pages (home, game view, join flow)
- `components/poker/` - Domain components (Poker, GameArea, Players, Timer, Results)
- `components/ui/` - Primitive UI components
- `lib/security/` - Token generation, hashing, cookie management (server-only)
- `lib/convex/` - Convex error helpers
- `lib/api/` - Browser fetch wrappers for API calls
- `types/` - TypeScript interfaces (Game, Player, Status, CardConfig)
- `convex/` - Convex schema, queries, and mutations

### Security Model
- **No login**: Token-based access only
- **Tokens**: 256-bit random strings stored in HttpOnly cookies; Convex stores SHA-256 hashes
- **Cookies**: HttpOnly, Secure (prod), SameSite=Lax, 30-day expiry
- **Data access**: Convex functions enforce token hashes and membership state. On direct browser-to-Convex gameplay mutations, the hash itself is the bearer credential.
- **Credential exposure**: token hashes are not stored in localStorage and are not returned in API JSON responses
- **Realtime**: Convex subscriptions stream game state directly to clients

### Data Flow
1. Game creation stores admin/player tokens in HttpOnly cookies and returns only non-secret ids to the browser
2. Invite links carry invite tokens; players join through Route Handlers and receive `playerToken` in an HttpOnly cookie
3. Route Handlers cover create, join, invite, leave, and session flows that need cookie access
4. Gameplay updates call Convex mutations directly from the browser with hashed bearer credentials
5. Convex `useQuery` subscriptions stream current game state back to clients without a refetch loop

## Coding Conventions

- TypeScript-first with strict mode
- Named exports for components
- Server-only code uses `server-only` import and must never touch `NEXT_PUBLIC_*` values
- Tailwind for styling; use existing `components/ui/` primitives
- Commit messages: imperative style with optional `feat:` / `fix:` prefix
- Ensure `pnpm lint` + `pnpm build` pass before PRs
