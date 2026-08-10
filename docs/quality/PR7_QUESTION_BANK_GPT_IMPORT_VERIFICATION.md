# Vérification PR7 — Banque de questions et import ChatGPT

Date : 2026-08-10
Base imposée : `95bac133f8d98adcc926d91af4568225d1426a5a`

## Périmètre vérifié

- Banque officielle et personnelle, recherche et filtres combinés.
- Création locale structurée, brouillons, relecture, partage et archivage.
- Variables integer/decimal/choice, contraintes visuelles allowlistées et aperçu de dix variantes réelles.
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
| `npm run test:coverage` | Réussi — 51 fichiers, 559 tests ; statements 84,55 %, branches 80,04 %, functions 81,23 %, lines 87,01 % |
| `npm run build` | Réussi |
| `npm run build:pages` | Réussi |
| `npm run test:browser` | Réussi — 87 scénarios desktop, iPad portrait et iPad paysage |
| `git diff --check` | Réussi |
| `npm run test:rls` | Tenté localement, bloqué avant exécution : daemon Docker absent (`~/.docker/run/docker.sock`) |

La migration et les tests pgTAP comportementaux A/B sont livrés. La CI démarre désormais Supabase puis exécute obligatoirement `test:rls`. L’absence de preuve locale est déclarée et n’est pas remplacée par une validation simulée.

## Vérifications manuelles

- Prévisualisation locale inspectée dans le navigateur intégré : banque, filtres, liste et aperçu cohérents avec le design system.
- Le défaut d’interaction détecté sur iPad portrait a été corrigé ; le scénario ciblé puis la suite multi-viewport complète passent.
- Aucun média source de cours n’est envoyé au backend : le GPT analyse les médias dans ChatGPT et transmet uniquement le JSON structuré.
- Aucun secret, package OpenAI ou appel à `api.openai.com` n’est présent dans l’application ou la fonction Edge.
- Le test GPT/OAuth de bout en bout avec deux vrais comptes reste manuel et en attente.

## Point de reprise

Avant fusion, la CI de la PR doit exécuter pgTAP avec succès. Le test GPT/OAuth manuel à deux comptes reste à consigner.
