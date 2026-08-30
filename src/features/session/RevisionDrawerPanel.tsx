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
import type { DailyActivation } from '@domain/repositories/RevisionStateRepositories';
import { useUserQuizzes, type SelectableQuizz } from '@shared/useUserQuizzes';
import type {
  DailyPlanItem,
  DailyPlanState,
  FilterSelection,
  FreeRevisionFilters,
  SessionMode,
  WeakPointItem,
  WeakPointsState,
} from '@domain/session/Session';
import { Button } from '@design-system/components/Button/Button';
import { Disclosure } from '@design-system/components/Disclosure/Disclosure';
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
  const update = (next: FreeRevisionFilters, trigger: HTMLElement) => {
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
  const [source, setSource] = useState<'official' | 'personal'>(() =>
    selectedQuizzId !== null ? 'personal' : 'official',
  );
  const setSourceAndReset = (
    next: 'official' | 'personal',
    trigger: HTMLElement,
  ) => {
    setSource(next);
    update(
      { ...filters, chapter: { kind: 'all' }, notion: { kind: 'all' } },
      trigger,
    );
  };
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
          {quizzes.length > 0 ? (
            <div
              className={styles.sourceToggle}
              role="group"
              aria-label="Source des questions"
            >
              <button
                type="button"
                aria-pressed={source === 'official'}
                onClick={(event) =>
                  setSourceAndReset('official', event.currentTarget)
                }
              >
                Programme officiel
              </button>
              <button
                type="button"
                aria-pressed={source === 'personal'}
                onClick={(event) =>
                  setSourceAndReset('personal', event.currentTarget)
                }
              >
                Mes quizz
              </button>
            </div>
          ) : null}
          {source === 'official' ? (
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
          ) : null}
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
              {source === 'official' ? (
                <>
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
                </>
              ) : (
                <>
                  <option value="">Tous mes quizz</option>
                  {quizzes.map((quizz) => (
                    <option key={quizz.id} value={quizz.id}>
                      {quizz.title}
                    </option>
                  ))}
                </>
              )}
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
      {(experience.mode === 'daily' || experience.mode === 'weak-points') &&
      experience.activeSeries ? (
        <SeriesControls />
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
  quizzes: readonly SelectableQuizz[],
): string {
  return (
    program?.getNotion(id)?.label ??
    quizzes.find((quizz) => quizz.id === id)?.title ??
    'Notion indisponible'
  );
}

function Bubble({
  label,
  meta,
  onClick,
}: {
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.bubble} onClick={onClick}>
      <span className={styles.bubbleLabel}>{label}</span>
      <span className={styles.bubbleMeta}>{meta}</span>
    </button>
  );
}

function SeriesControls() {
  const experience = useRevisionExperience();
  const series = experience.activeSeries;
  if (!series) return null;
  const heading =
    series.blueprint.kind === 'daily' ? 'Révision du jour' : 'Consolidation';
  return (
    <div className={styles.seriesControls}>
      <p>
        <strong>{heading}</strong> — {series.blueprint.unitLabel}
      </p>
      <p>
        Question {series.currentIndex + 1} /{' '}
        {series.blueprint.orderedQuestionInstances.length}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => experience.exitSeries()}
      >
        Quitter la série
      </Button>
    </div>
  );
}

