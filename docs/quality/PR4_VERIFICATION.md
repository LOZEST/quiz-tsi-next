# Vérification PR4 — Programme, questions et parcours

> **Statut initial :** table créée avant toute implémentation. Aucun état n'est marqué implémenté sans code et preuve.

| Exigence | Implémentation | Test automatique | Vérification manuelle | État réel | Justification |
|---|---|---|---|---|---|
| `SESSION-005` — filtre Réflexe non applicable | `src/domain/session/Session.ts` | `tests/unit/domain/contracts.test.ts` | À réaliser avec l'interface | partiel | Contrat et validation structurelle implémentés ; interface hors bloc A |
| `SESSION-007` — aucune révision prévue | `src/domain/session/Session.ts` | `tests/unit/domain/contracts.test.ts` | À réaliser avec l'interface | partiel | Union d'état implémentée ; comportement UI hors bloc A |
| `SESSION-008` — révision terminée | `src/domain/session/Session.ts` | `tests/unit/domain/contracts.test.ts` | À réaliser avec l'interface | partiel | Union d'état implémentée ; comportement UI hors bloc A |
| `SESSION-009` — points faibles en calibration | `src/domain/session/Session.ts` | `tests/unit/domain/contracts.test.ts` | À réaliser avec l'interface | partiel | Union et preuves de calibration implémentées ; UI hors bloc A |
| `SESSION-010` — configuration du futur test | `src/domain/session/Session.ts` | `tests/unit/domain/contracts.test.ts` | À réaliser avec l'interface | partiel | Configuration et cohérence du stock implémentées ; passation réservée à PR5 |
| `IMPORT-007` — aucune banque validée | À créer | À créer | À réaliser | partiel | Message et comportement documentaire définis |
| Programme versionné et validé | `src/domain/program/Program.ts` | `tests/unit/domain/program.test.ts` | Revue de la fixture locale et des frontières | implémenté | Validation complète depuis `unknown`, identifiants techniques stricts déjà normalisés, libellés visibles trimés, erreurs cumulées et précisément localisées, copie normalisée profondément figée, source intacte, entrées exotiques protégées et index déterministe `order` puis `id` |
| Parser mathématique v1 sécurisé | `src/domain/math/MathAst.ts`, `MathSyntaxRegistry.ts`, `MathTokenizer.ts`, `MathParser.ts`, `MathParseError.ts` | `tests/unit/domain/math-registry.test.ts`, `math-tokenizer.test.ts`, `math-parser.test.ts` | Revue du domaine pur et des messages ; aucun rendu concerné | implémenté | Registre V1, tokenizer et parser déterministes bornés, AST distinct, erreurs pédagogiques et références `@nom` extraites ; aucun rendu ni contrôle croisé du bloc D |
| Génération déterministe par seed | `src/domain/questions/Question.ts` pour les contrats | `tests/unit/domain/contracts.test.ts` | À réaliser au bloc D | partiel | Instance et seed contractuelles ; aucun générateur avant le bloc D |
| Propriété des questions selon leur source | `src/domain/questions/Question.ts` | `tests/unit/domain/contracts.test.ts` | Revue des trois variantes `static`, `private`, `shared` | implémenté | `static` impose `null` ; `private` et `shared` imposent un identifiant d'auteur non vide |
| Provenance structurelle des questions | `src/domain/questions/Question.ts` | `tests/unit/domain/contracts.test.ts` | Revue d'une provenance valide et de formes rejetées | implémenté | Bundle, timestamp UTC, tableau et références sont validés sans compléter les données absentes |
| Valeurs primitives d'une instance figée | `src/domain/questions/Question.ts` | `tests/unit/domain/contracts.test.ts` | Revue de l'absence de mutation de la source | implémenté | L'entrée racine inconnue est gardée ; `parameterValues` est un record plat à prototype standard ou nul contenant seulement chaîne, booléen ou nombre fini ; le snapshot exact est copié puis gelé profondément sans modifier la source |
| AST structurel sûr et borné | `src/domain/questions/Question.ts` | `tests/unit/domain/contracts.test.ts` | Revue des limites exportées et des arités | implémenté | Parcours itératif limité à 32 niveaux, 256 nœuds et 32 éléments par liste ; références de contraintes publiées contrôlées |
| Références `@nom` dans le contenu | Extraction de formule dans `src/domain/math/MathParser.ts` ; contrôle croisé à créer au bloc D | Extraction et déduplication dans `tests/unit/domain/math-parser.test.ts` ; validation globale à créer au bloc D | À réaliser avec l'instanciation | partiel | Bloc C extrait les références de chaque formule ; le contrôle sur tous les segments et les définitions reste explicitement au bloc D |
| Import versionné, idempotent et traçable | À créer | À créer | À réaliser | partiel | Contrats définis ; fixtures de test uniquement |
| Banque historique de production | Aucun | Sans objet avant validation | Revue licence/provenance requise | bloqué | Licence, droits, provenance et conversions non validés |
| Sélection et filtres dépendants | À créer | À créer | À réaliser | partiel | Contrats documentaires existants |
| Instance liée au brouillon Canvas | À créer | À créer | À réaliser | partiel | PR3 utilise encore la scène globale `main` |
| Réflexe 60 secondes | À créer | À créer | À réaliser | partiel | Évaluation du dépassement réservée à PR5 |
| Algorithmes `daily` et `weak-points` | Aucun en PR4 | Sans objet PR4 | Sans objet PR4 | hors périmètre | Calculs définitifs attribués à PR6 |
| Démarrage et blueprint `chapter-test` | Aucun en PR4 | Sans objet PR4 | Sans objet PR4 | hors périmètre | Passation intégralement attribuée à PR5 |

