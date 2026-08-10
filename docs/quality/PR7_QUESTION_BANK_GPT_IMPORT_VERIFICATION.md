# Vérification PR7 — Banque de questions et import ChatGPT

Date : 2026-08-10
Base imposée : `95bac133f8d98adcc926d91af4568225d1426a5a`

## Périmètre vérifié

- Banque officielle et personnelle, recherche et filtres combinés.
- Création locale structurée, brouillons, relecture, partage et archivage.
- Variables integer/decimal/choice, contraintes visuelles allowlistées et aperçu de dix variantes réelles.
- Cache IndexedDB partitionné, outbox, synchronisation bornée et conflits explicites.
- Historique physique append-only, projection de la dernière version et sauvegarde atomique question/taxonomie personnelle.
- Publication commune réservée aux rôles `admin`/`owner`, classifications officielles vérifiées et retrait effectif lorsqu’une dernière version est archivée.
- Import GPT strict et borné, scope OAuth standard `email` limité à l’identité, retries question/taxonomie idempotents.
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
| `npm run test:coverage` | Réussi — 52 fichiers, 584 tests ; statements 85,49 %, branches 80,21 %, functions 83,77 %, lines 88,15 % |
| `npm run build` | Réussi |
| `npm run build:pages` | Réussi |
| `npm run test:browser` | Réussi — 87 scénarios desktop, iPad portrait et iPad paysage |
| `git diff --check` | Réussi |
| `npm run test:rls` | Réussi en CI — 32 assertions comportementales PR7 multi-compte et 9 assertions profils |
| GitHub Actions `quality` (`ae9aefb`) | Réussi — run `31433020229` |

La migration et les tests pgTAP comportementaux A/B sont livrés. La CI démarre Supabase puis exécute obligatoirement `test:rls`. L’exécution locale a été tentée mais reste indisponible faute de daemon Docker (`~/.docker/run/docker.sock`) ; la preuve CI réelle n’est pas remplacée par une validation simulée.

## Vérifications manuelles

- Prévisualisation locale inspectée dans le navigateur intégré : banque, filtres, liste et aperçu cohérents avec le design system.
- Le défaut d’interaction détecté sur iPad portrait a été corrigé ; le scénario ciblé puis la suite multi-viewport complète passent.
- Aucun média source de cours n’est envoyé au backend : le GPT analyse les médias dans ChatGPT et transmet uniquement le JSON structuré.
- Aucun secret, package OpenAI ou appel à `api.openai.com` n’est présent dans l’application ou la fonction Edge.
- Le test GPT/OAuth de bout en bout avec deux vrais comptes reste manuel et en attente.

## Point de reprise

La CI obligatoire, y compris pgTAP, est verte. Le test GPT/OAuth manuel à deux comptes reste à consigner avant de considérer cette vérification manuelle comme acquise.
