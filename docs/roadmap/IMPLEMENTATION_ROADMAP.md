# Feuille de route d’implémentation

> **Objectif :** imposer l’ordre et le périmètre des PR0 à PR9, incluant PR0.1, PR0.2 et PR1.1. **Document normatif.**

## Sommaire
- [Règle de dépendance](#règle-de-dépendance) · [PR0](#pr0--produit-architecture-et-règles) · [PR0.1](#pr01--expérience-utilisateur-et-création-de-questions) · [PR0.2](#pr02--finalisation-des-contrats) · [PR1](#pr1--socle-du-projet) · [PR1.1](#pr11--clarification-authentification-compte-et-administration) · [PR2](#pr2--authentification-et-espace-utilisateur) · [PR3](#pr3--moteur-manuscrit-du-tableau-blanc) · [PR4](#pr4--programme-questions-et-parcours) · [PR5](#pr5--correction-et-tests) · [PR6](#pr6--advanced-whiteboard-tools-et-mon-parcours) · [PR7](#pr7--banque-de-questions) · [PR8](#pr8--réglages-compte-et-administration) · [PR9](#pr9--pwa-migration-et-recette-finale)

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

## PR0.1 — Expérience utilisateur et création de questions

- **État :** fusionnée.
- **Objectif :**
  - définir l'expérience visuelle ;
  - définir le langage mathématique simplifié ;
  - définir le **Clavier mathématique** ;
  - définir l'assistant de variables ;
  - définir les filtres Tout ;
  - aucune implémentation.
- **Dépendances :** PR0 fusionnée.
- **Sorties :** contrats UX et de création de questions documentés.
- **Hors périmètre :** toute implémentation.

## PR0.2 — Finalisation des contrats

- **Objectif :**
  - supprimer les ambiguïtés restantes ;
  - fixer la grammaire mathématique version 1 ;
  - fixer les transitions des filtres ;
  - fixer la provenance des questions ;
  - harmoniser le tiroir du tableau ;
  - compléter les critères d'acceptation ;
  - aucune implémentation.
- **Dépendances :** PR0.1 fusionnée.
- **Sorties :** documentation complète et non ambiguë avant PR1.
- **Critères de fusion :** cohérence documentaire validée ; aucun code ; aucune dépendance ; aucun contrat restant volontairement ambigu pour PR1, PR3, PR4 ou PR7.
- **Hors périmètre :** toute implémentation et tout démarrage de PR1.

## PR1 — Socle du projet

- **Objectif :** socle, routes, design tokens et composants génériques : Vite, React, TS strict, dossiers, ESLint/formatage, Vitest/RTL/Playwright, Actions et preview. Aucun éditeur de questions ni parser mathématique métier.
- **Dépendances :** PR0, PR0.1 et PR0.2 fusionnées. Aucune PR de code ne peut commencer avant fusion de PR0.2.
- **Entrées :** documents et compatibilités vérifiées.
- **Sorties :** build/test/deploy de shell.
- **Fichiers probables :** configurations, src/app, design-system, tests.
- **Historique concerné :** aucun portage métier.
- **Tests obligatoires :** unitaires composants/routes + build.
- **Tests manuels :** clavier, portrait/paysage, preview.
- **Risques :** versions/GitHub Pages.
- **Critères de fusion :** CI verte, preview, a11y shell.
- **Hors périmètre :** auth et logique métier.

## PR1.1 — Clarification authentification, compte et administration

- **Objectif :** clarifier les frontières de PR2 et PR8, aucune implémentation.
- **Dépendances :** PR1 fusionnée.
- **Sorties :** contrats documentaires cohérents pour l'authentification, la page compte minimale, la déconnexion, le placeholder protégé et l'administration complète.
- **Critères de fusion :** cohérence documentaire validée ; aucun code ; aucune dépendance.
- **Hors périmètre :** tout démarrage de PR2.

## PR2 — Authentification et espace utilisateur

- **Objectif :** Supabase dev ; connexion email et mot de passe ; restauration et expiration de session ; déconnexion réelle ; profil minimal ; lecture des rôles `user`, `admin` et `owner` ; page compte minimale ; carte compte compacte dans le tiroir ; protection des routes privées ; placeholder `/admin` protégé avec état d'accès refusé ; repositories et IndexedDB isolés par compte ; offline initial.
- **Dépendances :** PR1.1 fusionnée.
- **Entrées :** ports domaine et projet Supabase dev.
- **Sorties :** isolation compte, authentification, déconnexion, page compte minimale et contrôle d'accès aux routes opérationnels.
- **Fichiers probables :** features/auth/account, routes, infrastructure DB/Supabase.
- **Historique concerné :** auth/workspace/migrations.
- **Tests obligatoires :** unitaires ports/rôles/routes, intégration RLS/isolation et routage Playwright.
- **Tests manuels :** login, déconnexion, refus, changement compte, offline et accès `/admin` avec les trois rôles.
- **Risques :** RLS/fuite intercompte.
- **Critères de fusion :** tests sécurité et récupération verts.
- **Hors périmètre :** tableau et progression ; gestion complète du compte ; réglages complets ; gestion des appareils ; import/export ; gestion administrative ; modification des rôles ; action sensible ; interface d'administration complète.

## PR3 — Moteur manuscrit du tableau blanc

- **Objectif :** moteur manuscrit uniquement : Canvas 2D natif autonome, Apple Pencil, pression, inclinaison, stylo, gomme, grille, undo/redo, scènes versionnées, persistance locale isolée, brouillons et toolbar minimale ; question centrée, tiroir superposé sans changement de coordonnées et responsive portrait/paysage.
- **Dépendances :** PR2 fusionnée.
- **Entrées :** contrats scène et repository compte.
- **Sorties :** moteur manuscrit sérialisable testé navigateur.
- **Fichiers probables :** domain/whiteboard, features, browser tests.
- **Historique concerné :** board/model/sérialisation manuscrite ; les formes historiques restent réservées à PR6.
- **Tests obligatoires :** capture pression/inclinaison, traits et gomme, undo/redo, sérialisation/restauration des traits, migrations idempotentes, isolation de la persistance locale, corruption, Playwright.
- **Tests manuels :** iPad Pencil, rotation, gaucher/droitier.
- **Risques :** performance/iOS.
- **Critères de fusion :** scènes manuscrites sûres et PERF cible validée.
- **Hors périmètre :** questions/parcours ; formes géométriques ; lignes ; rectangles ; cercles ; flèches ; objets vectoriels ; sélection, déplacement ou redimensionnement d'objets.

## PR4 — Programme, questions et parcours

- **Objectif :** programme, options Tout et filtres dépendants, moteur de sélection, registre du langage mathématique, parser sécurisé, rendu des questions, variables déjà instanciées, types/difficultés, quatre parcours et Réflexe ; import initial des banques validées lorsqu’elles seront disponibles. Pour `daily` et `weak-points`, PR4 consomme uniquement des états réels fournis et affiche honnêtement absence, fin, calibration ou indisponibilité ; les algorithmes pédagogiques restent en PR6. Pour `chapter-test`, PR4 configure chapitre et quantité et valide le stock sans démarrer de passation ni créer de blueprint.
- **Dépendances :** PR3 fusionnée.
- **Entrées :** inventaire caractérisé et moteur Canvas.
- **Sorties :** question compatible affichée uniquement lorsqu'un parcours possède un état `ready` et des données validées ; sinon état explicite sans ancienne question ni instance. Configuration de test validée sans démarrage.
- **Fichiers probables :** domain/questions, features/session, import adapters.
- **Historique concerné :** programme/concepts/pièges/générateurs/math/engine, uniquement après caractérisation. La banque historique auditée reste bloquée pour la production jusqu'à validation complète de licence, droits, provenance et conversions.
- **Tests obligatoires :** convertisseurs, seed et contenu déterministes, domaines/contraintes, configurations impossibles, dix variantes avant publication, AST en liste blanche, XSS ; import initial versionné, validé, idempotent, traçable, avec rapport, quarantaine et conservation des entrées valides.
- **Tests manuels :** filtres et protection brouillon.
- **Risques :** qualité données/contenu.
- **Critères de fusion :** SESSION et whiteboard concernés validés.
- **Hors périmètre :** correction et passation de tests ; `ChapterTestBlueprint`, seed, ordre, instances, navigation et brouillons de test ; algorithmes définitifs de maîtrise, confiance, répétition, planification et classement des points faibles ; import en production de la banque historique non validée.

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

PR5 commence la passation de `chapter-test` à partir de la configuration validée par PR4. Elle seule crée et persiste `ChapterTestBlueprint`, seed, ordre, versions, instances et brouillons, puis fournit navigation, reprise, correction, autoévaluation, soumission, abandon et résultats.

## PR6 — Advanced Whiteboard Tools et Mon parcours

- **Objectif :** formes géométriques, lignes, rectangles, cercles, flèches et autres objets vectoriels ; sélection, déplacement et redimensionnement d'objets ; maîtrise, répétition, plan du jour, faibles, calendrier, progression et activité.
- **Précision parcours :** PR6 implémente les algorithmes définitifs qui produisent `DailyPlanState` et `WeakPointsState` : maîtrise, confiance, répétition espacée, échéances, planification du jour, classement, erreurs récurrentes et difficulté recommandée dérivée.
- **Dépendances :** PR5 fusionnée.
- **Entrées :** moteur manuscrit et scènes versionnées de PR3 ; MasteryEvent fiable.
- **Sorties :** outils vectoriels avancés compatibles avec les scènes PR3 ; synthèse et détails local-first.
- **Fichiers probables :** domain/whiteboard, features/whiteboard, domain/mastery, features/progress.
- **Historique concerné :** board-shapes/géométries ; scheduler/mastery/repetition/progress-sync.
- **Tests obligatoires :** géométrie et round-trip par forme, sélection/déplacement/redimensionnement, migration et compatibilité des scènes PR3 ; algorithmes/dates/agrégats/sync.
- **Tests manuels :** outils vectoriels sur iPad, vue synthétique et disclosures.
- **Risques :** géométrie/compatibilité des scènes ; biais temporel/explicabilité.
- **Critères de fusion :** outils vectoriels, PROGRESS et plans validés.
- **Hors périmètre :** éditeur banque.

## PR7 — Banque de questions

- **Objectif :** cache local, recherche/filtres, éditeur texte/formules, Clavier mathématique, panneau Raccourcis, assistant de variables, constructeur de contraintes, aperçu de variantes, tutoriel, création/modification/publication, import avancé et rapports, privé/commun, conflits/permissions.
- **Dépendances :** PR6 fusionnée.
- **Entrées :** contrats et RLS disponibles.
- **Sorties :** cycle complet local-first de question.
- **Fichiers probables :** features/questions, adapters Supabase.
- **Historique concerné :** question-bank, générateurs, migrations.
- **Tests obligatoires :** validation, RLS, offline, conflits, contenu sûr et rapport avancé par question.
- **Tests manuels :** tous états, rôles, variantes.
- **Risques :** éditeur/math/conflits.
- **Critères de fusion :** QUESTIONS validés et audit sécurité.
- **Hors périmètre :** admin complet/import-export.

## PR8 — Réglages, compte et administration

- **Objectif :** enrichir `/account` ; édition des informations autorisées ; réglages généraux et Pencil ; sauvegarde ; import/export ; synchronisation détaillée ; données locales et appareils ; gestion avancée hors connexion ; administration complète ; gestion des contenus selon le rôle ; gestion des comptes et rôles selon les permissions serveur ; actions sensibles et refus serveur ; interface complète pour `admin` et `owner`. PR8 ne réimplémente pas l'authentification ni la déconnexion de base fournies par PR2.
- **Dépendances :** PR7 fusionnée.
- **Entrées :** repositories et politiques serveur.
- **Sorties :** page Compte complète, réglages complets, interface d'administration complète et opérations sécurisées.
- **Fichiers probables :** features/settings/account/admin.
- **Historique concerné :** team/workspace/sync.
- **Tests obligatoires :** permissions, backups, roundtrip, comptes.
- **Tests manuels :** sections, compte enrichi, owner/admin, refus serveur et restauration.
- **Risques :** opérations sensibles/perte donnée.
- **Critères de fusion :** SETTINGS/ACCOUNT/admin validés.
- **Hors périmètre :** authentification, déconnexion de base et service worker final.

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
