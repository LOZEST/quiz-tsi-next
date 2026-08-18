import { useEffect, useRef, useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import {
  deriveAvailableChapters,
  deriveAvailableNotions,
  normalizeFreeRevisionFilters,
} from '@domain/session/FreeRevisionFilters';
import {
  questionClassification,
  type Difficulty,
  type QuestionType,
} from '@domain/questions/Question';
import type { ProgramIndex } from '@domain/program/Program';
import type { Quizz } from '@domain/questions/quizz/Quizz';
import { useUserQuizzes } from '@shared/useUserQuizzes';
import type {
  DailyPlanState,
  FilterSelection,
  FreeRevisionFilters,
  SessionMode,
  WeakPointsState,
} from '@domain/session/Session';
import { useRevisionExperience } from './RevisionExperienceProvider';
import styles from './RevisionExperience.module.css';

function classificationChapterOrCourseId(
  question: Parameters<typeof questionClassification>[0],
): string | null {
  const classification = questionClassification(question);
  if (!classification) return null;
  return classification.kind === 'official'
    ? classification.chapterId
    : classification.courseId;
}

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
const difficultyLabels: Readonly<Record<Difficulty, string>> = {
  fundamental: 'Fondamental',
  standard: 'Standard',
  trap: 'Piège',
};
const selection = (value: string): FilterSelection<string> =>
  value === '' ? { kind: 'all' } : { kind: 'one', value };
const selected = (value: FilterSelection<string>) =>
  value.kind === 'all' ? '' : value.value;

export function RevisionDrawerPanel() {
  const experience = useRevisionExperience();
  const { programIndex } = useAppServices();
  const quizzes = useUserQuizzes();
  const quizzIds = new Set(quizzes.map((quizz) => quizz.id));
  const update = (next: FreeRevisionFilters, trigger: HTMLSelectElement) => {
    if (!programIndex) {
      experience.setVisibleFilters(next, trigger);
      return;
    }
    const normalized = normalizeFreeRevisionFilters(
      next,
      programIndex,
      quizzIds,
    );
    if (normalized.ok) experience.setVisibleFilters(normalized.value, trigger);
  };
  const filters = experience.visibleFilters;
  const chapters = programIndex
    ? deriveAvailableChapters(programIndex, filters.part)
    : [];
  const notions = programIndex
    ? deriveAvailableNotions(programIndex, filters.part, filters.chapter)
    : [];
  const selectedQuizzId =
    filters.chapter.kind === 'one' && quizzIds.has(filters.chapter.value)
      ? filters.chapter.value
      : null;
  return (
    <div className={styles.panel}>
      <label className={styles.sessionType}>
        Type de séance
        <select
          value={experience.mode}
          onChange={(event) =>
            experience.setMode(
              event.currentTarget.value as SessionMode,
              event.currentTarget,
            )
          }
        >
          {paths.map((path) => (
            <option key={path.id} value={path.id}>
              {path.label}
            </option>
          ))}
        </select>
      </label>
      {experience.mode === 'free' ? (
        <div className={styles.filters} aria-label="Options de révision libre">
          <label>
            Partie
            <select
              value={selected(filters.part)}
              onChange={(event) =>
                update(
                  { ...filters, part: selection(event.target.value) },
                  event.currentTarget,
                )
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
                update(
                  { ...filters, chapter: selection(event.target.value) },
                  event.currentTarget,
                )
              }
            >
              <option value="">Tous les chapitres</option>
              {filters.part.kind === 'all'
                ? programIndex?.getAllParts().map((part) => {
                    const partChapters = chapters.filter(
                      (chapter) => chapter.partId === part.id,
                    );
                    return partChapters.length > 0 ? (
                      <optgroup key={part.id} label={part.label}>
                        {partChapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })
                : chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.label}
                    </option>
                  ))}
              {quizzes.length > 0 ? (
                <optgroup label="Mes quizz">
                  {quizzes.map((quizz) => (
                    <option key={quizz.id} value={quizz.id}>
                      {quizz.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label>
            Notion
            <select
              value={selectedQuizzId ? '' : selected(filters.notion)}
              disabled={selectedQuizzId !== null}
              onChange={(event) =>
                update(
                  { ...filters, notion: selection(event.target.value) },
                  event.currentTarget,
                )
              }
            >
              <option value="">
                {selectedQuizzId ? 'Sans objet (quizz)' : 'Toutes les notions'}
              </option>
              {notions.map((notion) => {
                return (
                  <option key={notion.id} value={notion.id}>
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
                update(
                  {
                    ...filters,
                    questionType,
                    difficulty:
                      event.target.value === 'reflex'
                        ? { kind: 'not-applicable' }
                        : filters.questionType.kind === 'one' &&
                            filters.questionType.value === 'reflex'
                          ? { kind: 'all' }
                          : filters.difficulty,
                  },
                  event.currentTarget,
                );
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
                  update(
                    {
                      ...filters,
                      difficulty:
                        event.target.value === ''
                          ? { kind: 'all' }
                          : {
                              kind: 'one',
                              value: event.target.value as Difficulty,
                            },
                    },
                    event.currentTarget,
                  )
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
        </div>
      ) : null}
      {experience.mode === 'daily' && experience.state.kind === 'daily' ? (
        <Daily
          state={experience.state.state}
          program={programIndex}
          quizzes={quizzes}
        />
      ) : null}
      {experience.mode === 'weak-points' &&
      experience.state.kind === 'weak-points' ? (
        <Weak
          state={experience.state.state}
          program={programIndex}
          quizzes={quizzes}
          onFree={() => experience.setMode('free')}
        />
      ) : null}
      {experience.mode === 'chapter-test' ? (
        <ChapterTest quizzes={quizzes} />
      ) : null}
    </div>
  );
}

function resolveUnitLabel(
  id: string,
  program: ProgramIndex | null,
  quizzes: readonly Quizz[],
): string {
  return (
    program?.getNotion(id)?.label ??
    quizzes.find((quizz) => quizz.id === id)?.title ??
    'Notion indisponible'
  );
}

function Daily({
  state,
  program,
  quizzes,
}: {
  state: DailyPlanState;
  program: ProgramIndex | null;
  quizzes: readonly Quizz[];
}) {
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
          <strong>{resolveUnitLabel(item.notionId, program, quizzes)}</strong> —{' '}
          {item.successCount}/{item.plannedCount}
          <details>
            <summary>Détails</summary>
            <dl>
              <dt>Raison</dt>
              <dd>{item.reason}</dd>
              <dt>Réussites partielles</dt>
              <dd>{item.partialCount}</dd>
              <dt>Échecs</dt>
              <dd>{item.failedCount}</dd>
              <dt>Difficulté recommandée</dt>
              <dd>{difficultyLabels[item.recommendedDifficulty]}</dd>
              {item.dueAt ? (
                <>
                  <dt>Échéance</dt>
                  <dd>{item.dueAt}</dd>
                </>
              ) : null}
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );
}
function Weak({
  state,
  program,
  quizzes,
  onFree,
}: {
  state: WeakPointsState;
  program: ProgramIndex | null;
  quizzes: readonly Quizz[];
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
          <strong>{resolveUnitLabel(item.notionId, program, quizzes)}</strong> —
          priorité {item.priority} ·{' '}
          {difficultyLabels[item.recommendedDifficulty]}
          <details>
            <summary>Détails</summary>
            <dl>
              <dt>Raison</dt>
              <dd>{item.rationale}</dd>
              {item.lastActivityAt ? (
                <>
                  <dt>Dernière activité</dt>
                  <dd>{item.lastActivityAt}</dd>
                </>
              ) : null}
              <dt>Réussites</dt>
              <dd>{item.successCount}</dd>
              <dt>Réussites partielles</dt>
              <dd>{item.partialCount}</dd>
              <dt>Échecs</dt>
              <dd>{item.failedCount}</dd>
              {item.masteryEstimate !== null ? (
                <>
                  <dt>Maîtrise observée</dt>
                  <dd>{item.masteryEstimate}</dd>
                </>
              ) : null}
              {item.recurringErrors.length > 0 ? (
                <>
                  <dt>Erreurs récurrentes</dt>
                  <dd>
                    <ul>
                      {item.recurringErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
            </dl>
          </details>
        </li>
      ))}
    </ul>
  );
}
function ChapterTest({ quizzes }: { quizzes: readonly Quizz[] }) {
  const { programIndex, questionRepository } = useAppServices();
  const experience = useRevisionExperience();
  const chapters = programIndex?.getAllChapters() ?? [];
  const [chapter, setChapter] = useState('');
  const [quantity, setQuantity] = useState<20 | 40>(20);
  const [confirmation, setConfirmation] = useState<
    'submitted' | 'abandoned' | null
  >(null);
  const confirmationTrigger = useRef<HTMLElement | null>(null);
  const confirmationButton = useRef<HTMLButtonElement | null>(null);
  const cancelConfirmation = () => {
    setConfirmation(null);
    queueMicrotask(() => confirmationTrigger.current?.focus());
  };
  useEffect(() => {
    if (!confirmation) return;
    confirmationButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelConfirmation();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [confirmation]);
  const available = chapter
    ? new Set(
        questionRepository
          .listPublished()
          .filter(
            (question) => classificationChapterOrCourseId(question) === chapter,
          )
          .map((question) => question.id),
      ).size
    : 0;
  return (
    <div>
      {experience.chapterTest ? (
        <>
          <p>
            Question {experience.chapterTest.currentIndex + 1} /{' '}
            {experience.chapterTest.blueprint.questionCount}
          </p>
          {experience.chapterTest.status === 'active' ? (
            <div>
              <button
                type="button"
                disabled={experience.chapterTest.currentIndex === 0}
                onClick={() =>
                  void experience.navigateChapterTest(
                    experience.chapterTest!.currentIndex - 1,
                  )
                }
              >
                Question précédente
              </button>
              <button
                type="button"
                disabled={
                  experience.chapterTest.currentIndex + 1 >=
                  experience.chapterTest.blueprint.questionCount
                }
                onClick={() =>
                  void experience.navigateChapterTest(
                    experience.chapterTest!.currentIndex + 1,
                  )
                }
              >
                Question suivante
              </button>
              <button
                type="button"
                onClick={(event) => {
                  confirmationTrigger.current = event.currentTarget;
                  setConfirmation('submitted');
                }}
              >
                Soumettre le test
              </button>
              <button
                type="button"
                onClick={(event) => {
                  confirmationTrigger.current = event.currentTarget;
                  setConfirmation('abandoned');
                }}
              >
                Abandonner le test
              </button>
            </div>
          ) : (
            <ChapterTestResults />
          )}
          {confirmation ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="chapter-test-confirm-title"
            >
              <h3 id="chapter-test-confirm-title">
                {confirmation === 'submitted'
                  ? 'Soumettre le test ?'
                  : 'Abandonner le test ?'}
              </h3>
              <button
                ref={confirmationButton}
                type="button"
                onClick={() => {
                  void experience.finishChapterTest(confirmation);
                  setConfirmation(null);
                }}
              >
                Confirmer
              </button>
              <button type="button" onClick={cancelConfirmation}>
                Annuler
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
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
              {quizzes.length > 0 ? (
                <optgroup label="Mes quizz">
                  {quizzes.map((quizz) => (
                    <option key={quizz.id} value={quizz.id}>
                      {quizz.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
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
              Ce chapitre ne contient pas encore assez de questions validées
              pour préparer un test de {quantity} questions.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!chapter || available < quantity}
            onClick={() => void experience.startChapterTest(chapter, quantity)}
          >
            Commencer le test
          </button>
        </>
      )}
    </div>
  );
}

function ChapterTestResults() {
  const experience = useRevisionExperience();
  const [counts, setCounts] = useState<{
    success: number;
    partial: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const { evaluationRepository } = useAppServices();
  const blueprint = experience.chapterTest?.blueprint;
  useEffect(() => {
    if (!blueprint) return;
    void evaluationRepository
      .listBySession(blueprint.sessionId, blueprint.userId)
      .then((evaluations) => {
        const next = { success: 0, partial: 0, failed: 0, skipped: 0 };
        evaluations.forEach((evaluation) => {
          next[evaluation.outcome] += 1;
        });
        setCounts(next);
      });
  }, [blueprint, evaluationRepository]);
  if (!blueprint || !counts) return <p>Chargement du résultat…</p>;
  return (
    <dl>
      <dt>Questions</dt>
      <dd>{blueprint.questionCount}</dd>
      <dt>Réussies sans aide</dt>
      <dd>{counts.success}</dd>
      <dt>Réussies avec aide / dépassement</dt>
      <dd>{counts.partial}</dd>
      <dt>Ratées</dt>
      <dd>{counts.failed}</dd>
      <dt>Passées</dt>
      <dd>{counts.skipped}</dd>
    </dl>
  );
}
