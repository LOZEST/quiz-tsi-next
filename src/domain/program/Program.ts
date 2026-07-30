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

type ProgramNode = Readonly<{
  id: string;
  label: string;
  order: number;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
