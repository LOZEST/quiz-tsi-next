# Modèle de domaine

> **Objectif :** fixer les contrats métier indépendants de React, du DOM et de Supabase. **Document normatif.** Le pseudo-TypeScript n'est pas une implémentation.

## Sommaire
1. [Vocabulaires](#vocabulaires) · 2. [Contenu](#contenu) · 3. [Sessions](#sessions) · 4. [Tableau](#tableau) · 5. [Progression](#progression) · 6. [Compte et synchronisation](#compte-et-synchronisation) · 7. [Invariants](#invariants)

## Vocabulaires

```ts
type UserRole = "user" | "admin" | "owner";
type QuestionType = "formula" | "course" | "calculation" | "reflex";
type Difficulty = "fundamental" | "standard" | "trap";
type SessionMode = "daily" | "weak-points" | "free" | "chapter-test";
type EvaluationResult = "success" | "partial" | "failed" | "skipped";
type ContentSegment =
  | { kind: "text"; value: string }
  | { kind: "inline-math"; math: MathSource }
  | { kind: "display-math"; math: MathSource }
  | { kind: "line-break" };
```

Libellés : `user` Élève, `admin` Administrateur, `owner` Propriétaire ; `formula` Formules, `course` Cours, `calculation` Calcul, `reflex` Réflexe ; `fundamental` Fondamental, `standard` Standard, `trap` Piège ; `daily` Révision du jour, `weak-points` Consolidation des points faibles, `free` Révision libre, `chapter-test` Test de chapitres.

## Contenu

### Questions paramétrées

```ts
type ParameterPrimitive = string | number | boolean;
type VariableKind = "integer" | "decimal" | "choice";

interface IntegerVariableDomain {
  kind: "integer";
  minimum: number;
  maximum: number;
  step: number;
  excludedValues: number[];
}
interface DecimalVariableDomain {
  kind: "decimal";
  minimum: number;
  maximum: number;
  decimals: number;
  excludedValues: number[];
}
interface ChoiceVariableDomain {
  kind: "choice";
  values: ParameterPrimitive[];
}
type VariableDomain =
  | IntegerVariableDomain
  | DecimalVariableDomain
  | ChoiceVariableDomain;
interface VariableDefinition {
  id: string;
  label: string;
  domain: VariableDomain;
}
interface DerivedVariableDefinition {
  id: string;
  label: string;
  expression: SafeExpressionNode;
}

type SafeExpressionNode =
  | { kind: "literal"; value: ParameterPrimitive }
  | { kind: "variable"; variableId: string }
  | { kind: "unary"; operator: "negate" | "absolute"; operand: SafeExpressionNode }
  | { kind: "binary"; operator: "add" | "subtract" | "multiply" | "divide" | "modulo" | "power"; left: SafeExpressionNode; right: SafeExpressionNode }
  | { kind: "comparison"; operator: "equal" | "not-equal" | "less-than" | "less-than-or-equal" | "greater-than" | "greater-than-or-equal"; left: SafeExpressionNode; right: SafeExpressionNode }
  | { kind: "math-function"; function: "abs" | "sqrt" | "min" | "max" | "round" | "floor" | "ceil" | "gcd" | "lcm" | "sign" | "cos" | "binomial" | "is-integer" | "numeric-value" | "is-square" | "squarefree" | "has-prime-factor-other-than-2-or-5"; arguments: SafeExpressionNode[] }
  | { kind: "logical"; operator: "and" | "or"; operands: SafeExpressionNode[] }
  | { kind: "logical-not"; operand: SafeExpressionNode };

interface ParameterizedQuestionSpec {
  schemaVersion: number;
  variables: VariableDefinition[];
  derivedVariables?: DerivedVariableDefinition[];
  constraints: SafeExpressionNode[];
  validationVariantCount: number;
}
```

`SafeExpressionNode` est un AST interprété en liste blanche. Il n'autorise ni `eval`, ni `new Function`, ni JavaScript arbitraire, ni accès au DOM, au réseau ou au stockage. Les opérateurs et fonctions non énumérés sont invalides. Sa validation est bornée à une profondeur de 32, 256 nœuds et 32 arguments ou opérandes par liste. `abs`, `sqrt`, `round`, `floor`, `ceil`, `sign`, `cos`, `is-integer`, `numeric-value`, `is-square`, `squarefree` et `has-prime-factor-other-than-2-or-5` acceptent exactement un argument ; `gcd`, `lcm` et `binomial` en acceptent deux ; `min` et `max` en acceptent au moins deux ; `and` et `or` ont au moins deux opérandes. Les variables dérivées sont évaluées séquentiellement dans l'ordre déclaré, avant les contraintes ; chacune ne peut référencer que les variables déjà définies.

### Question et instance

```ts
interface CorrectionStep { id: string; title: string | null; content: ContentSegment[]; }
type QuestionClassification =
  | { kind: "official"; partId: string; chapterId: string; notionId: string }
  | { kind: "personal"; courseId: string; chapterId: string | null; notionId: string | null };
interface Question {
  id: string; version: number; source: "static" | "private" | "shared";
  ownerId: string | null; status: "draft" | "published" | "archived";
  provenance: QuestionProvenance | null;
  classification: QuestionClassification;
  type: QuestionType; difficulty: Difficulty | null;
  parameterization: ParameterizedQuestionSpec | null;
  prompt: ContentSegment[]; hint: ContentSegment[]; correction: CorrectionStep[];
  tags: string[]; validated: boolean; createdAt: string; updatedAt: string;
}
interface QuestionInstance {
  id: string; questionId: string; questionVersion: number; sessionId: string;
  ordinal: number; frozenQuestion: Question;
  parameterValues: Record<string, ParameterPrimitive>; seed: string;
  createdAt: string;
}
interface FrozenQuestionInstance extends QuestionInstance { contentHash: string; }
interface PersonalCourse { id: string; ownerId: string; title: string; createdAt: string; updatedAt: string; }
interface PersonalChapter { id: string; ownerId: string; courseId: string; title: string; createdAt: string; updatedAt: string; }
interface PersonalNotion { id: string; ownerId: string; courseId: string; chapterId: string | null; title: string; createdAt: string; updatedAt: string; }
```

Invariant de propriété selon `source` :

- `static` : `ownerId === null` ;
- `private` : `ownerId` est l'identifiant non vide de son auteur ;
- `shared` : `ownerId` est l'identifiant non vide de son auteur. Le partage
  modifie la visibilité de la question, pas son attribution.

Une question privée ou partagée sans auteur connu n'est pas complétée avec une
valeur inventée : elle est invalide.

Le contenu distant est constitué de segments, jamais de HTML arbitraire. `MathSource` est la seule source persistée d'une formule. Le langage mathématique simplifié est analysé de façon contrôlée ; le LaTeX éventuellement généré pour KaTeX reste un résultat temporaire de l'adapter, et ni ce LaTeX ni le HTML KaTeX ne sont persistés comme source de vérité. Une question publiée est validée. `difficulty` vaut `null` pour `reflex`.

`ProgramIndex` reste exclusivement la taxonomie officielle. Le cours personnel est obligatoire ; son chapitre et sa notion sont facultatifs. Les identifiants personnels sont générés par Quiz TSI et isolés par `ownerId`. Une migration idempotente transforme les anciens triplets `partId/chapterId/notionId` en classification `official`; les instances historiques figées restent restaurables. Une évaluation personnelle conserve sa classification, mais PR7 ne l'agrège pas dans une notion officielle.

L'import ChatGPT V1 est une exception `remote-origin` au local-first initial : GPT → Edge Function sous identité OAuth utilisateur et RLS → brouillon distant privé → pull borné → IndexedDB. L'entrée est validée depuis `unknown`, confirmée, bornée et idempotente par `(userId, client_id, importId)` et hash canonique. Le serveur dérive `ownerId`, `partId` officiel, dates, source, statut et validation. Il force `private`, `draft`, `validated=false`; conserve les entrées valides, met les invalides en quarantaine et produit un rapport. Après arrivée locale, toute édition repasse par IndexedDB et l'outbox.

Une migration convertit tout ancien contenu persistant du LaTeX vers un `MathSource` contrôlé ou le met en quarantaine. Aucun contenu invalide n'est interprété silencieusement. L'auteur ne saisit et ne voit jamais directement du LaTeX.

`parameterization` vaut `null` pour une question non paramétrée. Avant publication d'une question paramétrée, `validationVariantCount` vaut au minimum 10 et autant de variantes valides sont contrôlées. Une question officielle `static`, publiée et validée peut déclarer un compteur inférieur à 10 uniquement si une recherche exhaustive prouve que son espace valide fini contient exactement ce nombre de variantes ; elles sont alors toutes contrôlées. Cette exception est interdite aux sources `private` et `shared` et ne peut jamais être déduite d'une recherche bornée. Toutes les valeurs générées satisfont leur domaine et toutes les contraintes. Une seed identique produit les mêmes valeurs et le même contenu. Une combinaison impossible produit une erreur explicite ; aucune variante invalide n'est publiée silencieusement.

Pour le bloc D de PR4, le hasard déterministe est versionné `xmur3-mulberry32` v1 : la seed textuelle est condensée par xmur3, puis la séquence est produite par Mulberry32 en arithmétique entière 32 bits. Les limites V1 sont 32 variables, 10 000 valeurs matérialisées par domaine, 8 décimales, des entiers décimaux mis à l'échelle bornés aux entiers sûrs JavaScript, 100 000 combinaisons pour une recherche exhaustive, 20 000 tentatives déterministes hors seuil et 1 000 variantes demandées. La quantification décimale convertit la représentation canonique, y compris exponentielle, en fraction `BigInt` : plafond exact pour le minimum, plancher exact pour le maximum et plus proche avec égalité vers `+∞` pour les exclusions. Une recherche bornée qui n'atteint pas la quantité demandée retourne `search-limit-exceeded` et ne conclut jamais à l'impossibilité. `searchCompleted` et `exhaustive` ne valent vrai que si toutes les combinaisons ont réellement été examinées ; `validCombinations` ne compte que les combinaisons examinées. Une paramétrisation sans variable est invalide ; une question sans paramétrisation reste statique et utilise une table de paramètres vide. Toute sortie `ready` de validation est une copie profondément immuable sans geler la question source.

## Sessions

```ts
type SessionConfig =
  | { mode: "daily" }
  | { mode: "weak-points" }
  | { mode: "free"; filters: FreeRevisionFilters }
  | { mode: "chapter-test"; chapterId: string; questionCount: 20 | 40 };
interface ChapterTestBlueprint {
  id: string; seed: string; chapterId: string; questionCount: 20 | 40;
  createdAt: string; questions: FrozenQuestionInstance[];
}
interface DailyPlanItem {
  notionId: string; plannedCount: number; successCount: number;
  partialCount: number; failedCount: number; reason: string;
  recommendedDifficulty: Difficulty; dueAt: string | null;
}
interface WeakPointItem {
  notionId: string; priority: number; recommendedDifficulty: Difficulty;
  rationale: string; masteryEstimate: number | null; lastActivityAt: string | null;
  successCount: number; partialCount: number; failedCount: number;
  recurringErrors: string[];
}
type DailyPlanState =
  | { kind: "ready"; items: DailyPlanItem[] }
  | { kind: "none-scheduled" }
  | { kind: "completed"; items: DailyPlanItem[] }
  | { kind: "unavailable"; message: string };
interface CalibrationEvidence {
  observedEvidence: number;
  requiredEvidence: number;
  coveredNotions: number | null;
  requiredCoveredNotions: number | null;
}
type WeakPointsState =
  | { kind: "ready"; items: WeakPointItem[] }
  | { kind: "calibrating"; evidence: CalibrationEvidence | null; message: string }
  | { kind: "unavailable"; message: string };
type ChapterTestPreparation =
  | {
      kind: "available";
      chapterId: string;
      questionCount: 20 | 40;
      compatibleQuestionCount: number;
    }
  | {
      kind: "insufficient-stock";
      chapterId: string;
      questionCount: 20 | 40;
      compatibleQuestionCount: number;
    }
  | { kind: "unavailable"; message: string };
```

Une `Question` de type `reflex` impose `difficulty: null` et une séance Réflexe utilise 60 secondes. Un blueprint conserve seed, ordre, `parameterValues` et versions de chaque instance.

`DailyPlanState` et `WeakPointsState` sont fournis à PR4 par des ports ou repositories fiables. PR4 ne calcule pas les algorithmes pédagogiques qui produisent ces états. Hors `ready`, aucune `QuestionInstance` n'est créée et aucune ancienne question ne reste active. Une jauge de calibration déterminée utilise uniquement des valeurs cohérentes de `CalibrationEvidence`; sinon elle reste indéterminée et sans pourcentage.

`ChapterTestPreparation` est discriminé exclusivement par `kind`. L'ancienne
forme avec `status` est invalide. Son état `unavailable` représente honnêtement
l'absence de données exploitables sans fabriquer de stock. Il est le seul
contrat de test utilisé en production par PR4. `ChapterTestBlueprint` est un
contrat cible de PR5 : PR4 ne le crée, ne le persiste et ne l'utilise pas. Le
démarrage et toute la passation appartiennent à PR5.

À ce stade, les références `variable` des contraintes d'une question publiée
doivent correspondre à une variable déclarée. L'analyse des références `@nom`
dans `MathSource` ou les segments textuels dépend des blocs C et D et n'est pas
réalisée par le validateur structurel du bloc A.

## Tableau

PR3 persiste uniquement le moteur manuscrit. Une scène PR3 ne contient que des objets `stroke` et couvre le stylo, la pression, l'inclinaison, la gomme, la grille et undo/redo. Les formes et les opérations sur objets sont des extensions de PR6 ; elles ne sont ni requises ni exposées par PR3.

```ts
interface WhiteboardStrokeStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: "round" | "square";
  lineJoin: "round" | "bevel" | "miter";
}
interface WhiteboardPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number | null;
  tiltY: number | null;
}
interface WhiteboardStroke {
  kind: "stroke";
  id: string;
  style: WhiteboardStrokeStyle;
  points: WhiteboardPoint[];
}
interface WhiteboardScene {
  schemaVersion: number; sceneId: string; questionInstanceId: string;
  logicalWidth: number; logicalHeight: number; objects: WhiteboardStroke[];
  updatedAt: string;
}
```

PR6 étend de façon versionnée ce contrat manuscrit avec les objets vectoriels suivants :

```ts
type WhiteboardShapeKind =
  | "line"
  | "arrow"
  | "rectangle"
  | "square"
  | "circle"
  | "triangle"
  | "axes"
  | "coordinate-system"
  | "grid-coordinate-system"
  | "graduated-coordinate-system"
  | "trigonometric-circle"
  | "sign-chart";

interface WhiteboardShapeGeometry {
  schemaVersion: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number | null;
  properties: Record<string, ParameterPrimitive>;
}
type WhiteboardObject =
  | WhiteboardStroke
  | { kind: "shape"; id: string; shapeKind: WhiteboardShapeKind; style: WhiteboardStrokeStyle; geometry: WhiteboardShapeGeometry };
interface AdvancedWhiteboardScene {
  schemaVersion: number; sceneId: string; questionInstanceId: string;
  logicalWidth: number; logicalHeight: number; objects: WhiteboardObject[];
  updatedAt: string;
}
```

Les coordonnées, positions et dimensions sont logiques, indépendantes des pixels et du tiroir. `id` reste stable. PR6 ajoute la sélection, le déplacement et le redimensionnement des objets vectoriels sans modifier les contrats manuscrits de PR3. `geometry.schemaVersion` permet de migrer la géométrie sans invalider toutes les scènes ; `rotation` est `null` quand elle n'est pas pertinente. `properties` est validé par forme et n'accepte que les clés documentées pour son `shapeKind`. Une restauration met en quarantaine les objets invalides sans perdre les objets sains.

La scène courante porte `schemaVersion: 3`. La palette utilisateur est un sous-ensemble contractuel de `WhiteboardShapeKind` limité, dans cet ordre, à `grid-coordinate-system`, `graduated-coordinate-system`, `trigonometric-circle` et `sign-chart`. Les primitives vectorielles communes (segments, polylignes, ellipses pleines ou non et textes) produisent à la fois l'aperçu SVG et le rendu Canvas ; la sérialisation conserve seulement le type, le style et la géométrie, pas une image bitmap. Les types historiques `line`, `arrow`, `rectangle`, `square`, `circle`, `triangle`, `axes` et `coordinate-system` restent dans l'union pour restaurer sans perte les scènes V2, mais ne sont plus des choix de palette. La restauration V1/V2 vers V3 est structurelle, déterministe et idempotente : elle conserve chaque objet valide et met seulement les objets invalides en quarantaine.

Toute nouvelle forme nécessite une évolution documentée du contrat, une migration de scène, un test de sérialisation, un test de restauration, un test de géométrie et un test de compatibilité avec les scènes précédentes.

## Progression

```ts
interface MasteryEvent {
  id: string; userId: string; notionId: string; questionId: string;
  sessionId: string; questionInstanceId: string;
  questionVersion: number; sessionMode: SessionMode; result: EvaluationResult;
  hintUsed: boolean; timeLimitExceeded: boolean; durationMs: number | null;
  occurredAt: string;
}
```

Les événements sont append-only. `sessionId` relie la séance ou le test réel ; `questionInstanceId` relie la variante réellement affichée ; `durationMs` conserve la durée observée, ou `null` si elle n'est pas mesurable. La durée ne devient jamais automatiquement un score sans règle pédagogique dédiée. `success` exige aucune aide et respect du temps Réflexe ; une réussite avec indice ou dépassement est `partial` ; Raté est `failed` ; Passer est `skipped` et n'influence pas la maîtrise sans règle future explicite.

## Compte et synchronisation

```ts
interface PencilPreferences { schemaVersion: number; handedness: "left" | "right"; pressureEnabled: boolean; scribbleEraseEnabled: boolean; gridEnabled: boolean; }
interface UserPreferences { schemaVersion: number; accountId: string; appearance: "system" | "light"; pencil: PencilPreferences; }
interface AccountProfile { id: string; displayName: string; email: string; role: UserRole; avatarUrl: string | null; updatedAt: string; }
interface SyncOperation { id: string; accountId: string; entity: string; entityId: string; kind: "create" | "update" | "delete"; baseVersion: number | null; payload: unknown; createdAt: string; attempts: number; }
interface SyncConflict { id: string; accountId: string; operationId: string; entity: string; entityId: string; localVersion: number; remoteVersion: number; localValue: unknown; remoteValue: unknown; detectedAt: string; status: "unresolved" | "local" | "remote" | "merged"; }
```

## Invariants

- Tous les timestamps sont ISO 8601 UTC ; ID opaques non réutilisés ; versions strictement positives.
- Scène, question migrée, progression sérialisée et préférences ont un `schemaVersion` dans leur enveloppe persistée ; les convertisseurs sont idempotents.
- Chaque donnée locale appartient à un compte. Une réponse réseau porte le compte et la génération de repository attendus avant application.
- `admin` inclut Élève ; `owner` inclut Administrateur. Le serveur reste l'autorité des permissions.
- Toute donnée invalide est expliquée et mise en quarantaine ; elle ne bloque pas l'ouverture du reste de l'espace.

## Création, syntaxe et import

```ts
type MathSyntaxCategory =
  | "operations"
  | "fractions"
  | "powers-indices"
  | "functions"
  | "comparisons"
  | "vectors"
  | "variables";
type MathSyntaxVersion = number;
interface MathSource { syntaxVersion: MathSyntaxVersion; source: string; }
interface MathSyntaxCommand {
  id: string; syntax: string; example: string; description: string;
  category: MathSyntaxCategory; availableSince: MathSyntaxVersion;
}
interface MathParseError {
  code: string; message: string;
  sourceStart: number | null; sourceEnd: number | null;
  correctionExample: string | null;
}
interface MathSymbolEntry {
  id: string; symbol: string; label: string;
  category: "sets" | "greek" | "logic" | "analysis" | "geometry";
  aliases: string[]; availableSince: number;
}
interface QuestionSourceReference {
  sourceLabel: string;
  sourceReference: string | null;
  sourceLocator: string | null;
}
interface QuestionProvenance {
  bundleId: string;
  importedAt: string;
  references: QuestionSourceReference[];
}
interface QuestionBankEntry {
  question: Question;
  provenance: { mode: "default" | "extend" | "replace"; references: QuestionSourceReference[] } | null;
}
interface QuestionBankBundle {
  schemaVersion: number; bundleId: string; generatedAt: string;
  defaultProvenance: QuestionSourceReference[] | null;
  questions: QuestionBankEntry[];
}
interface QuestionImportReportEntry {
  entryIndex: number;
  questionExternalId: string | null;
  questionId: string | null;
  sourceLocator: string | null;
  status: "accepted" | "rejected" | "updated" | "ignored" | "quarantined";
  message: string;
}
interface QuestionImportReport {
  bundleId: string; importedAt: string;
  entries: QuestionImportReportEntry[];
}
type FilterSelection<T> = { kind: "all" } | { kind: "one"; value: T };
type DifficultyFilterSelection =
  | { kind: "all" }
  | { kind: "one"; value: Difficulty }
  | { kind: "not-applicable" };
interface FreeRevisionFilters {
  part: FilterSelection<string>; chapter: FilterSelection<string>;
  notion: FilterSelection<string>; questionType: FilterSelection<QuestionType>;
  difficulty: DifficultyFilterSelection;
}
```

Commandes et symboles sont versionnés et constituent la source unique de l'analyseur, des **Raccourcis**, exemples, erreurs, tutoriel et tests. Une formule persiste sa source en langage mathématique simplifié et sa version, jamais le HTML rendu. Une même source/version produit le même arbre ; les migrations sont idempotentes.

`QuestionBankBundle` reste conceptuel jusqu'aux données réelles. L'import conserve source et version, produit un rapport, met les invalides en quarantaine, préserve les valides et ne crée aucun doublon à répétition.

Les options générales de `FreeRevisionFilters` ne dépendent pas de leur traduction et ne sont pas des entrées du programme. Réflexe emploie `not-applicable`; une difficulté précise l'exclut. Un parent changé réinitialise ses enfants incompatibles à `{ kind: "all" }`.

`DifficultyFilterSelection` décrit le filtre de Révision libre : Réflexe utilise exclusivement `{ kind: "not-applicable" }`, jamais `null`. Ce contrat est distinct de `Question.difficulty`, qui vaut `null` pour une question `reflex`.

## Contrats finalisés de PR0.2

### Analyse mathématique

Une même source et une même version produisent le même arbre. Le parser ne dépend ni de la langue de l'interface ni du navigateur ; le rendu n'est jamais la source de vérité. Les migrations de syntaxe sont idempotentes. Commandes et symboles viennent uniquement du registre versionné. `eval`, `new Function` et toute exécution de JavaScript arbitraire sont interdits.

`MathSource` est l'unique forme persistée d'une formule dans un `ContentSegment`. Le LaTeX de rendu et le HTML KaTeX sont des sorties temporaires d'infrastructure, jamais des sources persistées.

### Références de variables dans le contenu

Une référence `@nom` peut apparaître dans le texte et les formules de l'énoncé, l'indice, le titre d'une étape de correction et son contenu. L'instanciation d'une variante emploie une seule table `parameterValues` dans tous ces emplacements. Toute référence inconnue bloque la publication ; une définition inutilisée produit un avertissement. Un renommage modifie toutes les références atomiquement sans persister d'état intermédiaire. La suppression d'une variable utilisée passe par une confirmation interne ; celle d'une variable inutilisée n'est pas destructive et n'en demande pas.

### Transitions des filtres

Avec `{ kind: "all" }` pour Partie, Chapitre offre d'abord **Tous les chapitres**, puis tous les chapitres distingués par partie. Avec une partie précise et Chapitre général, Notion offre d'abord **Toutes les notions**, puis toutes les notions de la partie distinguées par chapitre. Quand Partie et Chapitre sont généraux, toutes les notions sont distinguées par partie et chapitre. Un changement de partie remet chapitre et notion incompatibles à `{ kind: "all" }` ; un changement de chapitre fait de même pour la notion incompatible.

Choisir Réflexe fixe `difficulty` à `{ kind: "not-applicable" }`. Quitter Réflexe vers **Tous les types**, Formules, Cours ou Calcul fixe toujours `difficulty` à `{ kind: "all" }`, sans restaurer d'ancienne valeur cachée. Une difficulté précise exclut Réflexe mais ne modifie pas `questionType` et peut produire un résultat vide explicite.

Une Révision libre persistée utilise exclusivement `FilterSelection<T>`, `DifficultyFilterSelection` et `FreeRevisionFilters`. `null` ne représente jamais à la fois Tout, une absence et une valeur non applicable : **Toutes les difficultés** vaut `{ kind: "all" }` et Réflexe impose `{ kind: "not-applicable" }`.

### Provenance et import

Chaque question importée peut conserver sa provenance propre. Le bundle peut fournir une provenance par défaut ; une question peut la compléter ou la remplacer explicitement. Plusieurs références sont permises. Aucune source absente n'est inventée : les références fournies sont conservées exactement et une valeur absente reste `null`. `sourceLocator` accepte tout localisateur fourni, notamment page, chapitre, section, URL ou identifiant. Ce contrat reste adaptable lorsque les banques réelles seront reçues et ne fige pas prématurément leur format.

`QuestionBankEntry.provenance` décrit la provenance d'entrée. Après application de `default`, `extend` ou `replace`, `Question.provenance` contient la provenance résolue persistée. Une question créée manuellement peut conserver `null`. Pour une question importée, la provenance reste présente après synchronisation, export, réimport et modification ; une modification du contenu ne la supprime jamais silencieusement.

Dès PR4, l'import initial est versionné, validé, idempotent et traçable. Il conserve toutes les entrées valides, met les invalides en quarantaine et produit un `QuestionImportReport`. Le rapport avancé de PR7 indique pour chaque question si elle est acceptée, rejetée, mise à jour, ignorée ou mise en quarantaine.

La banque historique auditée n'est pas un bundle de production validé. Elle reste bloquée tant que licence, droits de modification et redistribution, provenance, rattachement au programme, qualité, types, difficultés, paramètres et conversions sûres du LaTeX et du HTML ne sont pas validés. La source originale est conservée ; toute conversion ambiguë ou invalide est mise en quarantaine. En l'absence de banque validée, aucune question ni `QuestionInstance` n'est fabriquée.

Dans chaque `QuestionImportReportEntry`, `entryIndex` identifie toujours la position de l'entrée dans le bundle, même sans identifiant externe. `questionId` contient l'identifiant interne lorsqu'une question a été créée ou retrouvée et `sourceLocator` reprend le localisateur fourni lorsqu'il existe. Deux entrées du rapport ne peuvent jamais être impossibles à distinguer. `accepted` signifie qu'une nouvelle question valide est créée ; `updated`, qu'une question existante est mise à jour ; `ignored`, qu'une entrée valide ne demande aucun changement ; `rejected`, qu'elle est refusée sans conservation ; `quarantined`, qu'une entrée invalide est conservée pour diagnostic ou correction ultérieure.
