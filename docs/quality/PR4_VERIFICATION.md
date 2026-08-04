# Vérification PR4 — Programme, questions et parcours

> **Statut initial :** table créée avant toute implémentation. Aucun état n'est marqué implémenté sans code et preuve.

## Lot accéléré — banque et sélection déterministe (4 août 2026)

- **Périmètre :** frontière `unknown` de `QuestionBankBundle`, import initial pur,
  quarantaine bornée, ports de repositories, adapter mémoire, index, filtres
  dépendants, sélection de Révision libre et préparation des variantes. Aucune UI,
  passation PR5 ou logique pédagogique PR6 n'est incluse.
- **Bundle :** schéma V1, `bundleId` normalisé, date UTC, provenance résolue,
  questions structurellement et sémantiquement validées, cohérence complète avec
  `ProgramIndex`, limite de 10 000 entrées, copie indépendante profondément figée.
  Getters, Proxy, cycles, prototypes exotiques, symboles et valeurs non finies
  produisent un diagnostic contrôlé.
- **Import :** statuts normatifs `accepted`, `updated`, `ignored`, `rejected` et
  `quarantined`. Même id/version/contenu est ignoré idempotemment ; une version
  supérieure remplace ; une version inférieure est rejetée ; un conflit de contenu
  à version égale est mis en quarantaine. La quarantaine conserve uniquement une
  chaîne JSON sûre limitée à 2 048 caractères. L'état final est validé intégralement
  avant tout remplacement du repository.
- **Repository et index :** le port ne dépend d'aucune infrastructure. L'adapter
  mémoire copie ses entrées et sorties, expose des snapshots figés, remplace la
  banque en une seule affectation et ordonne par id/version. L'index déduplique et
  filtre partie, chapitre, notion, type, difficulté, source et statut ;
  `not-applicable` sélectionne exclusivement Réflexe.
- **Filtres :** aucune sentinelle `all` n'entre dans le programme. Les sélections
  discriminées existantes sont normalisées et les enfants incompatibles reviennent
  à `{ kind: "all" }`. `ProgramIndex` expose désormais les chapitres et notions
  canoniques nécessaires aux listes globales.
- **Sélection et préparation :** uniquement les dernières versions publiées et
  validées, ordre canonique puis mélange `xmur3-mulberry32` V1, sans temps système
  ni `Math.random`, quantité maximale exportée de 1 000 et exclusions sans doublon.
  Une seed d'instance combine seed de séance, id, version et position. Une question
  statique reçoit `{}` ; une paramétrée réutilise le générateur et l'instanciation du
  bloc D. Aucun `QuestionInstance` ou `FrozenQuestionInstance` n'est créé.
- **États explicites :** `no-bank` emploie le message normatif, puis
  `invalid-config`, `no-match`, `insufficient-stock`, `repository-error` et
  `question-preparation-error` couvrent les autres sorties sans stack trace.
- **Données :** seules des fixtures entièrement nouvelles existent dans les tests.
  Aucune banque historique ou question de production n'est ajoutée.
- **Hors périmètre :** UI React, IndexedDB/Supabase, import avancé PR7, rendu KaTeX,
  session/test PR5, progression et algorithmes PR6.

### Résultats du lot banque et sélection — 4 août 2026

| Vérification | Résultat |
|---|---|
| Tests ciblés banque/sélection | 1 fichier, 14 tests réussis |
| Tests ciblés avec Programme | 2 fichiers, 45 tests réussis |
| `npm run format:check` | réussi |
| `npm run lint` | réussi ; avertissement informatif ESLint sur les projets TypeScript multiples |
| `npm run typecheck` | réussi |
| `npm run test:coverage` | 27 fichiers, 364 tests réussis ; instructions 89,00 %, branches 81,33 %, fonctions 89,66 %, lignes 91,63 % |
| `npm run build` | réussi ; 141 modules transformés |
| `npm run build:pages` | réussi ; 141 modules transformés et fallback Pages généré |
| `npm run test:browser` | 48 tests réussis sur desktop, iPad portrait et iPad paysage |
| Validation YAML des workflows | `ci.yml` et `deploy-pages.yml` valides |
| `git diff --check` | réussi |

### Durcissement des frontières d’import — 4 août 2026

- **Doublons avant import :** l’enveloppe et la longueur réelle de `questions`
  sont contrôlées avant toute comparaison avec la banque installée. Toutes les
  occurrences sûres sont inspectées ; deux entrées partageant `question.id`, y
  compris avec des versions différentes, rendent le bundle ambigu. Le résultat
  global est `rejected`, les diagnostics citent les deux chemins et le repository
  reste intact. Aucune `Map` ne réduit silencieusement les entrées du bundle.
