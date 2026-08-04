import { useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import {
  deriveAvailableChapters,
  deriveAvailableNotions,
  normalizeFreeRevisionFilters,
} from '@domain/session/FreeRevisionFilters';
import type { Difficulty, QuestionType } from '@domain/questions/Question';
import type {
  DailyPlanState,
  FilterSelection,
  FreeRevisionFilters,
  SessionMode,
  WeakPointsState,
} from '@domain/session/Session';
import { useRevisionExperience } from './RevisionExperienceProvider';
import styles from './RevisionExperience.module.css';

const paths: readonly { id: SessionMode; label: string }[] = [
  { id: 'daily', label: 'Révision du jour' },
  { id: 'weak-points', label: 'Consolidation des points faibles' },
  { id: 'free', label: 'Révision libre' },
  { id: 'chapter-test', label: 'Test de chapitres' },
];
const types: readonly { value: QuestionType; label: string }[] = [
  { value: 'formula', label: 'Formules' },
  { value: 'course', label: 'Cours' },
  { value: 'calculation', label: 'Calcul' },
  { value: 'reflex', label: 'Réflexe' },
];
const difficulties: readonly { value: Difficulty; label: string }[] = [
  { value: 'fundamental', label: 'Fondamental' },
  { value: 'standard', label: 'Standard' },
  { value: 'trap', label: 'Piège' },
];
const selection = (value: string): FilterSelection<string> =>
  value === '' ? { kind: 'all' } : { kind: 'one', value };
const selected = (value: FilterSelection<string>) =>
  value.kind === 'all' ? '' : value.value;

export function RevisionDrawerPanel() {
  const experience = useRevisionExperience();
  const { programIndex } = useAppServices();
  const update = (next: FreeRevisionFilters) => {
    if (!programIndex) {
      experience.setVisibleFilters(next);
      return;
    }
    const normalized = normalizeFreeRevisionFilters(next, programIndex);
    if (normalized.ok) experience.setVisibleFilters(normalized.value);
  };
  const filters = experience.visibleFilters;
  const chapters = programIndex
    ? deriveAvailableChapters(programIndex, filters.part)
    : [];
  const notions = programIndex
    ? deriveAvailableNotions(programIndex, filters.part, filters.chapter)
    : [];
  return (
    <div className={styles.panel}>
      <fieldset>
        <legend>Parcours actif</legend>
        {paths.map((path) => (
          <label key={path.id}>
            <input
              type="radio"
              name="revision-path"
              checked={experience.mode === path.id}
              onChange={() => experience.setMode(path.id)}
            />
            {path.label}
          </label>
        ))}
      </fieldset>
      {experience.mode === 'free' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            experience.applyFilters();
          }}
        >
          <label>
            Partie
            <select
              value={selected(filters.part)}
              onChange={(event) =>
                update({ ...filters, part: selection(event.target.value) })
              }
            >
              <option value="">Toutes les parties</option>
              {programIndex?.getAllParts().map((part) => (
                <option key={part.id} value={part.id}>
                  {part.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chapitre
            <select
              value={selected(filters.chapter)}
              onChange={(event) =>
                update({ ...filters, chapter: selection(event.target.value) })
              }
            >
              <option value="">Tous les chapitres</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {programIndex?.getPart(chapter.partId)?.label} —{' '}
                  {chapter.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notion
            <select
              value={selected(filters.notion)}
              onChange={(event) =>
                update({ ...filters, notion: selection(event.target.value) })
              }
            >
              <option value="">Toutes les notions</option>
              {notions.map((notion) => {
                const chapter = programIndex?.getChapter(notion.chapterId);
                return (
                  <option key={notion.id} value={notion.id}>
                    {chapter
                      ? `${programIndex?.getPart(chapter.partId)?.label} — ${chapter.label} — `
                      : ''}
                    {notion.label}
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            Type de question
            <select
              value={
                filters.questionType.kind === 'all'
                  ? ''
                  : filters.questionType.value
              }
              onChange={(event) => {
                const questionType =
                  event.target.value === ''
                    ? { kind: 'all' as const }
                    : {
                        kind: 'one' as const,
                        value: event.target.value as QuestionType,
                      };
                update({
                  ...filters,
                  questionType,
                  difficulty:
                    event.target.value === 'reflex'
                      ? { kind: 'not-applicable' }
                      : filters.questionType.kind === 'one' &&
                          filters.questionType.value === 'reflex'
                        ? { kind: 'all' }
                        : filters.difficulty,
                });
              }}
            >
              <option value="">Tous les types</option>
              {types.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          {filters.questionType.kind !== 'one' ||
          filters.questionType.value !== 'reflex' ? (
            <label>
              Difficulté
              <select
                value={
                  filters.difficulty.kind === 'one'
                    ? filters.difficulty.value
                    : ''
                }
                onChange={(event) =>
                  update({
                    ...filters,
                    difficulty:
                      event.target.value === ''
                        ? { kind: 'all' }
                        : {
                            kind: 'one',
                            value: event.target.value as Difficulty,
                          },
                  })
                }
              >
                <option value="">Toutes les difficultés</option>
                {difficulties.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="submit">Appliquer</button>
        </form>
      ) : null}
      {experience.mode === 'daily' && experience.state.kind === 'daily' ? (
        <Daily state={experience.state.state} />
      ) : null}
      {experience.mode === 'weak-points' &&
      experience.state.kind === 'weak-points' ? (
        <Weak
          state={experience.state.state}
          onFree={() => experience.setMode('free')}
        />
      ) : null}
      {experience.mode === 'chapter-test' ? <ChapterTest /> : null}
    </div>
  );
}

function Daily({ state }: { state: DailyPlanState }) {
  if (state.kind === 'none-scheduled')
    return <p>Aucune révision n’est prévue aujourd’hui. Tu es à jour.</p>;
  if (state.kind === 'completed')
    return (
      <p>
        Révision du jour terminée. Toutes les notions prévues ont été révisées.
      </p>
    );
  if (state.kind === 'unavailable') return <p>{state.message}</p>;
  return (
    <ul>
      {state.items.map((item) => (
        <li key={item.notionId}>
          {item.notionId} — {item.successCount}/{item.plannedCount}
        </li>
      ))}
    </ul>
  );
}
function Weak({
  state,
  onFree,
}: {
  state: WeakPointsState;
  onFree: () => void;
}) {
  if (state.kind === 'calibrating')
    return (
      <>
        <p>
          L’application apprend encore ton niveau. Réponds à davantage de
          questions pour obtenir une sélection personnalisée.
        </p>
        {state.evidence && state.evidence.requiredEvidence > 0 ? (
          <progress
            value={state.evidence.observedEvidence}
            max={state.evidence.requiredEvidence}
          />
        ) : (
          <progress />
        )}
        <button onClick={() => onFree()}>Ouvrir Révision libre</button>
      </>
    );
  if (state.kind === 'unavailable')
    return (
      <>
        <p>{state.message}</p>
        <button onClick={() => onFree()}>Ouvrir Révision libre</button>
      </>
    );
  return (
    <ul>
      {state.items.map((item) => (
        <li key={item.notionId}>
          {item.notionId} — priorité {item.priority}
        </li>
      ))}
    </ul>
  );
}
function ChapterTest() {
  const { programIndex, questionRepository } = useAppServices();
  const chapters = programIndex?.getAllChapters() ?? [];
  const [chapter, setChapter] = useState('');
  const [quantity, setQuantity] = useState<20 | 40>(20);
  const available = chapter
    ? new Set(
        questionRepository
          .listPublished()
          .filter((question) => question.chapterId === chapter)
          .map((question) => question.id),
      ).size
    : 0;
  return (
    <div>
      <label>
        Chapitre
        <select
          value={chapter}
          onChange={(event) => setChapter(event.target.value)}
        >
          <option value="">Choisir un chapitre</option>
          {chapters.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Quantité</legend>
        {([20, 40] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              checked={quantity === value}
              onChange={() => setQuantity(value)}
            />
            {value}
          </label>
        ))}
      </fieldset>
      {chapter ? <p>{available} question(s) compatible(s).</p> : null}
      {chapter && available < quantity ? (
        <p>
          Ce chapitre ne contient pas encore assez de questions validées pour
          préparer un test de {quantity} questions.
        </p>
      ) : null}
      <p>La passation sera disponible à l’étape PR5.</p>
    </div>
  );
}
