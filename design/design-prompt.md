Tu dois designer une application web de Planning Poker en temps réel. Voici le périmètre fonctionnel à modéliser (focus prioritaire: page Home et page Game), avec les comportements UI attendus.

Contexte produit
- Application de planning poker sans login traditionnel.
- Accès par jetons (invite/admin/joueur), stockés côté navigateur.
- Mise à jour temps réel de l’état de partie (votes, joueurs, statut, timer).
- Internationalisation FR/EN.
- Thème clair/sombre.
- Navigation desktop/mobile.

Navigation globale
- Header sticky présent sur toutes les pages.
- Header contient: marque, bouton "New" (retour Home), bouton "Join", switch thème.
- Les routes sont localisées (`/en/...` et `/fr/...`).
- Optionnel: gate d’accès global par code (écran d’accès avant Home/Game si activé).

PAGE HOME (écran principal de création)
Objectif utilisateur
- Créer rapidement une session de planning poker.
- Retrouver des sessions récentes depuis ce navigateur.

Structure visuelle Home
- Bloc marketing en haut:
- Eyebrow + titre + description.
- Liste de bénéfices produit (4 items).
- Section fonctionnelle principale en 2 colonnes sur desktop, empilée sur mobile:
- Colonne gauche: carte "Créer une session".
- Colonne droite: carte "Sessions récentes".
- Footer simple avec lien GitHub.

Fonctionnalités Home - Création de session
- Formulaire avec champs:
- Nom de session (obligatoire).
- Nom du créateur (obligatoire).
- Type de cartes (radio):
- Fibonacci
- Fibonacci court
- T-Shirt
- T-Shirt + chiffres
- Personnalisé
- Checkbox: "Autoriser les membres à gérer la session".
- Si type "Personnalisé":
- Afficher 15 mini-inputs (valeurs custom).
- Validation: minimum 2 valeurs non vides.
- Bouton "Créer" avec état loading ("Création...") et désactivation.
- En cas d’erreur de création: message d’erreur inline.
- Au succès:
- Création de la session.
- Sauvegarde locale (historique + infos joueur/session).
- Redirection immédiate vers la page Game.

Détails des decks de cartes à prendre en compte dans le design
- Fibonacci: 0,1,2,3,5,8,13,21,34,55,89,?,Coffee.
- Fibonacci court: 0,½,1,2,3,5,8,13,20,40,100,?,Coffee.
- T-Shirt: XXS,XS,S,M,L,XL,XXL,?,Coffee.
- T-Shirt + chiffres: S,M,L,XL,1,2,3,4,5.
- Personnalisé: valeurs définies par le créateur (jusqu’à 15 entrées).

Fonctionnalités Home - Sessions récentes
- Source: cache local du navigateur.
- Si vide: état empty explicite ("Aucune session récente...").
- Si non vide: tableau scrollable (nom de session + créé par).
- Clic sur une ligne: ouverture de la page Game correspondante.
- Historique limité (dernières sessions).

États UI Home à prévoir
- Chargement initial.
- Formulaire normal.
- Formulaire en soumission.
- Validation erreur (custom < 2).
- Erreur API.
- Historique vide / non vide.
- Responsive mobile (stack vertical) et desktop (2 colonnes).

PAGE GAME (session active)
Objectif utilisateur
- Voter en temps réel.
- Suivre l’avancement du vote.
- Révéler et relancer des rounds.
- Gérer timer, invitations, participants et résultats.

Accès et redirections
- Si utilisateur sans identité locale valide pour cette session: redirection vers Join (pré-remplissage par gameId).
- Si joueur retiré de la session: redirection vers Join.
- États de fallback:
- Chargement (spinner central).
- Erreur de chargement + bouton Retry.
- Session introuvable.

Layout Game
- Bloc principal en 2 zones (desktop) / empilé (mobile):
- Zone contrôleur de partie (gauche).
- Zone liste joueurs (droite).
- Zone basse: sélecteur de cartes (Card Picker).