- **Quarantaine ciblée :** l’enveloppe et le tableau sont lus sans évaluer les
  entrées. Chaque entrée reçoit ensuite son propre snapshot. Un getter ou Proxy
  hostile devient un résultat `quarantined` portant son `entryIndex`, tandis que
  les autres entrées continuent d’être validées et importées. Aucune référence
  hostile n’est conservée.
- **SafeSnapshot borné :** limites exportées de 10 000 éléments par tableau,
  10 000 caractères par chaîne, 100 000 caractères cumulés, 50 000 nœuds et 64
  niveaux. Les tableaux creux, propriétés personnalisées, accesseurs d’indices,
  symboles, longueurs excessives et prototypes exotiques sont refusés. Les indices
  d’un tableau dense sont copiés sans réindexation.
- **Index indépendant :** chaque question est snapshotée puis validée avant gel.
  Le constructeur ne gèle jamais la question ni les contenus sources. Les
  mutations ultérieures de la source n’affectent pas l’index. `query(unknown)`
  accepte uniquement un objet simple, à prototype standard ou nul, et refuse les
  propriétés étrangères, classes, dates, getters, Proxy et symboles.
- **Preuves complémentaires :** préparation paramétrée reproductible, changement
  de seed, exclusions, `no-match`, combinaison complète des axes d’index,
  distinction `all`/`not-applicable`, `repository.query`, rapport mixte, erreur de
  validation finale atomique, absence de mutation des sources et immuabilité
  profonde des résultats.

| Vérification | Résultat |
|---|---|
| Tests ciblés du durcissement | 2 fichiers, 45 tests réussis |
| `npm run test:coverage` | 28 fichiers, 395 tests réussis ; instructions 89,61 %, branches 82,29 %, fonctions 90,92 %, lignes 92,52 % |

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

## Bloc D — Génération paramétrée et instanciation

- Périmètre : PRNG pur, domaines finis, évaluation de `SafeExpressionNode`, recherche exhaustive ou bornée, variantes distinctes, références et instanciation des textes et AST mathématiques. Aucun travail du bloc E, de PR5, de rendu ou d'interface.
- Modules : `SeededRandom.ts`, `VariableDomain.ts`, `SafeExpressionEvaluator.ts`, `ParameterizedQuestionGenerator.ts`, `ParameterReferenceScanner.ts`, `QuestionInstantiation.ts` et `QuestionParameterValidation.ts`.
- PRNG : `xmur3-mulberry32` v1, seed textuelle obligatoire, xmur3 pour l'état initial puis Mulberry32 en entiers 32 bits. Aucun temps, environnement ou hasard système.
- Domaines : entier inclusif par `step` et exclusions ; choix conservé dans son ordre avec déduplication stricte typée. Pour un décimal, `Number.prototype.toString()` fournit la représentation canonique, y compris exponentielle ; elle est convertie en fraction décimale `BigInt`, puis mise à l'échelle exactement. Les minimums utilisent le plafond rationnel, les maximums le plancher rationnel et les exclusions l'arrondi au plus proche avec égalité vers `+∞`, comme `Math.round`. Aucun `ceil(value * scale)`, `floor(value * scale)` ni epsilon arbitraire n'est utilisé. Tout entier mis à l'échelle hors `[-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]` est refusé. `-0` est normalisé. Les sources ne sont pas modifiées.
- Évaluateur : `validateSafeExpression` valide d'abord sous `try/catch` chaque nœud, opérateur, fonction, arité et limite. L'évaluation utilise ensuite des `switch` en liste blanche dont chaque défaut produit une erreur contrôlée, sans repli vers un opérateur existant. La table de paramètres doit être un objet simple à prototype standard ou nul, sans symbole ni accesseur, contenant uniquement des primitives finies ; elle est copiée et figée avant évaluation. Les nombres ne subissent aucune coercition, l'égalité reste stricte et chaque contrainte racine doit valoir exactement `true`.
- Limites exportées : 32 variables, 10 000 valeurs par domaine, 8 décimales, 100 000 combinaisons exhaustives, 20 000 tentatives bornées et 1 000 variantes demandées.
- États : `ready`, `invalid-question`, `impossible`, `insufficient-distinct-variants`, `search-limit-exceeded` et `invalid-evaluation`. La frontière `unknown` réutilise `validateParameterizedQuestionSpec` avant toute génération. Seule l'exploration complète autorise `impossible` ou l'insuffisance démontrée ; une recherche bornée inconclusive retourne `search-limit-exceeded`.
- Références : scanner textuel avec offsets et grammaire `@nom`, parser du bloc C pour les formules, chemins de segments précis, références de contraintes incluses, inconnues bloquantes et définitions inutilisées en avertissement.
- Statistiques : `searchMode` indique si l'espace est `exhaustive-capable` ou impose une recherche `bounded`. `searchCompleted` et son alias de compatibilité `exhaustive` valent `true` uniquement lorsque toutes les combinaisons ont réellement été examinées. `validCombinations` compte seulement les combinaisons valides effectivement examinées et n'est donc jamais présenté comme un total après arrêt anticipé.
- Instanciation : remplacement des seuls spans reconnus dans les textes ; remplacement des nœuds `parameter` dans une copie de l'AST par des nœuds `resolved-parameter` conservant nom et primitive. `MathSource` originale reste intacte ; aucun HTML, LaTeX ou JavaScript n'est produit ou interprété. Chaque résultat `ready`, statique ou paramétré, est profondément figé jusqu'aux diagnostics, variants, objets variants, paramètres, contenus, références et statistiques, sans modifier ni geler la question source.
- Tests ciblés après durcissement : sept fichiers et 83 tests réussis.
- Dépendances : domaine pur ; aucun import React, React DOM, KaTeX, Supabase, IndexedDB, DOM ou réseau.
- Hors périmètre : bloc E, sélection/parcours, import, banque de production, interface d'édition et PR5 non commencés.

