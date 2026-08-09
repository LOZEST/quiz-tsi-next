# Vérification PR17 — banque NUM de production

## Source et périmètre

- SHA de base : `87aafbe04f9101e320c0833810e1c4c61fdba240`
- Source : `Base_Maitre_Quiz_TSI_Apres_Dunod_Validee.xlsx`
- SHA-256 : `0fd95d6daa672f7ef1381bc452da8c9bc0c90409ffaf87060a65599f5e25a689`
- Feuille importée : `NUM` uniquement
- Lignes structurées : 60
- Acceptées dans le bundle : 60
- Publiées, validées et sélectionnables : 60
- `NUM-F02-P04` : domaine source `a ∈ [2;10]`, espace total 9, espace validé 9/9, recherche exhaustive oui, exception stricte `finite-official-domain` appliquée, aucune modification du contenu source
- Rejetées : 0
- Notions : 4 (`NUM-F01` à `NUM-F04`)
- Difficultés : 20 Fondamentales, 20 Normales, 20 Pièges
- Identifiants et signatures canoniques uniques : 60 / 60
- Tests source présents et marqués OK : 120 / 120

## Compatibilité

Convention conservée pour les banques futures : `static` désigne la banque officielle Quiz TSI (`ownerId: null`), `private` le futur contenu personnel de son auteur et `shared` le futur contenu partagé par son auteur. Les statistiques futures appartiendront à l’utilisateur et ne seront pas stockées directement sur une question ou un pack partagé. PR17 n’implémente aucune fonctionnalité Marketplace.

Opérateurs rencontrés : `=`, `!=`, `<`, `<=`, `>`, `>=`, `and`, `or`, `parity`, addition, soustraction, multiplication, division, modulo et puissance.

Fonctions sûres rencontrées : `abs`, `gcd`, `isSquare`, `squarefree`, `hasPrimeFactorOtherThan2Or5`. Les listes `allowed` sont converties en domaines `choice`. `gcd` et les prédicats entiers sont évalués par des fonctions bornées en liste blanche, sans évaluateur JavaScript générique.

## Reproductibilité

Le bundle `quiz-tsi-official-num-v1` utilise le timestamp déterministe `2026-08-07T00:00:00.000Z`. La commande d’import accepte un autre timestamp explicite via `QTSI_BANK_GENERATED_AT`. Une seconde génération avec la même entrée doit produire zéro différence.

## Validation

- `npm run bank:import:num -- <source>` : succès ; 60 lignes, 4 notions, 60 signatures, 120 statuts de tests OK.
- Deux générations successives : identiques octet pour octet avant formatage (`cmp` = 0).
- `npm run format:check` : succès.
- `npm run lint` : succès.
- `npm run typecheck` : succès.
- `npm run test:coverage` : 33 fichiers et 466 tests réussis ; 88,03 % statements, 81,47 % branches, 86,69 % functions, 90,46 % lines.
- `npm run build` : succès.
- `npm run build:pages` : succès.
- `npm run test:browser` : premier lancement bloqué par le sandbox (`listen EPERM`) ; relance autorisée réussie, 69 tests sur desktop, iPad portrait et iPad paysage.
- `git diff --check` : succès.

L’inspection finale du build normal est exécutée après le build Pages afin de ne pas confondre la composition contrôlée Playwright avec la composition de production.
