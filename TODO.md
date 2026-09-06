# TODO

## Audit du 6 septembre 2026

- [x] Couvrir les contrats Route Handlers et les transitions d’auto-révélation / réadhésion.
- [x] Tester les votes rapides, les rejets et les pushes distants avec React ; supprimer les snapshots de rollback manuels.
- [x] Réutiliser le préchargement serveur et les mises à jour optimistes Convex pour reveal/reset/timer/autoReveal.
- [x] Afficher les échecs des commandes de jeu et borner / acquitter les brouillons du timer.
- [x] Rendre les parties récentes accessibles au clavier et corriger le préremplissage des noms.
- [x] Définir et implémenter la rétention de 30 jours ainsi que l’expiration des invitations.
- [x] Retirer les reliquats sans consommateur et corriger les instructions d’agents.
- [ ] Inventorier les formes et volumes de la base cible avant de resserrer le schéma historique ; étapes dans `docs/maintenance.md`.
- [ ] Mettre en place un limiteur distribué avant toute ouverture publique sans code d’accès.

Les contrôles automatisés sont dans `components/poker/*.test.*`, `components/poker/timer/*.test.tsx`, `tests/` et `convex/games.test.ts`. Le rollback doit exposer la donnée serveur la plus récente, y compris les changements distants reçus pendant la commande.
