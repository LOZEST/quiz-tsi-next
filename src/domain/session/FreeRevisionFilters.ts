import type {
  ProgramIndex,
  ProgramChapter,
  ProgramNotion,
} from '../program/Program';
import type { FreeRevisionFilters, FilterSelection } from './Session';
import { validateFreeRevisionFilters } from './Session';

const all = <T>(): FilterSelection<T> => Object.freeze({ kind: 'all' });

export function deriveAvailableChapters(
  program: ProgramIndex,
  part: FilterSelection<string>,
): readonly ProgramChapter[] {
  return part.kind === 'one'
    ? program.getChaptersForPart(part.value)
    : program.getAllChapters();
}

export function deriveAvailableNotions(
  program: ProgramIndex,
  part: FilterSelection<string>,
  chapter: FilterSelection<string>,
): readonly ProgramNotion[] {
  if (chapter.kind === 'one')
    return program.getNotionsForChapter(chapter.value);
  if (part.kind === 'all') return program.getAllNotions();
  return Object.freeze(
    program
      .getChaptersForPart(part.value)
      .flatMap((entry) => [...program.getNotionsForChapter(entry.id)]),
  );
}

export function normalizeFreeRevisionFilters(
  value: unknown,
  program: ProgramIndex,
  quizzIds: ReadonlySet<string> = new Set(),
): ReturnType<typeof validateFreeRevisionFilters> {
  const checked = validateFreeRevisionFilters(value);
  if (!checked.ok) return checked;
  const filters: FreeRevisionFilters = checked.value;
  // A quizz fills the "chapter" slot (Phase 7: flat structure, no
  // part/notion level of its own), so it bypasses the official-program
  // consistency checks below entirely.
  if (filters.chapter.kind === 'one' && quizzIds.has(filters.chapter.value)) {
    return {
      ok: true,
      value: Object.freeze({
        ...filters,
        part: all<string>(),
        chapter: filters.chapter,
        notion: all<string>(),
      }),
    };
  }
  let chapter = filters.chapter;
  let notion = filters.notion;
  if (filters.part.kind === 'one') {
    if (!program.getPart(filters.part.value))
      return {
        ok: false,
        issues: [
          { path: 'filters.part', message: 'Partie absente du programme.' },
        ],
      };
    if (
      chapter.kind === 'one' &&
      program.getChapter(chapter.value)?.partId !== filters.part.value
    )
      chapter = all();
  }
  if (chapter.kind === 'one') {
    if (!program.getChapter(chapter.value))
      return {
        ok: false,
        issues: [
          { path: 'filters.chapter', message: 'Chapitre absent du programme.' },
        ],
      };
    if (
      notion.kind === 'one' &&
      program.getNotion(notion.value)?.chapterId !== chapter.value
    )
      notion = all();
  }
  if (
    filters.part.kind === 'one' &&
    notion.kind === 'one' &&
    program.getChapter(program.getNotion(notion.value)?.chapterId ?? '')
      ?.partId !== filters.part.value
  )
    notion = all();
  if (notion.kind === 'one' && !program.getNotion(notion.value)) notion = all();
  return { ok: true, value: Object.freeze({ ...filters, chapter, notion }) };
}
