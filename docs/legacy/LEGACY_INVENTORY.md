# Inventaire de l'ancien projet

> **Objectif :** consigner uniquement les éléments réellement observés dans `LOZEST/quizz-prepa`. **Document informatif quant aux constats, normatif quant aux décisions enregistrées.**

## Sommaire
1. [Traçabilité](#traçabilité-de-laudit) · 2. [Résultat](#résultat-de-laudit-pr0) · 3. [Pistes à vérifier](#pistes-à-vérifier) · 4. [Comptage](#comptage-des-décisions)

## Traçabilité de l'audit

Audit initial tenté le 2026-07-29 depuis le checkout de PR0 sans accès au dépôt historique. Audit PR4 repris le 2026-07-30 depuis un checkout temporaire en lecture de `LOZEST/quizz-prepa` au SHA `8d0f7082194b0cdcf9c6bb10084361c52b40bd37`. Les chemins PR4 ci-dessous ont été constatés ; aucun code historique n'est copié dans le nouveau dépôt.

## Résultat de l'audit PR0

Le programme historique contient 6 parties, 16 chapitres et 71 notions. Les banques constatées exposent 426 questions de cours et 433 questions fixes agrégées. Elles utilisent des contrats JavaScript historiques, des niveaux numériques, du LaTeX persistant et des fragments HTML convertis par compatibilité. Les générateurs utilisent notamment `Math.random`. La licence, les droits de modification et redistribution et la provenance par question ne sont pas suffisamment établis.

La banque historique est donc `BLOCKED` pour toute importation en production. Elle reste une source de caractérisation en lecture. PR4 peut construire et tester l'importer générique avec des fixtures minimales exclusivement dans les tests.


## Programme vérifié

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
| Décision provisoire | PORT-WITH-ADAPTER pour le programme uniquement |
| PR cible | PR4 |
| Stratégie de caractérisation | Créer un schéma TypeScript validé, convertir les données, vérifier l'unicité des identifiants et écrire des tests de couverture du programme. Ne pas copier directement le module JavaScript dans le nouveau domaine. |
| Statut | Constaté au SHA indiqué ; validation pédagogique et provenance encore requises avant conversion de production |

Cette décision ne permet pas d'importer automatiquement le programme ou la banque : toute donnée produite doit encore passer par un convertisseur versionné, une validation et un rapport de provenance.

## Éléments PR4 constatés le 2026-07-30

| Identifiant | Chemin historique | Constat | Décision | Statut |
|---|---|---|---|---|
| `LEGACY-QUESTIONS-001` | `scripts/fixed-questions.js`, `scripts/course-question-bank.js` | 426 questions de cours et 433 questions fixes agrégées ; LaTeX et compatibilité HTML ; provenance et licence insuffisantes | REFERENCE-ONLY jusqu'à validation complète, puis décision documentaire dédiée | BLOCKED pour la production |
| `LEGACY-GENERATORS-001` | `scripts/generator-utils.js`, `scripts/generators/` | neuf familles constatées ; hasard implicite et contrats incompatibles avec les seeds PR4 | REWRITE depuis règles et tests de caractérisation | BLOCKED comme source de production |
| `LEGACY-MATH-001` | `scripts/math/`, `scripts/question-bank/domain-parser.js`, `scripts/question-bank/expression-engine.js` | rendu KaTeX sûr partiel et AST historique, mais langage différent de la grammaire normative PR4 | REFERENCE-ONLY | Constaté |
| `LEGACY-ENGINE-001` | `scripts/quiz-engine.js` | sélection historique couplée aux niveaux et banques anciennes | REWRITE | Constaté |
| `LEGACY-DATA-001` | `data/course-concepts.json`, `data/trap-taxonomy.json`, `data/trap-sources.json` | structure réelle ; aucune source externe enregistrée pour les pièges ; provenance incomplète | REFERENCE-ONLY | BLOCKED pour la production |

## Pistes restantes à vérifier

Les éléments PR4 constatés ci-dessus ne sont plus des pistes. Les lignes restantes sont des **pistes non constatées**, restent explicitement **À auditer** et ne reçoivent aucune décision.

| Catégorie à auditer | Chemin indicatif à vérifier | Informations obligatoires lors du constat | PR probable |
|---|---|---|---|
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
| REWRITE | 2 |
| REFERENCE-ONLY | 3 |
| DISCARD | 0 |
