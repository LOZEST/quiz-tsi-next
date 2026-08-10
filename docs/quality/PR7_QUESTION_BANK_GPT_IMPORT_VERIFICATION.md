# Vérification PR7 — Banque de questions et import ChatGPT

Date : 2026-08-10
Base imposée : `95bac133f8d98adcc926d91af4568225d1426a5a`

## Périmètre vérifié

- Banque officielle et personnelle, recherche et filtres combinés.
- Création locale structurée, brouillons, relecture, partage et archivage.
- Cache IndexedDB partitionné, outbox, synchronisation bornée et conflits explicites.
- Taxonomie officielle distincte de la taxonomie personnelle.
- Contrat d’import ChatGPT v1, validation, quarantaine, idempotence et couverture d’analyse.
- OAuth Supabase, fonction Edge sans clé ni appel OpenAI, migration et politiques RLS.
- Artefacts de configuration du GPT et export canonique du programme officiel.

## Résultats automatisés

| Contrôle | Résultat |
| --- | --- |
| `npm run format:check` | Réussi |
| `npm run lint` | Réussi |
| `npm run typecheck` | Réussi |
| `npm run test:coverage` | Réussi — 49 fichiers, 553 tests ; statements 84,57 %, branches 80,02 %, functions 81,99 %, lines 87,10 % |
| `npm run build` | Réussi |
| `npm run build:pages` | Réussi |
| `npm run test:browser` | Réussi — 87 scénarios desktop, iPad portrait et iPad paysage |
| `git diff --check` | Réussi |
| `npm run test:rls` | Non exécuté : aucune base Supabase/Postgres locale joignable |

La migration et le fichier pgTAP RLS sont livrés, mais leur exécution doit être reprise dans un environnement Supabase local actif ou en CI. Cette absence de preuve d’exécution est déclarée et n’est pas remplacée par une validation simulée.

## Vérifications manuelles

- Prévisualisation locale inspectée dans le navigateur intégré : banque, filtres, liste et aperçu cohérents avec le design system.
- Le défaut d’interaction détecté sur iPad portrait a été corrigé ; le scénario ciblé puis la suite multi-viewport complète passent.
- Aucun média source de cours n’est envoyé au backend : le GPT analyse les médias dans ChatGPT et transmet uniquement le JSON structuré.
- Aucun secret, package OpenAI ou appel à `api.openai.com` n’est présent dans l’application ou la fonction Edge.

## Point de reprise

Avant fusion, exécuter `npm run test:rls` avec Supabase local démarré et joindre le résultat pgTAP à la PR.
