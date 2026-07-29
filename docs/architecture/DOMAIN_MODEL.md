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
  | { kind: "inline-math"; latex: string }
  | { kind: "display-math"; latex: string }
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

type SafeExpressionNode =
  | { kind: "literal"; value: ParameterPrimitive }
  | { kind: "variable"; variableId: string }
  | { kind: "unary"; operator: "negate" | "absolute"; operand: SafeExpressionNode }
  | { kind: "binary"; operator: "add" | "subtract" | "multiply" | "divide" | "modulo" | "power"; left: SafeExpressionNode; right: SafeExpressionNode }
  | { kind: "comparison"; operator: "equal" | "not-equal" | "less-than" | "less-than-or-equal" | "greater-than" | "greater-than-or-equal"; left: SafeExpressionNode; right: SafeExpressionNode }
  | { kind: "math-function"; function: "abs" | "sqrt" | "min" | "max" | "round" | "floor" | "ceil"; arguments: SafeExpressionNode[] }
  | { kind: "logical"; operator: "and" | "or"; operands: SafeExpressionNode[] }
  | { kind: "logical-not"; operand: SafeExpressionNode };

interface ParameterizedQuestionSpec {
  schemaVersion: number;
  variables: VariableDefinition[];
  constraints: SafeExpressionNode[];
  validationVariantCount: number;
}
```

`SafeExpressionNode` est un AST interprété en liste blanche. Il n'autorise ni `eval`, ni `new Function`, ni JavaScript arbitraire, ni accès au DOM, au réseau ou au stockage. Les opérateurs et fonctions non énumérés sont invalides.

### Question et instance

```ts
interface CorrectionStep { id: string; title: string | null; content: ContentSegment[]; }
interface Question {
  id: string; version: number; source: "static" | "private" | "shared";
  ownerId: string | null; status: "draft" | "published" | "archived";
  partId: string; chapterId: string; notionId: string;
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
```

Le contenu distant est constitué de segments, jamais de HTML arbitraire. Le LaTeX est rendu de façon contrôlée. Une question publiée est validée. `difficulty` vaut `null` pour `reflex`.

`parameterization` vaut `null` pour une question non paramétrée. Avant publication d'une question paramétrée, `validationVariantCount` vaut au minimum 10 et autant de variantes valides sont contrôlées. Toutes les valeurs générées satisfont leur domaine et toutes les contraintes. Une seed identique produit les mêmes valeurs et le même contenu. Une combinaison impossible produit une erreur explicite ; aucune variante invalide n'est publiée silencieusement.

## Sessions

```ts
interface SessionConfig {
  mode: SessionMode; partId: string | null; chapterId: string | null;
  notionId: string | null; questionType: QuestionType | null;
  difficulty: Difficulty | null;
}
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
```

Une configuration `reflex` impose `difficulty: null` et 60 secondes. Un blueprint conserve seed, ordre, `parameterValues` et versions de chaque instance.

## Tableau

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
  | "trigonometric-circle";

interface WhiteboardStrokeStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: "round" | "square";
  lineJoin: "round" | "bevel" | "miter";
}
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
  | { kind: "stroke"; id: string; style: WhiteboardStrokeStyle; points: Array<{ x: number; y: number; pressure: number }> }
  | { kind: "shape"; id: string; shapeKind: WhiteboardShapeKind; style: WhiteboardStrokeStyle; geometry: WhiteboardShapeGeometry };
interface WhiteboardScene {
  schemaVersion: number; sceneId: string; questionInstanceId: string;
  logicalWidth: number; logicalHeight: number; objects: WhiteboardObject[];
  updatedAt: string;
}
```

Les coordonnées, positions et dimensions sont logiques, indépendantes des pixels et du tiroir. `id` reste stable. `geometry.schemaVersion` permet de migrer la géométrie sans invalider toutes les scènes ; `rotation` est `null` quand elle n'est pas pertinente. `properties` est validé par forme et n'accepte que les clés documentées pour son `shapeKind`. Une restauration met en quarantaine les objets invalides sans perdre les objets sains.

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
