import {
  invalid,
  issue,
  valid,
  type ValidationResult,
} from '../validation/ValidationResult';

export const PROGRAM_SCHEMA_VERSION = 1 as const;

export interface ProgramPart {
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export interface ProgramChapter {
  readonly id: string;
  readonly partId: string;
  readonly label: string;
  readonly order: number;
}

export interface ProgramNotion {
  readonly id: string;
  readonly chapterId: string;
  readonly label: string;
  readonly order: number;
}

export interface Program {
  readonly schemaVersion: typeof PROGRAM_SCHEMA_VERSION;
  readonly parts: readonly ProgramPart[];
  readonly chapters: readonly ProgramChapter[];
  readonly notions: readonly ProgramNotion[];
}

export interface ProgramIndex {
  getPart(id: string): ProgramPart | null;
  getChapter(id: string): ProgramChapter | null;
  getNotion(id: string): ProgramNotion | null;
  getChaptersForPart(partId: string): readonly ProgramChapter[];
  getNotionsForChapter(chapterId: string): readonly ProgramNotion[];
}

type ProgramNode = Readonly<{
  id: string;
  label: string;
  order: number;
}>;

type ProgramIssue = ReturnType<typeof issue>;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateIdentifier(
  value: unknown,
  path: string,
  issues: ProgramIssue[],
): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue(path, 'Un identifiant non vide est requis.'));
    return null;
  }
  if (value !== value.trim()) {
    issues.push(
      issue(
        path,
        "L'identifiant ne doit pas contenir d'espace au début ou à la fin.",
      ),
    );
    return null;
  }
  return value;
}

function validateLabel(
  value: unknown,
  path: string,
  issues: ProgramIssue[],
): string | null {
  if (typeof value !== 'string') {
    issues.push(issue(path, 'Un libellé non vide est requis.'));
    return null;
  }
  const normalized = value.trim();
  if (normalized === '') {
    issues.push(issue(path, 'Un libellé non vide est requis.'));
    return null;
  }
  return normalized;
}

function validateOrder(
  value: unknown,
  path: string,
  issues: ProgramIssue[],
): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    issues.push(issue(path, 'Un entier supérieur ou égal à zéro est requis.'));
    return null;
  }
  return value;
}

function validateNode(
  value: unknown,
  path: string,
  issues: ProgramIssue[],
): ProgramNode | null {
  if (!isRecord(value)) {
    issues.push(issue(path, 'Une entrée de programme doit être un objet.'));
    return null;
  }
  const id = validateIdentifier(value.id, `${path}.id`, issues);
  return validateNodeFields(value, path, issues, id);
}

function validateNodeFields(
  value: Record<string, unknown>,
  path: string,
  issues: ProgramIssue[],
  id: string | null,
): ProgramNode | null {
  const label = validateLabel(value.label, `${path}.label`, issues);
  const order = validateOrder(value.order, `${path}.order`, issues);
  return id === null || label === null || order === null
    ? null
    : { id, label, order };
}

export function validateProgramPart(
  value: unknown,
): ValidationResult<ProgramPart> {
  const issues: ProgramIssue[] = [];
  const node = validateNode(value, 'part', issues);
  return node === null ? invalid(...issues) : valid(node);
}

export function validateProgramChapter(
  value: unknown,
): ValidationResult<ProgramChapter> {
  const issues: ProgramIssue[] = [];
  const node = validateNode(value, 'chapter', issues);
  const partId = isRecord(value)
    ? validateIdentifier(value.partId, 'chapter.partId', issues)
    : null;
  return node === null || partId === null
    ? invalid(...issues)
    : valid({ ...node, partId });
}

export function validateProgramNotion(
  value: unknown,
): ValidationResult<ProgramNotion> {
  const issues: ProgramIssue[] = [];
  const node = validateNode(value, 'notion', issues);
  const chapterId = isRecord(value)
    ? validateIdentifier(value.chapterId, 'notion.chapterId', issues)
    : null;
  return node === null || chapterId === null
    ? invalid(...issues)
    : valid({ ...node, chapterId });
}

function validateCollection<T extends ProgramNode>(
  value: unknown,
  path: string,
  issues: ProgramIssue[],
  validateEntry: (
    entry: Record<string, unknown>,
    entryPath: string,
    issues: ProgramIssue[],
    id: string | null,
  ) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'Un tableau est requis.'));
    return [];
  }

  const normalized: T[] = [];
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}.${index}`;
    if (!isRecord(entry)) {
      issues.push(
        issue(entryPath, 'Une entrée de programme doit être un objet.'),
      );
      return;
    }

    const id = validateIdentifier(entry.id, `${entryPath}.id`, issues);
    const normalizedEntry = validateEntry(entry, entryPath, issues, id);

    if (id !== null) {
      if (ids.has(id)) {
        issues.push(
          issue(`${entryPath}.id`, `L'identifiant « ${id} » est dupliqué.`),
        );
      } else {
        ids.add(id);
      }
    }

    if (normalizedEntry !== null) normalized.push(normalizedEntry);
  });
  return normalized;
}

function validatePartEntry(
  entry: Record<string, unknown>,
  path: string,
  issues: ProgramIssue[],
  id: string | null,
): ProgramPart | null {
  return validateNodeFields(entry, path, issues, id);
}

function validateChapterEntry(
  entry: Record<string, unknown>,
  path: string,
  issues: ProgramIssue[],
  id: string | null,
): ProgramChapter | null {
  const node = validateNodeFields(entry, path, issues, id);
  const partId = validateIdentifier(entry.partId, `${path}.partId`, issues);
  return node === null || partId === null ? null : { ...node, partId };
}