### Résultats du 4 août 2026

| Vérification | Résultat |
|---|---|
| Tests Vitest ciblés du bloc D | 7 fichiers, 83 tests réussis |
| `npm run format:check` | réussi |
| `npm run lint` | réussi ; avertissement informatif ESLint sur les projets TypeScript multiples |
| `npm run typecheck` | réussi |
| `npm run test:coverage` | 26 fichiers, 350 tests réussis ; instructions 89,84 %, branches 83,87 %, fonctions 90,12 %, lignes 92,71 % ; domaine questions : instructions 87,19 %, branches 82,24 %, fonctions 91,39 %, lignes 89,57 % |
| `npm run build` | réussi ; 141 modules transformés |
| `npm run build:pages` | réussi ; 141 modules transformés et fallback Pages généré |
| `npm run test:browser` | 48 tests réussis sur desktop, iPad portrait et iPad paysage |
| Recherche des dépendances interdites dans les nouveaux modules | aucune occurrence |
| `git diff --check` | réussi |

Les deux messages jsdom relatifs à `HTMLCanvasElement.getContext()` pendant la couverture sont attendus dans les tests existants et n'ont provoqué aucun échec. La prévisualisation est prouvée par les deux builds et le serveur Playwright ; aucune nouvelle interface ni recette visuelle du bloc D n'est concernée.

### Durcissement de la frontière publique — 3 août 2026

- `parseMathSource(value: unknown)` valide désormais toute la racine sous `try/catch` avant de lire ou conserver une propriété externe.
- Seuls les objets simples à prototype standard ou nul, possédant exactement `syntaxVersion: number` et `source: string`, produisent une copie sûre. Les valeurs nulles, tableaux, objets exotiques, racines cycliques, propriétés manquantes, mauvais types, getters et Proxy hostiles retournent `invalid-math-source` sans exception ni détail interne.
- Le contrat d'échec porte `source: MathSourceSnapshot | null` : une paire numérique/textuelle sûre conserve exactement la source, notamment pour une version non prise en charge ou une syntaxe invalide ; une racine non fiable produit `null`. Aucun objet externe hostile n'est conservé.
- `parseMathSourceText` reste le helper textuel et n'utilise plus de cast vers `MathSource`.
- `tokenizeMathSource(value: unknown)`, API exportée du domaine, refuse aussi toute entrée non textuelle avec `invalid-tokenizer-source`.
- Tests ajoutés : neuf racines invalides usuelles, quatre objets hostiles, objet à prototype nul valide, racine cyclique, immutabilité, conservation exacte de source, absence de stack ou message interne, helper textuel et entrées tokenizer non-string.
- Hors périmètre inchangé : aucun travail du bloc D, rendu, interface, import, parcours ou PR5.

| Vérification | Résultat |
|---|---|
| Tests Vitest mathématiques ciblés | 115 tests réussis |
| `npm run format:check` | réussi |
| `npm run lint` | réussi |
| `npm run typecheck` | réussi |
| `npm run test:coverage` | 267 tests réussis ; instructions 91,43 %, branches 86,75 %, fonctions 89,81 %, lignes 94,37 % ; domaine math : instructions 95,36 %, branches 88,64 %, fonctions 100 %, lignes 97,50 % |
| `npm run build` | réussi |
| `npm run build:pages` | réussi |
| `npm run test:browser` | 48 tests réussis sur desktop, iPad portrait et iPad paysage après autorisation du serveur local |
| `git diff --check` | réussi après la mise à jour documentaire finale |

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