## Banque attendue

Sans banque validée, l'application doit afficher : « Aucune banque de questions validée n’est disponible pour le moment. »

Le fichier attendu est un bundle conforme à `QuestionBankBundle`, avec version de schéma, identifiant de bundle, date de génération, provenance fournie sans invention et entrées de questions conformes aux contrats du domaine. Toute source historique LaTeX ou HTML nécessite en plus son format source original, un convertisseur versionné, un rapport et une quarantaine vérifiable.

## Portes de validation

Après chaque bloc : `npm run format:check`, `npm run lint`, `npm run typecheck` et tests unitaires concernés. L'interface ne commence qu'après validation du programme, des questions, de la sélection, du parser et de la reproductibilité des instances.

## Bloc B — Programme complet et validation

- Périmètre : validation et normalisation du seul `Program`, puis abstraction de lecture `ProgramIndex`.
- Données : fixture minimale locale aux tests ; aucun programme ou contenu historique ajouté au bundle de production.
- Frontières : aucune option générale de filtre dans le programme ; aucune dépendance React, DOM, IndexedDB ou Supabase ; blocs C et suivants non commencés.
- Normalisation : les identifiants `id`, `partId` et `chapterId` sont stricts et doivent être déjà normalisés ; tout espace extérieur est refusé sur le chemin exact. Les libellés visibles sont trimés et leur source reste intacte.
- Preuves automatiques : `tests/unit/domain/program.test.ts` couvre les identifiants et références parentes avec espaces extérieurs, les libellés trimés, les relations Partie → Chapitre → Notion, les doublons, les champs et ordres invalides, les erreurs multiples, les entrées exotiques/cycliques, la suppression des propriétés étrangères, l'immuabilité profonde et le tri stable de l'index.
- Vérification manuelle : revue du diff et de la fixture ; aucune interface n'est concernée par ce bloc de domaine pur.

### Résultats du 30 juillet 2026

| Vérification | Résultat |
|---|---|
| `npm run format:check` | réussi |
| `npm run lint` | réussi |
| `npm run typecheck` | réussi |
| `npm run test:coverage` | 143 tests réussis ; instructions 90,33 %, branches 86,43 %, fonctions 87,77 %, lignes 93,67 % |
| `npm run build` | réussi |
| `npm run build:pages` | réussi |
| `npm run test:browser` | 48 tests réussis sur desktop, iPad portrait et iPad paysage |
| `git diff --check` | réussi |

## Bloc C — Registre et analyseur MathSource V1

