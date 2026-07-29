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

```ts
interface CorrectionStep { id: string; title: string | null; content: ContentSegment[]; }
interface Question {
  id: string; version: number; source: "static" | "private" | "shared";
  ownerId: string | null; status: "draft" | "published" | "archived";
  partId: string; chapterId: string; notionId: string;
  type: QuestionType; difficulty: Difficulty | null;
  prompt: ContentSegment[]; hint: ContentSegment[]; correction: CorrectionStep[];
  tags: string[]; validated: boolean; createdAt: string; updatedAt: string;
}
interface QuestionInstance {
  id: string; questionId: string; questionVersion: number; sessionId: string;
  ordinal: number; frozenQuestion: Question; parameters: Record<string, string | number>;
  createdAt: string;
}
interface FrozenQuestionInstance extends QuestionInstance { contentHash: string; }
```

Le contenu distant est constitué de segments, jamais de HTML arbitraire. Le LaTeX est rendu de façon contrôlée. Une question publiée est validée. `difficulty` vaut `null` pour `reflex`.

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

Une configuration `reflex` impose `difficulty: null` et 60 secondes. Un blueprint conserve seed, ordre, paramètres et versions.

## Tableau

```ts
type WhiteboardObject =
  | { kind: "stroke"; id: string; points: Array<{ x: number; y: number; pressure: number }> }
  | { kind: "shape"; id: string; shape: "line" | "arrow" | "rectangle" | "circle"; x: number; y: number; width: number; height: number };
interface WhiteboardScene {
  schemaVersion: number; sceneId: string; questionInstanceId: string;
  logicalWidth: number; logicalHeight: number; objects: WhiteboardObject[];
  updatedAt: string;
}
```

Les coordonnées sont logiques, indépendantes des pixels et du tiroir. Une restauration ignore/quarantaines les objets invalides sans perdre les objets sains.

## Progression

```ts
interface MasteryEvent {
  id: string; userId: string; notionId: string; questionId: string;
  questionVersion: number; sessionMode: SessionMode; result: EvaluationResult;
  hintUsed: boolean; timeLimitExceeded: boolean; occurredAt: string;
}
```

Les événements sont append-only. `success` exige aucune aide et respect du temps Réflexe ; une réussite avec indice ou dépassement est `partial` ; Raté est `failed` ; Passer est `skipped` et n'influence pas la maîtrise sans règle future explicite.

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