function DailyActivationForm({
  program,
  quizzes,
  activatedIds,
  onActivate,
}: {
  program: ProgramIndex | null;
  quizzes: readonly SelectableQuizz[];
  activatedIds: ReadonlySet<string>;
  onActivate: (unitId: string) => void;
}) {
  const [source, setSource] = useState<'official' | 'personal'>('official');
  const [chapter, setChapter] = useState('');
  const [notion, setNotion] = useState('');
  const [quizzId, setQuizzId] = useState('');
  const chapters = program
    ? deriveAvailableChapters(program, { kind: 'all' })
    : [];
  const notions =
    program && chapter
      ? deriveAvailableNotions(program, { kind: 'all' }, selection(chapter))
      : [];
  const unitId = source === 'official' ? notion : quizzId;
  const canActivate = unitId !== '' && !activatedIds.has(unitId);
  const activate = () => {
    if (!canActivate) return;
    onActivate(unitId);
    setNotion('');
    setQuizzId('');
  };
  return (
    <div className={styles.filters} aria-label="Activer une révision régulière">
      {quizzes.length > 0 ? (
        <div
          className={styles.sourceToggle}
          role="group"
          aria-label="Source des questions"
        >
          <button
            type="button"
            aria-pressed={source === 'official'}
            onClick={() => setSource('official')}
          >
            Programme officiel
          </button>
          <button
            type="button"
            aria-pressed={source === 'personal'}
            onClick={() => setSource('personal')}
          >
            Mes quizz
          </button>
        </div>
      ) : null}
      {source === 'official' ? (
        <>
          <label>
            Chapitre
            <select
              value={chapter}
              onChange={(event) => {
                setChapter(event.target.value);
                setNotion('');
              }}
            >
              <option value="">Choisir un chapitre</option>
              {chapters.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Notion
            <select
              value={notion}
              disabled={!chapter}
              onChange={(event) => setNotion(event.target.value)}
            >
              <option value="">Choisir une notion</option>
              {notions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label>
          Quizz
          <select
            value={quizzId}
            onChange={(event) => setQuizzId(event.target.value)}
          >
            <option value="">Choisir un quizz</option>
            {quizzes.map((quizz) => (
              <option key={quizz.id} value={quizz.id}>
                {quizz.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={!canActivate}
        onClick={activate}
      >
        Activer
      </Button>
    </div>
  );
}

function Daily({
  state,
  program,
  quizzes,
}: {
  state: DailyPlanState;
  program: ProgramIndex | null;
  quizzes: readonly SelectableQuizz[];
}) {
  const experience = useRevisionExperience();
  const [activations, setActivations] = useState<readonly DailyActivation[]>(
    [],
  );
  useEffect(() => {
    let cancelled = false;
    void experience.listDailyActivations().then((list) => {
      if (!cancelled) setActivations(list);
    });
    return () => {
      cancelled = true;
    };
  }, [experience, state]);
  const activatedIds = new Set(
    activations.map((activation) => activation.unitId),
  );
  const items =
    state.kind === 'ready' || state.kind === 'completed' ? state.items : [];
  const due = items.filter((item) => item.successCount < item.plannedCount);
  const start = (item: DailyPlanItem) =>
    void experience.startDailyItem(
      item,
      resolveUnitLabel(item.notionId, program, quizzes),
    );
  return (
    <>
      {state.kind === 'none-scheduled' ? (
        <p>Aucune révision n’est prévue aujourd’hui. Tu es à jour.</p>
      ) : null}
      {state.kind === 'completed' ? (
        <p>
          Révision du jour terminée. Toutes les notions prévues ont été
          révisées.
        </p>
      ) : null}
      {state.kind === 'unavailable' ? <p>{state.message}</p> : null}
      {due.length > 0 ? (
        <div className={styles.bubbleGrid}>
          {due.map((item) => (
            <Bubble
              key={item.notionId}
              label={resolveUnitLabel(item.notionId, program, quizzes)}
              meta={`${item.plannedCount - item.successCount} à faire aujourd’hui · ${difficultyLabels[item.recommendedDifficulty]}`}
              onClick={() => start(item)}
            />
          ))}
        </div>
      ) : null}
      <Disclosure label="Gérer mes révisions régulières">
        <DailyActivationForm
          program={program}
          quizzes={quizzes}
          activatedIds={activatedIds}
          onActivate={(unitId) => void experience.activateDailyUnit(unitId)}
        />
        {activations.length > 0 ? (
          <ul className={styles.activationList}>
            {activations.map((activation) => (
              <li key={activation.unitId}>
                {resolveUnitLabel(activation.unitId, program, quizzes)}
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    void experience.deactivateDailyUnit(activation.unitId)
                  }
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Disclosure>
    </>
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
  quizzes: readonly SelectableQuizz[];
  onFree: () => void;
}) {
  const experience = useRevisionExperience();
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
  const start = (item: WeakPointItem) =>
    void experience.startConsolidationItem(
      item,
      resolveUnitLabel(item.notionId, program, quizzes),
    );
  return (
    <div className={styles.bubbleGrid}>
      {state.items.map((item) => (
        <Bubble
          key={item.notionId}
          label={resolveUnitLabel(item.notionId, program, quizzes)}
          meta={`Priorité ${item.priority} · ${difficultyLabels[item.recommendedDifficulty]}`}
          onClick={() => start(item)}
        />
      ))}
    </div>
  );
}
function ChapterTest({ quizzes }: { quizzes: readonly SelectableQuizz[] }) {
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
