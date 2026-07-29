# Feuille de route d’implémentation

> **Objectif :** imposer l’ordre et le périmètre des PR0 à PR9. **Document normatif.**

## Sommaire
- [Règle de dépendance](#règle-de-dépendance) · [PR0](#pr0--produit-architecture-et-règles) · [PR1](#pr1--socle-du-projet) · [PR2](#pr2--authentification-et-espace-utilisateur) · [PR3](#pr3--moteur-de-tableau-blanc) · [PR4](#pr4--programme-questions-et-parcours) · [PR5](#pr5--correction-et-tests) · [PR6](#pr6--mon-parcours) · [PR7](#pr7--banque-de-questions) · [PR8](#pr8--réglages-compte-et-administration) · [PR9](#pr9--pwa-migration-et-recette-finale)

## Règle de dépendance

Une PR dépendante ne commence pas avant fusion dans `main` de sa dépendance. Chaque PR reste dédiée ; un hors-périmètre devient une tâche de la PR responsable.

## PR0 — Produit, architecture et règles

- **Objectif :** définir documentation/audit, aucune implémentation.
- **Dépendances :** aucune.
- **Entrées :** mission et README minimal.
- **Sorties :** 11 documents, AGENTS, template, README.
- **Fichiers probables :** Markdown seulement.
- **Historique concerné :** toutes catégories à inventorier.
- **Tests obligatoires :** liens, termes, diff, périmètre.
- **Tests manuels :** revue documentaire.
- **Risques :** audit inaccessible/incohérences.
- **Critères de fusion :** documents validés, draft non fusionnée.
- **Hors périmètre :** tout code/dépendance.

## PR1 — Socle du projet

- **Objectif :** Vite, React, TS strict, routes, dossiers, ESLint/formatage, Vitest/RTL/Playwright, Actions, preview, tokens, fondamentaux, shell vide fonctionnel.
- **Dépendances :** PR0 fusionnée.
- **Entrées :** documents et compatibilités vérifiées.
- **Sorties :** build/test/deploy de shell.
- **Fichiers probables :** configurations, src/app, design-system, tests.
- **Historique concerné :** aucun portage métier.
- **Tests obligatoires :** unitaires composants/routes + build.
- **Tests manuels :** clavier, portrait/paysage, preview.
- **Risques :** versions/GitHub Pages.
- **Critères de fusion :** CI verte, preview, a11y shell.
- **Hors périmètre :** auth et logique métier.

## PR2 — Authentification et espace utilisateur

- **Objectif :** Supabase dev, connexion/session/profils/rôles, repositories, IndexedDB, comptes, offline initial.
- **Dépendances :** PR1 fusionnée.
- **Entrées :** ports domaine et projet Supabase dev.
- **Sorties :** isolation compte et login opérationnels.
- **Fichiers probables :** features/auth, infrastructure DB/Supabase.
- **Historique concerné :** auth/workspace/migrations.
- **Tests obligatoires :** unitaires ports, intégration RLS/isolation.
- **Tests manuels :** login, refus, changement compte, offline.
- **Risques :** RLS/fuite intercompte.
- **Critères de fusion :** tests sécurité et récupération verts.
- **Hors périmètre :** tableau et progression.

## PR3 — Moteur de tableau blanc

- **Objectif :** Canvas autonome, Pencil/pression/gomme/undo/grille/formes/scènes/brouillons/rotation/main.
- **Dépendances :** PR2 fusionnée.
- **Entrées :** contrats scène et repository compte.
- **Sorties :** moteur sérialisable testé navigateur.
- **Fichiers probables :** domain/whiteboard, features, browser tests.
- **Historique concerné :** board/model/shapes/sérialisation.
- **Tests obligatoires :** géométrie, roundtrip, corruption, Playwright.
- **Tests manuels :** iPad Pencil, rotation, gaucher/droitier.
- **Risques :** performance/iOS.
- **Critères de fusion :** scènes sûres et PERF cible validée.
- **Hors périmètre :** questions/parcours.

## PR4 — Programme, questions et parcours

- **Objectif :** programme, statique, générateurs, math, types/difficultés, 4 parcours, filtres immédiats, Réflexe.
- **Dépendances :** PR3 fusionnée.
- **Entrées :** inventaire caractérisé et moteur Canvas.
- **Sorties :** question compatible affichée pour chaque parcours.
- **Fichiers probables :** domain/questions, features/session, import adapters.
- **Historique concerné :** programme/concepts/pièges/générateurs/math/engine.
- **Tests obligatoires :** convertisseurs, sélection déterministe, XSS.
- **Tests manuels :** filtres et protection brouillon.
- **Risques :** qualité données/contenu.
- **Critères de fusion :** SESSION et whiteboard concernés validés.
- **Hors périmètre :** correction/tests.

## PR5 — Correction et tests

- **Objectif :** indices, correction, évaluations, résultats, tests chapitre 20/40, brouillons, soumission.
- **Dépendances :** PR4 fusionnée.
- **Entrées :** questions versionnées et scènes.
- **Sorties :** évaluation append-only et tests figés.
- **Fichiers probables :** features/evaluation, chapter-tests.
- **Historique concerné :** tests chapitre/moteur.
- **Tests obligatoires :** règles résultats, seed, 20/40, reprise.
- **Tests manuels :** dialogues, navigation, abandon/soumission.
- **Risques :** doublons/stock insuffisant.
- **Critères de fusion :** EVALUATION/TEST validés.
- **Hors périmètre :** progression agrégée.

## PR6 — Mon parcours

- **Objectif :** maîtrise, répétition, plan du jour, faibles, calendrier, progression, activité.
- **Dépendances :** PR5 fusionnée.
- **Entrées :** MasteryEvent fiable.
- **Sorties :** synthèse et détails local-first.
- **Fichiers probables :** domain/mastery, features/progress.
- **Historique concerné :** scheduler/mastery/repetition/progress-sync.
- **Tests obligatoires :** algorithmes/dates/agrégats/sync.
- **Tests manuels :** vue synthétique et disclosures.
- **Risques :** biais temporel/explicabilité.
- **Critères de fusion :** PROGRESS et plans validés.
- **Hors périmètre :** éditeur banque.

## PR7 — Banque de questions

- **Objectif :** cache local, recherche/filtres, éditeur/paramétrées, privé/commun, publication, conflits/permissions.
- **Dépendances :** PR6 fusionnée.
- **Entrées :** contrats et RLS disponibles.
- **Sorties :** cycle complet local-first de question.
- **Fichiers probables :** features/questions, adapters Supabase.
- **Historique concerné :** question-bank, générateurs, migrations.
- **Tests obligatoires :** validation, RLS, offline, conflits, contenu sûr.
- **Tests manuels :** tous états, rôles, variantes.
- **Risques :** éditeur/math/conflits.
- **Critères de fusion :** QUESTIONS validés et audit sécurité.
- **Hors périmètre :** admin complet/import-export.

## PR8 — Réglages, compte et administration

- **Objectif :** préférences/Pencil avancé, sync, sauvegardes, import/export, compte/déconnexion/admin.
- **Dépendances :** PR7 fusionnée.
- **Entrées :** repositories et politiques serveur.
- **Sorties :** écrans secondaires et opérations sécurisées.
- **Fichiers probables :** features/settings/account/admin.
- **Historique concerné :** team/workspace/sync.
- **Tests obligatoires :** permissions, backups, roundtrip, comptes.
- **Tests manuels :** sections, logout, owner/admin, restauration.
- **Risques :** opérations sensibles/perte donnée.
- **Critères de fusion :** SETTINGS/ACCOUNT/admin validés.
- **Hors périmètre :** service worker final.

## PR9 — PWA, migration et recette finale

- **Objectif :** SW final, installation/mise à jour, migration historique, perf/a11y, iPad/offline, production.
- **Dépendances :** PR8 fusionnée.
- **Entrées :** application complète et inventaire clos.
- **Sorties :** release candidate installable et migrée.
- **Fichiers probables :** PWA, converters, suites e2e/visual.
- **Historique concerné :** tous éléments classés retenus.
- **Tests obligatoires :** install/update/cache privé/migrations/perf/a11y.
- **Tests manuels :** iPad réel, offline, upgrade, recette.
- **Risques :** cache, migration, régression iOS.
- **Critères de fusion :** matrice validée humainement, production prête.
- **Hors périmètre :** nouvelle fonctionnalité.
