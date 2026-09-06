# Maintenance and retained contracts

The September 2026 cleanup removes unused UI, assets and translations without changing persisted legacy data or public compatibility surfaces.

## Legacy data (audit D03)

New writes validate card decks and timer fields before persistence. The schema deliberately still accepts historical card/timer shapes; narrowing it without examining the target database could block deployment or discard useful state.

Known compatibility paths:

- `timerProps.currentSeconds` and `timerPaused` are the old elapsed-time format. A moderator migrates them through the validated timer mutation; viewers never write the migration.
- Missing `players.membershipStatus` means active. Explicit left/removed memberships retain their existing meaning.
- Games with no invitation rows can use the legacy `joinTokenHash`, subject to the new 30-day invitation expiry. Once invitation rows exist, revocation/expiry must never reactivate that fallback.
- `storyName`, card `color`, and vote `emoji` remain persisted contracts, even where the current UI does not expose every field.
- The unused session GET and the optional caller/player fields of `deleteGame` remain compatible with older clients and already-open tabs. Deletion is still authorized only by the admin hash.

Before a schema migration, export a representative target database to a protected local folder. Report aggregate counts only: missing/unknown membership and status values, legacy timer fields, malformed cards/timers, invalid timestamps, expired games, and games exceeding 50 player or 100 invitation rows. Do not print token hashes or commit exports. Choose a conversion for each observed shape, test it on a copy, then migrate and narrow the schema in that order. The disposable local validation database is not evidence about production's historical population.

## Retention deployment

The daily cron is active once the Convex changes are deployed. It uses `games.updatedAt`, deletes eligible games and their children atomically, and chains batches of 10. Review target volumes, old row budgets and a backup before the first production deployment. Stale timer jobs are safe after deletion.

An open tab alone is not activity. A gameplay, membership or invitation mutation renews the inactivity deadline. Recent-game entries use the browser's last visit; this is separate from server retention. Unknown-age legacy cache entries are kept until the next visit timestamps them.

## Verification

`pnpm lints`, `pnpm test` and `pnpm build` cover formatting, lint, types, behavioral React tests, route contracts, Convex transitions and the production bundle. Convex's own config is checked with `tsc --noEmit -p convex/tsconfig.json`.

For synchronization changes, use a disposable Convex deployment and two independent browser sessions. Verify vote masking before reveal, rapid votes, reset, auto-reveal, participant changes, timer edits acknowledged before a later remote change, pause/resume and server completion. Same-browser tabs using distinct local origins can validate independent cookies/storage and identities; this does not replace cross-browser compatibility testing.
