# Spécification produit

> **Objectif :** définir exhaustivement le comportement de Quiz TSI Next. **Document normatif.**

## Sommaire
1. [Autorité](#autorité) · 2. [Vision et utilisateurs](#vision-et-utilisateurs) · 3. [Principes UX](#principes-ux-non-négociables) · 4. [Routes](#routes) · 5. [Tableau blanc](#tableau-blanc) · 6. [Parcours](#parcours) · 7. [Évaluation](#correction-et-autoévaluation) · 8. [Autres écrans](#autres-écrans) · 9. [États transverses](#états-transverses)

## Autorité

Ordre normatif : (1) `PRODUCT_SPEC.md` comportement produit ; (2) `USER_FLOWS.md` parcours ; (3) `DESIGN_SYSTEM_SPEC.md` rendu et composants ; (4) `TECHNICAL_ARCHITECTURE.md` architecture ; (5) `DOMAIN_MODEL.md` contrats ; (6) `ACCEPTANCE_MATRIX.md` preuves ; (7) `DEFINITION_OF_DONE.md` fin ; (8) `IMPLEMENTATION_ROADMAP.md` ordre des PR ; (9) `LEGACY_MIGRATION_POLICY.md` récupération ; (10) `LEGACY_INVENTORY.md` constat historique.

En cas de contradiction : ne pas improviser ni choisir silencieusement ; bloquer l'implémentation concernée, créer une modification documentaire dédiée et faire valider la décision avant de coder.

## Vision et utilisateurs

Quiz TSI Next permet à un élève de prépa TSI de recevoir des questions de formule, cours, calcul ou réflexe, les résoudre sur un tableau vectoriel, demander indice et correction raisonnée, s'autoévaluer, réviser quotidiennement ou librement, consolider ses faiblesses, passer des tests, suivre sa progression, gérer une banque, travailler hors connexion, synchroniser plusieurs appareils et administrer selon son rôle. La complexité pédagogique reste derrière une interface simple. Après connexion : **« Je peux commencer à travailler immédiatement. »**, jamais « Je dois comprendre un tableau de bord ».

L'utilisateur principal travaille quotidiennement, surtout sur iPad avec Pencil pour écrire et doigt pour naviguer, parfois sur ordinateur et lors de séances courtes. Il doit toujours comprendre l'action suivante, ne jamais perdre un brouillon, supporter une connexion instable et recevoir un retour précis sans surcharge.

| Rôle | Libellé | Capacités |
|---|---|---|
| `user` | Élève | utiliser les questions, suivre sa progression, gérer ses questions privées |
| `admin` | Administrateur | capacités Élève et gestion des contenus communs selon politiques serveur |
| `owner` | Propriétaire | capacités Administrateur et gestion des comptes/rôles selon politiques serveur |

Aucune permission sensible ne dépend uniquement de l'interface.

## Principes UX non négociables

1. Une page possède une tâche principale.
2. Le tableau blanc est l'accueil après authentification.
3. Peu d'éléments sont affichés par défaut.
4. Les détails secondaires sont révélés après une action volontaire.
5. Toute information affichée aide l'action en cours.
6. Toute interaction visible fonctionne réellement.
7. Aucun bouton factice.
8. Aucun filtre factice.
9. Aucune statistique simulée.
10. Aucun contrôle invisible destiné à empêcher un ancien script de planter.
11. Aucun changement de filtre ne supprime silencieusement un brouillon.
12. L'application fonctionne au doigt et au Pencil.
13. Le rendu est sobre, classique, pur et durable.
14. L'application ne ressemble pas à un dashboard générique.
15. Les erreurs techniques sont traduites en actions compréhensibles.
16. Chargement, vide, erreur et hors connexion sont des états normaux.
17. Une fonctionnalité limitée au cas idéal n'est pas terminée.
18. Aucune fonctionnalité historique utile n'est perdue sans décision explicite.

## Routes

Application React à routage client : `/` redirige vers `/login` sans session et `/whiteboard` avec session valide ou espace hors connexion restauré ; `/login` authentifie ; `/whiteboard` porte question, tableau, parcours, correction et autoévaluation ; `/progress` porte Mon parcours ; `/questions` banque et édition ; `/settings` préférences/données/synchronisation/sauvegardes/hors connexion ; `/account` identité, rôle, session, synchronisation et déconnexion ; `/admin` est visible et accessible seulement selon permissions serveur. Navigation directe, rechargement, PWA, hors connexion et basename GitHub Pages sont obligatoires.

## Tableau blanc

### État normal
Menu fermé, afficher seulement : bouton menu en haut à gauche ; question centrée en haut ; tableau sur presque tout l'écran ; outils Pencil essentiels ; Annuler, Rétablir, Indice, Voir la correction ; Passer ou Question suivante selon l'état ; progression compacte ; chronomètre seulement pour Réflexe.

Ne jamais montrer en permanence maîtrise/confiance/prochaine révision, état technique de synchronisation, statistiques, export/import, administration, configuration Supabase, diagnostic ou navigation complète.

### Carte de question
Centrée sur le viewport entier, en haut après une légère marge de safe area, indépendante du menu et immobile à son ouverture ; compacte, lisible portrait/paysage, réductible sans perte de contenu et non bloquante pour l'écriture. Afficher notion ou chapitre, type, progression, énoncé, et chronomètre Réflexe. ID, version, source technique, maîtrise, confiance et historique sont secondaires.

### Tiroir
Superposé depuis la gauche : il ne redimensionne ni tableau ni question, ne transforme aucune coordonnée, se ferme par bouton/backdrop/Échap, restaure le focus, respecte safe areas, toucher et largeur lisible. Ordre exact : (1) parcours actif ; (2) options dynamiques ; (3) réglages Apple Pencil repliés ; (4) navigation ; (5) carte compte en bas. Navigation : Tableau blanc, Mon parcours, Banque de questions, Réglages. Pas d'export/import, statistiques détaillées, administration complète, diagnostics, Supabase ou gros bouton Déconnexion.

### Moteur vectoriel
Moteur TypeScript Canvas 2D autonome, scène hors cycle React. Stylo/pression, gomme et griffonnage, undo/redo, quadrillage, formes mathématiques avec aperçu, modes droitier/gaucher, sérialisation/restauration, brouillon par question, rotation et redimensionnement sans déformation, tolérance aux scènes partielles et export versionné. Le doigt pilote l'UI ; le Pencil écrit/place. Menu et dialogue ne changent jamais sa taille.

## Parcours

Quatre parcours exacts : `daily` — Révision du jour ; `weak-points` — Consolidation des points faibles ; `free` — Révision libre ; `chapter-test` — Test de chapitres.

### Révision libre
Filtres dans l'ordre : Partie, Chapitre, Notion, Type de question, Difficulté. Types : `formula` Formules, `course` Cours, `calculation` Calcul, `reflex` Réflexe. Difficultés : `fundamental` Fondamental, `standard` Standard, `trap` Piège. Réflexe est un type, jamais une difficulté : difficulté masquée et choisie automatiquement, 60 secondes, dépassement non bloquant et réussite tardive `partial`.

### Changement de configuration
**Cas A, non commencée** (aucun trait, forme, indice ni correction) : appliquer immédiatement, charger automatiquement une compatible, sans confirmation, Question suivante ni rechargement.

**Cas B, commencée** (au moins un trait, forme, indice ou correction) : contrôle interne « Changer de question effacera le travail en cours. » avec actions exactes **Changer maintenant** et **Annuler**. Changer maintenant confirme, puis seulement efface, applique et charge. Annuler conserve question/brouillon et restaure les filtres actifs. Aucune configuration cachée « en attente ».

### Révision du jour
Vue compacte, par exemple `Suites géométriques 2/4`, affichant notion, réussites complètes, quantité prévue, état courant. Détails fermés par défaut : raison, chapitre, dernier test, partiels, échecs, difficulté recommandée, échéance pertinente.

### Points faibles
Vue compacte, par exemple `1 Dérivée d’un quotient — Fondamental`, montrant priorité, notion, difficulté recommandée. Détails volontaires : maîtrise, justification, dernière activité, succès/partiels/échecs, erreurs récurrentes.

### Test de chapitres
Choisir chapitre, 20 ou 40 questions, puis **Commencer le test** ; valeurs réellement transmises. Après démarrage : configuration figée, ordre reproductible, brouillon par question, précédent/suivant, soumission et abandon par dialogues internes, reprise locale, résultats sur versions figées.

## Correction et autoévaluation

Avant correction : Indice, Voir la correction, Passer. Après : Réussi, Raté, Question suivante. Jamais de bouton « Presque réussi ».

- `success` : Réussi sans aide et, pour Réflexe, dans le temps.
- `partial` : Indice puis Réussi, dépassement puis Réussi, ou les deux.
- `failed` : Raté.
- `skipped` : Passer ; aucune conversion en maîtrise sans règle documentaire explicite.

## Autres écrans

### Mon parcours (`/progress`)
Première vue : au plus un indicateur principal, trois secondaires, travail du jour, progression par grandes parties, calendrier, points faibles prioritaires, activité récente. Pas toutes les notions. Au clic : partie, chapitre, notion, historique, maîtrise, prochaines révisions, tests. Graphiques modérés, jamais mosaïque multicolore.

### Banque (`/questions`)
Recherche, filtres, liste, aperçu, création/modification/duplication/publication/archivage ; banques privée/commune ; statiques migrées et paramétrées avec aperçu de variantes ; math sécurisé. États : chargement, liste vide, aucun résultat, réseau, hors connexion, brouillon local, attente, conflit, permission insuffisante, invalide. Jamais HTML distant non sécurisé, `eval` ou `new Function`.

### Réglages (`/settings`)
Apparence, Apple Pencil, Données locales, Synchronisation, Sauvegardes, Hors connexion ; secondaires fermées. Ne pas exposer outbox interne, tokens, URL/clés Supabase, identifiants techniques ou logs complets sans nécessité.

### Compte (`/account`)
Initiale/avatar, nom, email, rôle traduit, connexion, synchronisation, données locales pertinentes, déconnexion. La déconnexion n'est pas proéminente sur le tableau.

### Connexion (`/login`)
Quiz TSI, phrase courte, email, mot de passe, afficher/masquer, Se connecter, erreur compréhensible, chargement et restauration hors connexion autorisée. Pas de hero marketing, carrousel, grande illustration, statistiques publiques, décor excessif ou inscription publique non administrée.

## États transverses

Chaque surface définit nominal, chargement, vide, erreur, hors connexion, reprise et conflit pertinent. Les erreurs proposent une action. Portrait, paysage, safe areas, toucher, Pencil, clavier et lecteur d'écran sont des contextes normaux, jamais des améliorations facultatives.
