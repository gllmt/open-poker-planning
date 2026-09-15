# Guide du dépôt

Répondre en français. Respecter le périmètre demandé : audit des sources en lecture seule ; corrections locales et validation lorsqu’elles sont demandées.

## Repères

- `app/` : pages Next et Route Handlers ; `components/poker/` : interface métier ; `components/ui/` : primitives ; `lib/` : helpers ; `convex/` : données et autorisations. Ne pas modifier à la main `convex/_generated/`.
- Installation et configuration : `README.md` ; versions : `package.json` et `mise.toml`. Compléter `.env.local` selon le README sans écraser les variables générées par Convex ni afficher les secrets.
- Pour le timer, lire « Timer Contract » dans `CLAUDE.md`. Avant un audit ou un refactor du contrôleur, consulter `TODO.md` et les décisions de `plans/README.md`, puis vérifier leur validité sur le code actuel. Charger les plans détaillés concernés seulement.

## Commandes

- Installer : `pnpm install` ; développement Next : `pnpm dev` ; serveur de production local : `pnpm start`.
- Formatage, lint et types : `pnpm lints` ; tests : `pnpm test` ; build : `pnpm build`. `pnpm lint` exécute Oxlint ; `pnpm format` applique Oxfmt et trie les imports.
- `pnpm lint:ui` limite Oxlint à `app/` et `components/`. `@shadcn/lint` est aussi chargé par le lint global de `pnpm lints`. Les six règles shadcn et les contrôles Oxlint fondés sur les types sont actifs. Respecter les contrats et exceptions documentés dans `docs/design-rules.md`.
- Tests Convex : fixtures en mémoire. Vérifications interactives : instance de développement et données jetables.

## Invariants à préserver

- Convex est la source de vérité et vérifie droits et adhésion active. Route Handlers pour cookies et génération de jetons ; mutations Convex directes pour les actions de jeu.
- Jetons bruts admin/joueur en cookies HttpOnly ; leurs hashes servent de bearer credentials côté client. Ne pas mettre ces hashes en stockage navigateur, journaux ou réponses JSON des Route Handlers. Le token d’invitation suit son flux dédié.
- Avant révélation, chaque joueur ne reçoit que son vote en clair. Préserver le masquage dans les queries et le préchargement serveur.
- Le serveur possède l’échéance du timer ; l’expiration révèle toujours, indépendamment d’`autoReveal`. Préserver les gardes des tâches obsolètes et `timerCompletedAt`.
- `server-only` protège les modules Next manipulant des secrets ; il ne s’impose pas aux helpers purs ni au runtime Convex. `NEXT_PUBLIC_*` désigne une valeur publique, également lisible côté serveur.
- Le limiteur en mémoire protège une instance ; un limiteur distribué est nécessaire avant de retirer la barrière d’accès privée.

## Changements et validation

- TypeScript strict, primitives UI existantes, exports nommés lorsque le framework le permet ; dictionnaires FR/EN cohérents.
- Justifier un refactor par son gain et son risque, pas seulement par un score ou une taille de composant. Caractériser les transitions optimistes et le timer avant modification : votes rapides, rollback, pushes distants et droits.
- Avant une PR de code : `pnpm lints`, `pnpm test`, `pnpm build`. Adapter les contrôles aux changements documentaires et éviter les répétitions sans nouvelle incertitude.
- Valider les changements de synchronisation entre deux navigateurs avec Convex en développement ; signaler si ce contrôle reste à faire.
- Terminer le travail local autorisé avec ses vérifications. Un audit n’autorise pas à lui seul commit, push ou déploiement. Rapporter le résultat, les contrôles exécutés et leurs limites ; décrire les PR par le problème et le comportement obtenu.

## Serveurs de développement sur cette machine

- Utiliser Portly (`portly ...`) pour démarrer, arrêter, redémarrer et inspecter les serveurs persistants. Commencer par `portly status` et réutiliser une instance saine ; inspecter un serveur non géré avant toute reprise en charge.
- Créer un projet Portly pour un usage durable. Pour les tests, builds, génération de code et aperçus temporaires : `portly temp '<commande>' --path <dossier> --timeout 30m`, puis `portly wait <id>`.
- Ne pas démarrer un serveur persistant directement, en arrière-plan ou avec un autre superviseur.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