- Périmètre : registre versionné des commandes et symboles, tokenizer, parser V1, AST mathématique contrôlé, erreurs structurées et extraction dédupliquée des références paramétrées.
- Fichiers de domaine : `MathAst.ts`, `MathParseError.ts`, `MathParser.ts`, `MathSyntaxRegistry.ts` et `MathTokenizer.ts`. `MathSource.ts` reste l'unique contrat persistant et n'est pas remplacé.
- Séparation des arbres : `MathAstNode` représente exclusivement les formules affichées ; `SafeExpressionNode` reste réservé aux contraintes logiques et n'est ni réutilisé ni modifié.
- Registre : version exacte 1, identifiants stables, huit commandes réservées (`sqrt`, `abs`, `vec`, `sin`, `cos`, `tan`, `ln`, `exp`) et symboles Unicode normatifs. Le tokenizer lit les ensembles de symboles depuis ce registre et le parser ne reconnaît aucune fonction absente du registre.
- Grammaire couverte : nombres entiers et décimaux point/virgule ; identifiants latins/grecs sans `_` ; variables `@nom` avec `_` ; multiplication explicite ; priorités ; fractions non ambiguës ; indices avant puissances ; huit fonctions ; six comparaisons et leurs équivalents Unicode ; relations et appartenance ; constante `π` distincte de `pi` ; intervalles ; sommes, produits et intégrales bornés.
- Erreurs : résultat discriminé sans exception utilisateur, source originale conservée, code et offsets stables, message pédagogique et exemple correctif lorsque pertinent. Sont notamment couverts la multiplication implicite, la division ambiguë, les parenthèses de fonction, la casse des commandes, les intervalles invalides, les caractères inconnus et les limites dépassées.
- Limites de sécurité exportées : 2 048 caractères, 512 tokens, profondeur 32 et 256 nœuds. La limite de liste de 32 est réservée aux constructions V1 à liste ; aucune construction multiargument non normative n'est acceptée.
- Dépendances : domaine pur sans React, DOM, KaTeX, Supabase, IndexedDB ni réseau ; aucune exécution dynamique, interprétation HTML ou persistance de rendu.
- Tests ciblés : 96 tests réussis dans `math-registry.test.ts`, `math-tokenizer.test.ts` et `math-parser.test.ts`, couvrant notamment la règle définitive `_` (`x_n` est un indice, `@coefficient_1` est une variable paramétrée).
- Hors périmètre confirmé : aucun adapter KaTeX, rendu React, éditeur, contrôle des références contre les définitions, génération de variables, import, filtre, parcours, bloc D ou travail PR5.

### Résultats du 3 août 2026

| Vérification | Résultat |
|---|---|
| Tests Vitest mathématiques ciblés | 96 tests réussis |
| `npm run format:check` | réussi après application du formatage |
| `npm run lint` | réussi |
| `npm run typecheck` | réussi |
| `npm run test:coverage` | 248 tests réussis ; instructions 91,29 %, branches 86,49 %, fonctions 89,75 %, lignes 94,28 % ; domaine math : instructions 94,98 %, branches 87,43 %, fonctions 100 %, lignes 97,29 % |
| `npm run build` | réussi |
| `npm run build:pages` | réussi |
| `npm run test:browser` | 48 tests réussis sur desktop, iPad portrait et iPad paysage après autorisation du serveur local |
| `git diff --check` | réussi après mise à jour documentaire finale |

La prévisualisation technique est prouvée par les deux builds et le serveur Playwright. Aucune interface mathématique ou validation manuelle de rendu n'est déclarée : elles sont hors bloc C.

### Durcissement de la normalisation — 2 août 2026

| Vérification | Résultat |
|---|---|
| `npm test -- tests/unit/domain/program.test.ts` | 31 tests ciblés réussis |
| `npm run format:check` | réussi |
| `npm run lint` | réussi |
| `npm run typecheck` | réussi |
| `npm run test:coverage` | 152 tests réussis ; instructions 90,46 %, branches 86,39 %, fonctions 88 %, lignes 93,59 % |
| `npm run build` | réussi |
| `npm run build:pages` | réussi |
| `npm run test:browser` | 48 tests réussis sur desktop, iPad portrait et iPad paysage après autorisation du serveur local |
| `git diff --check` | réussi |
