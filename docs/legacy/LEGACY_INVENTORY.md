# Inventaire de l'ancien projet

> **Objectif :** consigner uniquement les éléments réellement observés dans `LOZEST/quizz-prepa`. **Document informatif quant aux constats, normatif quant aux décisions enregistrées.**

## Sommaire
1. [Traçabilité](#traçabilité-de-laudit) · 2. [Résultat](#résultat-de-laudit-pr0) · 3. [Pistes à vérifier](#pistes-à-vérifier) · 4. [Comptage](#comptage-des-décisions)

## Traçabilité de l'audit

Audit tenté le 2026-07-29 depuis le checkout de PR0. Commandes : recherche locale de `quizz-prepa` et `course-map.js`, puis tentative d'accès en lecture à `https://github.com/LOZEST/quizz-prepa`. Aucun checkout historique n'était présent dans `/workspace` ou ailleurs dans le conteneur ; l'accès GitHub a été refusé par le proxy (`CONNECT tunnel failed, response 403`). Par conséquent, l’audit local complet reste impossible et aucun chemin supplémentaire ne peut être déclaré trouvé. La preuve externe fournie dans cette correction établit uniquement `LEGACY-PROGRAM-001` au commit documenté ci-dessous ; aucune autre décision n’est inventée.

Ce constat bloque la clôture de l'audit, pas les décisions produit de PR0. Avant toute PR qui migre l'historique, un checkout lisible et son SHA doivent être fournis ; cette page doit alors être modifiée et validée dans une PR documentaire dédiée conformément à la hiérarchie normative.

## Résultat de l'audit PR0

Aucun élément source n’a pu être caractérisé depuis ce checkout. Il serait faux d’affirmer l’existence, les dépendances ou l’état de fichiers seulement suggérés par le cahier des charges. Une preuve d’audit externe permet toutefois la décision provisoire unique ci-dessous ; toutes les autres classifications restent à zéro.


## Éléments vérifiés par audit externe

- **Source auditée :** `LOZEST/quizz-prepa`.
- **Commit de référence :** `8d0f7082194b0cdcf9c6bb10084361c52b40bd37`.
- **Portée :** preuve externe fournie pour le seul élément ci-dessous ; l'audit complet reste à réaliser et tous les autres éléments sont **À auditer**.

| Champ | Valeur vérifiée |
|---|---|
| Identifiant | `LEGACY-PROGRAM-001` |
| Domaine | Programme pédagogique |
| Chemin historique | `scripts/course-map.js` |
| Responsabilité | Définir la structure Partie, Chapitre et Notion et fournir `allNotions()` et `findNotion()` |
| Dépendances | Module JavaScript historique ; schéma historique à caractériser |
| État apparent | Source utile confirmée extérieurement ; qualité détaillée non auditée dans ce checkout |
| Tests existants | À auditer |
| Dépendance au DOM | Non |
| Dépendance au stockage | Non |
| Dépendance à Supabase | Non |
| Décision provisoire | PORT-WITH-ADAPTER |
| PR cible | PR4 |
| Stratégie de caractérisation | Créer un schéma TypeScript validé, convertir les données, vérifier l'unicité des identifiants et écrire des tests de couverture du programme. Ne pas copier directement le module JavaScript dans le nouveau domaine. |
| Statut | Vérifié extérieurement, caractérisation détaillée à compléter |

Cette décision provisoire ne vaut pas caractérisation complète : PR4 doit relire le chemin au commit indiqué, relever ses imports et tests réels, puis joindre les preuves exigées par la politique de migration.

## Pistes à vérifier

À l’exception de `LEGACY-PROGRAM-001`, ces lignes sont des **pistes non constatées**, restent explicitement **À auditer** et ne reçoivent aucune décision.

| Catégorie à auditer | Chemin indicatif à vérifier | Informations obligatoires lors du constat | PR probable |
|---|---|---|---|
| programme | `scripts/course-map.js` | responsabilité, imports, tests, DOM/stockage/Supabase | PR4 |
| concepts | `data/course-concepts.json` | schéma, couverture, validité, provenance | PR4/PR9 |
| taxonomie des pièges | `data/trap-taxonomy.json` | schéma et usages réels | PR4/PR9 |
| banque statique | `scripts/fixed-questions.js`, `scripts/course-question-bank.js` | contrats, contenu, duplication | PR4 |
| générateurs | `scripts/generators/` | déterminisme, exécution dynamique, tests | PR4 |
| rendu mathématique | `scripts/math/` | parseurs, assainissement, KaTeX/DOM | PR4 |
| moteur de questions | `scripts/quiz-engine.js` | sélection, état, couplages | PR4 |
| planification | `scripts/scheduler.js` | temps, hasard, stockage | PR6 |
| maîtrise | `scripts/mastery/` | événements, agrégats, scores | PR6 |
| répétition espacée | `scripts/repetition/` | algorithme, dates, fuseau | PR6 |
| tests de chapitre | `scripts/tests/` | sélection 20/40, seed, snapshots | PR5 |
| tableau | `scripts/board.js`, `scripts/board-model.js` | Canvas, pointer events, modèle | PR3 |
| formes | `scripts/board-shapes.js` | géométrie et hit-testing | PR3 |
| sérialisation | chemins tableau/workspace à découvrir | version, tolérance, coordonnées | PR3/PR9 |
| authentification | `scripts/auth/` | Supabase, tokens, DOM | PR2 |
| workspace | `scripts/workspace/` | isolation, persistance, UI | PR2 |
| synchronisation | `scripts/progress-sync/` | outbox, conflits, comptes | PR2/PR6 |
| banque Supabase | `scripts/question-bank/` | requêtes, cache, permissions | PR7 |
| migrations | `supabase/migrations/` | tables, RLS, fonctions, ordre | PR2/PR7 |
| administration | `scripts/team/` et chemins à découvrir | rôles, opérations sensibles | PR8 |
| tests | `tests/` | runner, couverture, fixtures | PR concernée |

Lorsqu'un chemin est constaté, ajouter une ligne d'inventaire avec : chemin exact ; responsabilité ; dépendances ; état apparent ; tests ; dépendances DOM, `localStorage`, Supabase ; décision autorisée ; PR cible ; stratégie de caractérisation ; SHA source.

## Comptage des décisions

| Décision | Nombre constaté |
|---|---:|
| PORT | 0 |
| PORT-WITH-ADAPTER | 1 |
| REWRITE | 0 |
| REFERENCE-ONLY | 0 |
| DISCARD | 0 |
