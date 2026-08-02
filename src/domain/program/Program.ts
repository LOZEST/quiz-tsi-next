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

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateNode(
  value: unknown,
  path: string,
): ValidationResult<ProgramNode> {
  if (!isRecord(value)) {
    return invalid(issue(path, 'Une entrée de programme doit être un objet.'));
  }
  if (
    typeof value.id !== 'string' ||
    value.id.trim() === '' ||
    typeof value.label !== 'string' ||
    value.label.trim() === '' ||
    !Number.isInteger(value.order) ||
    (value.order as number) < 0
  ) {
    return invalid(
      issue(path, 'Identifiant, libellé et ordre de programme invalides.'),
    );
  }
  return valid({
    id: value.id,
    label: value.label,
    order: value.order as number,
  });
}

export function validateProgramPart(
  value: unknown,
): ValidationResult<ProgramPart> {
  return validateNode(value, 'part');
}

export function validateProgramChapter(
  value: unknown,
): ValidationResult<ProgramChapter> {
  const node = validateNode(value, 'chapter');
  if (!node.ok) return node;
  if (!isRecord(value) || typeof value.partId !== 'string' || !value.partId) {
    return invalid(issue('chapter.partId', 'La partie parente est requise.'));
  }
  return valid({ ...node.value, partId: value.partId });
}

export function validateProgramNotion(
  value: unknown,
): ValidationResult<ProgramNotion> {
  const node = validateNode(value, 'notion');
  if (!node.ok) return node;
  if (
    !isRecord(value) ||
    typeof value.chapterId !== 'string' ||
    !value.chapterId
  ) {
    return invalid(issue('notion.chapterId', 'Le chapitre parent est requis.'));
  }
  return valid({ ...node.value, chapterId: value.chapterId });
}

function validateString(
  value: unknown,
  path: string,
  issues: ReturnType<typeof issue>[],
): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue(path, 'Une chaîne non vide est requise.'));
    return null;
  }
  return value;
}

function validateOrder(
  value: unknown,
  path: string,
  issues: ReturnType<typeof issue>[],
): number | null {
  if (!Number.isInteger(value) || (value as number) < 0) {
    issues.push(issue(path, 'Un entier supérieur ou égal à zéro est requis.'));
    return null;
  }
  return value as number;
}

function validateCollection<T>(
  value: unknown,
  path: string,
  parentKey: 'partId' | 'chapterId' | null,
  issues: ReturnType<typeof issue>[],
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

    const id = validateString(entry.id, `${entryPath}.id`, issues);
    const label = validateString(entry.label, `${entryPath}.label`, issues);
    const order = validateOrder(entry.order, `${entryPath}.order`, issues);
    const parentId =
      parentKey === null
        ? null
        : validateString(entry[parentKey], `${entryPath}.${parentKey}`, issues);

    if (id !== null) {
      if (ids.has(id)) {
        issues.push(
          issue(`${entryPath}.id`, `L'identifiant « ${id} » est dupliqué.`),
        );
      } else {
        ids.add(id);
      }
    }

    if (
      id !== null &&
      label !== null &&
      order !== null &&
      (parentKey === null || parentId !== null)
    ) {
      normalized.push(
        (parentKey === null
          ? { id, label, order }
          : { id, [parentKey]: parentId, label, order }) as T,
      );
    }
  });
  return normalized;
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

    const issues: ReturnType<typeof issue>[] = [];
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
      null,
      issues,
    );
    const chapters = validateCollection<ProgramChapter>(
      value.chapters,
      'program.chapters',
      'partId',
      issues,
    );
    const notions = validateCollection<ProgramNotion>(
      value.notions,
      'program.notions',
      'chapterId',
      issues,
    );

    const partIds = new Set(parts.map(({ id }) => id));
    if (Array.isArray(value.chapters)) {
      value.chapters.forEach((chapter, index) => {
        if (
          isRecord(chapter) &&
          typeof chapter.partId === 'string' &&
          chapter.partId.trim() !== '' &&
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