Rôles et permissions (impact design)
- Modérateur si:
- créateur de session
- OU option "membres autorisés à gérer" activée (donc tous les membres peuvent gérer).
- Actions modérateur:
- Reveal
- Restart
- Delete session
- Gestion timer
- Toggle auto-reveal
- Retirer des joueurs (sauf soi-même)
- Actions visibles pour tous:
- Exit
- Invite (copie lien)

Composant contrôleur de partie
- Header carte:
- Nom session.
- Statut session + icône (Not started / Started / In progress / Finished).
- Timer:
- Peut être masqué/affiché.
- Si masqué et modérateur: état "timer désactivé" + bouton démarrer.
- Si visible:
- Vue joueur standard: lecture seule (temps restant + barre de progression + icône son).
- Vue modérateur: contrôles complets.
- Contrôles timer modérateur:
- Start / Pause
- Close timer
- Reset
- +/- 1 minute
- Édition mm:ss (quand non lancé)
- Toggle son on/off
- Fin de timer:
- Son de notification.
- Arrêt du timer.
- Si auto-reveal désactivé: reveal automatique.
- Toggle Auto-Reveal (modérateur uniquement):
- Si activé, reveal automatique quand tous les joueurs ont voté.
- Boutons d’action session:
- Reveal (manuel)
- Restart (nouveau round)
- Delete (avec confirmation)
- Exit
- Invite (copie lien d’invitation)
- Feedback "lien copié" (toast/notification).
- Effet confetti plein écran sur égalité parfaite (tie) au reveal.

Ligne résultats (dans le contrôleur)
- Visible uniquement quand statut = Finished.
- Tableau résultats:
- Colonne joueur
- Colonne vote révélé
- Gestion des cartes spéciales:
- Coffee (icône)
- ? (icône)
- Moyenne affichée pour decks numériques.
- Pas de moyenne pour modes T-Shirt.

Liste des joueurs
- Titre + compteur de participants.
- Carte joueur:
- Avatar neutre + nom.
- Indicateur de vote (check) avant reveal si joueur a déjà voté.
- Joueurs non votants visuellement atténués pendant round actif.
- Bouton "Remove player" visible seulement pour modérateur autorisé, jamais sur soi-même.

Card Picker (zone de vote)
- Affiche toutes les cartes du deck actif.
- CTA:
- Round actif: "Cliquez sur la carte pour voter".
- Round terminé: état non interactif.
- Interaction vote:
- Sélection visuelle nette de la carte choisie.
- Une carte déjà sélectionnée ne se désélectionne pas au re-clic.
- Votes désactivés quand session terminée.
- En cas d’erreur de vote: message inline.
- Cas spéciaux:
- Carte Coffee
- Carte Question

Cycle de round à modéliser
- Début/round actif: votes possibles.
- Votes en cours: statut "In progress".
- Reveal:
- Manuel via bouton Reveal
- Ou auto-reveal si option active et tous ont voté
- Fin de round: résultats visibles + moyenne si applicable.
- Restart:
- Remise à zéro des votes joueurs.
- Retour état round actif.
- Timer réinitialisé.

États UI Game à couvrir absolument
- Loading global.
- Erreur récupération + Retry.
- Game introuvable.
- Utilisateur non autorisé => redirection Join.
- Vue modérateur vs vue participant.
- Timer masqué / visible / running / paused / terminé.
- Auto-reveal on/off + pending.
- Vote en cours + vote sélectionné + erreur vote.
- Résultats visibles / cachés.
- Toast "invite copied".
- Confirmation suppression session.
- Confetti tie.

Contraintes UX/UI
- Interface claire, utilisable en réunion (lecture rapide).
- Très lisible sur mobile et desktop.
- Feedback immédiat sur chaque action (loading, succès, erreur).
- Design orienté collaboration temps réel.
- Pas de flux login classique dans le parcours Home/Game.