function validateNotionEntry(
  entry: Record<string, unknown>,
  path: string,
  issues: ProgramIssue[],
  id: string | null,
): ProgramNotion | null {
  const node = validateNodeFields(entry, path, issues, id);
  const chapterId = validateIdentifier(
    entry.chapterId,
    `${path}.chapterId`,
    issues,
  );
  return node === null || chapterId === null ? null : { ...node, chapterId };
}

function freezeProgram(program: Program): Program {
  for (const part of program.parts) Object.freeze(part);
  for (const chapter of program.chapters) Object.freeze(chapter);
  for (const notion of program.notions) Object.freeze(notion);
  Object.freeze(program.parts);
  Object.freeze(program.chapters);
  Object.freeze(program.notions);
  return Object.freeze(program);
}

export function validateProgram(value: unknown): ValidationResult<Program> {
  try {
    if (!isRecord(value)) {
      return invalid(issue('program', 'Le programme doit être un objet.'));
    }

    const issues: ProgramIssue[] = [];
    if (value.schemaVersion !== PROGRAM_SCHEMA_VERSION) {
      issues.push(
        issue(
          'program.schemaVersion',
          `La version ${PROGRAM_SCHEMA_VERSION} du programme est requise.`,
        ),
      );
    }

    const parts = validateCollection<ProgramPart>(
      value.parts,
      'program.parts',
      issues,
      validatePartEntry,
    );
    const chapters = validateCollection<ProgramChapter>(
      value.chapters,
      'program.chapters',
      issues,
      validateChapterEntry,
    );
    const notions = validateCollection<ProgramNotion>(
      value.notions,
      'program.notions',
      issues,
      validateNotionEntry,
    );

    const partIds = new Set(parts.map(({ id }) => id));
    if (Array.isArray(value.chapters)) {
      value.chapters.forEach((chapter, index) => {
        if (
          isRecord(chapter) &&
          typeof chapter.partId === 'string' &&
          chapter.partId.trim() !== '' &&
          chapter.partId === chapter.partId.trim() &&
          !partIds.has(chapter.partId)
        ) {
          issues.push(
            issue(
              `program.chapters.${index}.partId`,
              `La partie « ${chapter.partId} » n'existe pas.`,
            ),
          );
        }
      });
    }

    const chapterIds = new Set(chapters.map(({ id }) => id));
    if (Array.isArray(value.notions)) {
      value.notions.forEach((notion, index) => {
        if (
          isRecord(notion) &&
          typeof notion.chapterId === 'string' &&
          notion.chapterId.trim() !== '' &&
          notion.chapterId === notion.chapterId.trim() &&
          !chapterIds.has(notion.chapterId)
        ) {
          issues.push(
            issue(
              `program.notions.${index}.chapterId`,
              `Le chapitre « ${notion.chapterId} » n'existe pas.`,
            ),
          );
        }
      });
    }

    if (issues.length > 0) return invalid(...issues);

    return valid(
      freezeProgram({
        schemaVersion: PROGRAM_SCHEMA_VERSION,
        parts,
        chapters,
        notions,
      }),
    );
  } catch {
    return invalid(
      issue('program', 'Le programme ne peut pas être lu en toute sécurité.'),
    );
  }
}

function compareProgramNodes(left: ProgramNode, right: ProgramNode): number {
  if (left.order !== right.order) return left.order - right.order;
  if (left.id < right.id) return -1;
  if (left.id > right.id) return 1;
  return 0;
}

export function createProgramIndex(program: Program): ProgramIndex {
  const parts = program.parts.map((part) =>
    Object.freeze({ id: part.id, label: part.label, order: part.order }),
  );
  const chapters = program.chapters.map((chapter) =>
    Object.freeze({
      id: chapter.id,
      partId: chapter.partId,
      label: chapter.label,
      order: chapter.order,
    }),
  );
  const notions = program.notions.map((notion) =>
    Object.freeze({
      id: notion.id,
      chapterId: notion.chapterId,
      label: notion.label,
      order: notion.order,
    }),
  );

  const partsById = new Map(parts.map((part) => [part.id, part]));
  const chaptersById = new Map(
    chapters.map((chapter) => [chapter.id, chapter]),
  );
  const notionsById = new Map(notions.map((notion) => [notion.id, notion]));
  const chaptersByPart = new Map<string, readonly ProgramChapter[]>();
  const notionsByChapter = new Map<string, readonly ProgramNotion[]>();

  for (const part of parts) {
    chaptersByPart.set(
      part.id,
      Object.freeze(
        chapters
          .filter((chapter) => chapter.partId === part.id)
          .sort(compareProgramNodes),
      ),
    );
  }
  for (const chapter of chapters) {
    notionsByChapter.set(
      chapter.id,
      Object.freeze(
        notions
          .filter((notion) => notion.chapterId === chapter.id)
          .sort(compareProgramNodes),
      ),
    );
  }

  return Object.freeze({
    getPart: (id: string) => partsById.get(id) ?? null,
    getChapter: (id: string) => chaptersById.get(id) ?? null,
    getNotion: (id: string) => notionsById.get(id) ?? null,
    getChaptersForPart: (partId: string) =>
      chaptersByPart.get(partId) ?? Object.freeze([]),
    getNotionsForChapter: (chapterId: string) =>
      notionsByChapter.get(chapterId) ?? Object.freeze([]),
  });
}
