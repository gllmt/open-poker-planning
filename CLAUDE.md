# CLAUDE.md

Lire [AGENTS.md](AGENTS.md) pour les commandes, invariants, règles de validation et limites d’autorisation communes à tous les agents. La configuration et le fonctionnement du site sont décrits dans [README.md](README.md). Ne pas maintenir ici une seconde copie de ces instructions.

## Timer Contract

- L’expiration du timer révèle toujours la manche. L’option `autoReveal` peut la terminer plus tôt lorsque tous les joueurs actifs ont voté.
- Le navigateur affiche le compte à rebours ; Convex possède l’échéance, arrête le timer et renseigne `timerCompletedAt`.
- Chaque client connecté avec le son activé réagit une fois à un nouvel événement de fin récent. L’autoplay du navigateur peut empêcher le son.
- Pause, remise à zéro, redémarrage, révélation manuelle, auto-révélation et suppression rendent les anciennes tâches inoffensives grâce à la vérification de `(startedAt, totalSeconds)` et de l’existence de la partie. Ces tâches ne sont ni annulées ni conservées dans le document de partie.
- Les nouveaux payloads du timer sont validés champ par champ. Les formes persistées historiques restent un contrat de compatibilité ; voir [docs/maintenance.md](docs/maintenance.md).
