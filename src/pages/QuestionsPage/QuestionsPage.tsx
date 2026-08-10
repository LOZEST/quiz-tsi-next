import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { EmptyState } from '@design-system/components/EmptyState/EmptyState';
import {
  searchAndFilterQuestions,
  type QuestionBankFilters,
} from '@domain/questions/QuestionBankSearch';
import {
  officialClassification,
  questionClassification,
  type ContentSegment,
  type Question,
  type SafeExpressionNode,
  type VariableDefinition,
} from '@domain/questions/Question';
import { validateQuestionForReview } from '@domain/questions/QuestionAuthoringValidation';
import { validateParameterizedQuestion } from '@domain/questions/QuestionParameterValidation';
import {
  MATH_SYMBOL_REGISTRY_V1,
  MATH_SYNTAX_REGISTRY_V1,
} from '@domain/math/MathSyntaxRegistry';
import { parseMathSourceText } from '@domain/math/MathParser';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
import type { QuestionWorkspaceRepository } from '@domain/repositories/QuestionWorkspaceRepository';
import type { ProgramIndex } from '@domain/program/Program';
import styles from './QuestionsPage.module.css';
import { syncQuestionWorkspace } from '@features/questions/syncQuestionWorkspace';

const emptySnapshot: QuestionWorkspaceSnapshot = {
  questions: [],
  courses: [],
  chapters: [],
  notions: [],
  pendingOperationCount: 0,
  conflicts: [],
};
const labels = {
  static: 'Officielle',
  private: 'Ma banque',
  shared: 'Partagée',
} as const;

export function QuestionsPage() {
  const { state } = useAuth();
  const {
    questionRepository,
    questionWorkspaceRepository,
    questionRemoteGateway,
    programIndex,
  } = useAppServices();
  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  const [workspace, setWorkspace] =
    useState<QuestionWorkspaceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<QuestionBankFilters>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<
    readonly { path: string; message: string }[]
  >([]);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncState, setSyncState] = useState<
    'idle' | 'syncing' | 'denied' | 'error'
  >('idle');
  const reload = useCallback(async () => {
    try {
      if (userId) setWorkspace(await questionWorkspaceRepository.load(userId));
    } catch (reason) {
      setWorkspace(emptySnapshot);
      setStorageError(
        reason instanceof Error
          ? reason.message
          : 'Stockage local inaccessible.',
      );
    } finally {
      setLoading(false);
    }
  }, [questionWorkspaceRepository, userId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const online = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', off);
    };
  }, []);
  const synchronize = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    setSyncState('syncing');
    try {
      const result = await syncQuestionWorkspace(
        userId,
        questionWorkspaceRepository,
        questionRemoteGateway,
      );
      setSyncState(result.permissionDenied ? 'denied' : 'idle');
      await reload();
    } catch {
      setSyncState('error');
    }
  }, [questionRemoteGateway, questionWorkspaceRepository, reload, userId]);
  useEffect(() => {
    if (userId && navigator.onLine) void synchronize();
  }, [synchronize, userId]);
  const all = useMemo(
    () => [...questionRepository.listPublished(), ...workspace.questions],
    [questionRepository, workspace.questions],
  );
  const results = useMemo(
    () =>
      searchAndFilterQuestions({
        questions: all,
        search,
        filters,
        program: programIndex,
        courses: workspace.courses,
        chapters: workspace.chapters,
        notions: workspace.notions,
      }),
    [all, search, filters, programIndex, workspace],
  );
  const selected = all.find((question) => question.id === selectedId) ?? null;
  const mutate = async (
    question: Readonly<Question>,
    kind: 'create' | 'update' | 'archive' | 'publish',
  ) => {
    await questionWorkspaceRepository.saveQuestion(
      userId,
      question,
      kind,
      crypto.randomUUID(),
    );
    setSelectedId(question.id);
    await reload();
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Banque de questions"
        description="Recherche, création et relecture de tes questions, même hors connexion."
      />
      {offline ? (
        <p className={styles.banner} role="status">
          Hors connexion — les brouillons restent enregistrés sur cet appareil.
        </p>
      ) : null}
      {storageError ? <p role="alert">{storageError}</p> : null}
      {reviewErrors.length ? (
        <ul role="alert">
          {reviewErrors.map((entry) => (
            <li key={`${entry.path}:${entry.message}`}>
              {entry.path} — {entry.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.actions}>
        <button type="button" onClick={() => setEditing(true)}>
          Créer une question
        </button>
        <button
          type="button"
          onClick={() =>
            (
              document.getElementById(
                'question-help',
              ) as HTMLDialogElement | null
            )?.showModal()
          }
        >
          Aide
        </button>
        <button
          type="button"
          disabled={offline || syncState === 'syncing'}
          onClick={() => void synchronize()}
        >
          {syncState === 'syncing' ? 'Synchronisation…' : 'Synchroniser'}
        </button>
        {workspace.pendingOperationCount ? (
          <span>{workspace.pendingOperationCount} en attente</span>
        ) : null}
        {syncState === 'denied' ? (
          <span role="alert">Permission serveur refusée.</span>
        ) : syncState === 'error' ? (
          <span role="alert">
            Synchronisation impossible; le brouillon local est conservé.
          </span>
        ) : null}
      </div>
      <div className={styles.filters}>
        <label>
          Recherche
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Énoncé, taxonomie ou tag"
          />
        </label>
        <label>
          Source
          <select
            value={filters.source ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                source: event.target.value
                  ? (event.target.value as Question['source'])
                  : undefined,
              }))
            }
          >
            <option value="">Toutes</option>
            <option value="static">Officielle</option>
            <option value="private">Ma banque</option>
            <option value="shared">Partagée</option>
          </select>
        </label>
        <label>
          Partie / Cours
          <select
            value={filters.courseOrPartId ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                courseOrPartId: event.target.value || undefined,
                chapterId: undefined,
                notionId: undefined,
              }))
            }
          >
            <option value="">Toutes les parties et tous les cours</option>
            {programIndex?.getAllParts().map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            {workspace.courses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chapitre
          <select
            value={filters.chapterId ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                chapterId: event.target.value || undefined,
                notionId: undefined,
              }))
            }
          >
            <option value="">Tous les chapitres</option>
            {programIndex?.getAllChapters().map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            {workspace.chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notion
          <select
            value={filters.notionId ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                notionId: event.target.value || undefined,
              }))
            }
          >
            <option value="">Toutes les notions</option>
            {programIndex?.getAllNotions().map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
            {workspace.notions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            value={filters.type ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                type: event.target.value
                  ? (event.target.value as Question['type'])
                  : undefined,
              }))
            }
          >
            <option value="">Tous</option>
            <option value="formula">Formules</option>
            <option value="course">Cours</option>
            <option value="calculation">Calcul</option>
            <option value="reflex">Réflexe</option>
          </select>
        </label>
        <label>
          Difficulté
          <select
            value={filters.difficulty ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                difficulty: event.target.value
                  ? (event.target.value as Exclude<
                      Question['difficulty'],
                      null
                    >)
                  : undefined,
              }))
            }
          >
            <option value="">Toutes</option>
            <option value="fundamental">Fondamental</option>
            <option value="standard">Standard</option>
            <option value="trap">Piège</option>
          </select>
        </label>
        <label>
          Statut
          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                status: event.target.value
                  ? (event.target.value as Question['status'])
                  : undefined,
              }))
            }
          >
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Chargement de la banque…</p>
      ) : results.length === 0 ? (
        <EmptyState
          title={all.length ? 'Aucun résultat' : 'Ta banque est vide'}
          message={
            all.length
              ? 'Aucune question ne correspond à la recherche et aux filtres.'
              : 'Crée une première question ; elle sera disponible hors connexion.'
          }
        />
      ) : (
        <div className={styles.layout}>
          <ul className={styles.list}>
            {results.map((question) => (
              <li key={`${question.id}:${question.version}`}>
                <button
                  type="button"
                  onClick={() => setSelectedId(question.id)}
                  aria-pressed={selectedId === question.id}
                >
                  <span>
                    {question.prompt.find((segment) => segment.kind === 'text')
                      ?.value ?? 'Question mathématique'}
                  </span>
                  <small>
                    {labels[question.source]} ·{' '}
                    {question.status === 'draft'
                      ? 'Brouillon'
                      : question.status === 'archived'
                        ? 'Archivée'
                        : 'Publiée'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          <section className={styles.preview} aria-label="Aperçu">
            {selected ? (
              <QuestionPreview
                question={selected}
                onEdit={() => setEditing(true)}
                onDuplicate={() => {
                  const now = new Date().toISOString();
                  void mutate(
                    {
                      ...selected,
                      id: crypto.randomUUID(),
                      version: 1,
                      source: 'private',
                      ownerId: userId,
                      status: 'draft',
                      validated: false,
                      createdAt: now,
                      updatedAt: now,
                    },
                    'create',
                  );
                }}
                onReview={() => {
                  const errors = validateQuestionForReview(selected);
                  setReviewErrors(errors);
                  if (!errors.length)
                    void mutate(
                      {
                        ...selected,
                        version: selected.version + 1,
                        validated: true,
                        updatedAt: new Date().toISOString(),
                      },
                      'update',
                    );
                }}
                onPublish={() => {
                  const errors = validateQuestionForReview(selected);
                  setReviewErrors(errors);
                  if (!errors.length)
                    void mutate(
                      {
                        ...selected,
                        version: selected.version + 1,
                        source: 'shared',
                        status: 'published',
                        updatedAt: new Date().toISOString(),
                      },
                      'publish',
                    );
                }}
                onArchive={() =>
                  void mutate(
                    {
                      ...selected,
                      version: selected.version + 1,
                      status: 'archived',
                      updatedAt: new Date().toISOString(),
                    },
                    'archive',
                  )
                }
              />
            ) : (
              <p>Sélectionne une question pour afficher son aperçu.</p>
            )}
          </section>
        </div>
      )}
      {workspace.conflicts.map((conflict) => (
        <section key={conflict.id} className={styles.conflict}>
          <h2>Conflit à résoudre</h2>
          <p>
            Ta version et la version serveur restent disponibles avant ton
            choix.
          </p>
          <details>
            <summary>Ma version</summary>
            <pre>{JSON.stringify(conflict.local.prompt, null, 2)}</pre>
          </details>
          <details>
            <summary>Version serveur</summary>
            <pre>{JSON.stringify(conflict.remote.prompt, null, 2)}</pre>
          </details>
          <div className={styles.actions}>
            {(['local', 'remote', 'duplicate'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => {
                  void questionWorkspaceRepository
                    .resolveConflict(userId, conflict.id, choice)
                    .then(reload);
                }}
              >
                {choice === 'local'
                  ? 'Conserver ma version'
                  : choice === 'remote'
                    ? 'Utiliser la version serveur'
                    : 'Dupliquer ma version'}
              </button>
            ))}
          </div>
        </section>
      ))}
      {editing ? (
        <QuestionEditor
          initial={selected?.source === 'static' ? null : selected}
          userId={userId}
          programIndex={programIndex}
          workspace={workspace}
          repository={questionWorkspaceRepository}
          onCancel={() => setEditing(false)}
          onSave={async (question, kind) => {
            await questionWorkspaceRepository.saveQuestion(
              userId,
              question,
              kind,
              crypto.randomUUID(),
            );
            setEditing(false);
            setSelectedId(question.id);
            await reload();
          }}
        />
      ) : null}
      <dialog id="question-help">
        <h2>Créer une question</h2>
        <p>
          Ajoute du texte et des formules MathSource, puis vérifie les variantes
          avant publication.
        </p>
        <h3>Raccourcis</h3>
        <ul>
          {MATH_SYNTAX_REGISTRY_V1.map((item) => (
            <li key={item.id}>
              <code>{item.syntax}</code> — {item.description}
            </li>
          ))}
        </ul>
        <form method="dialog">
          <button>Fermer</button>
        </form>
      </dialog>
    </div>
  );
}

function QuestionPreview({
  question,
  onEdit,
  onDuplicate,
  onReview,
  onPublish,
  onArchive,
}: {
  question: Readonly<Question>;
  onEdit: () => void;
  onDuplicate: () => void;
  onReview: () => void;
  onPublish: () => void;
  onArchive: () => void;
}) {
  const classification = questionClassification(question);
  const imported = question.provenance?.chatGptImport;
  return (
    <>
      <h2>Aperçu</h2>
      {imported ? (
        <section className={styles.importReview}>
          <strong>Import ChatGPT — À vérifier</strong>
          <p>Couverture : {imported.coverage}</p>
          {imported.coverage !== 'text-and-visuals' ? (
            <p role="alert">
              {imported.coverage === 'incomplete'
                ? 'Analyse incomplète : vérifie attentivement le document.'
                : 'Les visuels n’ont pas été analysés.'}
            </p>
          ) : null}
          <ul>
            {imported.uncertainties.map((item, index) => (
              <li key={`${item.path}:${index}`}>
                {item.message} ({item.path})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p>
        {question.prompt
          .map((segment) =>
            segment.kind === 'text'
              ? segment.value
              : segment.kind === 'line-break'
                ? '\n'
                : segment.math.source,
          )
          .join(' ')}
      </p>
      <p>
        {classification?.kind === 'official'
          ? `${classification.chapterId} · ${classification.notionId}`
          : `Cours personnel · ${classification?.courseId ?? ''}`}
      </p>
      <div className={styles.actions}>
        {question.source !== 'static' ? (
          <button type="button" onClick={onEdit}>
            Modifier
          </button>
        ) : null}
        <button type="button" onClick={onDuplicate}>
          Dupliquer
        </button>
        {question.source !== 'static' && question.status !== 'archived' ? (
          <button type="button" onClick={onArchive}>
            Archiver
          </button>
        ) : null}
        {question.source !== 'static' && !question.validated ? (
          <button type="button" onClick={onReview}>
            Valider la relecture
          </button>
        ) : null}
        {question.source === 'private' &&
        question.status === 'draft' &&
        question.validated ? (
          <button type="button" onClick={onPublish}>
            Partager
          </button>
        ) : null}
      </div>
    </>
  );
}

function QuestionEditor({
  initial,
  userId,
  programIndex,
  workspace,
  repository,
  onCancel,
  onSave,
}: {
  initial: Readonly<Question> | null;
  userId: string;
  programIndex: ProgramIndex | null;
  workspace: QuestionWorkspaceSnapshot;
  repository: QuestionWorkspaceRepository;
  onCancel: () => void;
  onSave: (question: Question, kind: 'create' | 'update') => Promise<void>;
}) {
  const [segments, setSegments] = useState<ContentSegment[]>(
    initial ? [...initial.prompt] : [{ kind: 'text', value: '' }],
  );
  const [hint, setHint] = useState(
    initial?.hint.find((item) => item.kind === 'text')?.value ?? '',
  );
  const [correction, setCorrection] = useState(
    initial?.correction[0]?.content.find((item) => item.kind === 'text')
      ?.value ?? '',
  );
  const [variable, setVariable] = useState('');
  const [variableLabel, setVariableLabel] = useState('');
  const [domainKind, setDomainKind] = useState<
    'integer' | 'decimal' | 'choice'
  >('integer');
  const [domainMinimum, setDomainMinimum] = useState('1');
  const [domainMaximum, setDomainMaximum] = useState('10');
  const [domainDecimals, setDomainDecimals] = useState('2');
  const [choiceValues, setChoiceValues] = useState('1, 2');
  const [variables, setVariables] = useState<VariableDefinition[]>(
    initial?.parameterization?.variables
      ? [...initial.parameterization.variables]
      : [],
  );
  const [constraints, setConstraints] = useState<SafeExpressionNode[]>(
    initial?.parameterization?.constraints
      ? [...initial.parameterization.constraints]
      : [],
  );
  const [constraintLeft, setConstraintLeft] = useState('');
  const [constraintOperator, setConstraintOperator] = useState<
    | 'equal'
    | 'not-equal'
    | 'less-than'
    | 'less-than-or-equal'
    | 'greater-than'
    | 'greater-than-or-equal'
  >('not-equal');
  const [constraintRightKind, setConstraintRightKind] = useState<
    'literal' | 'variable'
  >('literal');
  const [constraintRight, setConstraintRight] = useState('0');
  const existingClassification = initial
    ? questionClassification(initial)
    : null;
  const [classificationKind, setClassificationKind] = useState<
    'official' | 'personal'
  >(existingClassification?.kind ?? 'official');
  const [partId, setPartId] = useState(
    existingClassification?.kind === 'official'
      ? existingClassification.partId
      : '',
  );
  const [chapterId, setChapterId] = useState(
    existingClassification?.kind === 'official'
      ? existingClassification.chapterId
      : '',
  );
  const [notionId, setNotionId] = useState(
    existingClassification?.kind === 'official'
      ? existingClassification.notionId
      : '',
  );
  const [courseId, setCourseId] = useState(
    existingClassification?.kind === 'personal'
      ? existingClassification.courseId
      : '',
  );
  const [personalChapterId, setPersonalChapterId] = useState(
    existingClassification?.kind === 'personal'
      ? (existingClassification.chapterId ?? '')
      : '',
  );
  const [personalNotionId, setPersonalNotionId] = useState(
    existingClassification?.kind === 'personal'
      ? (existingClassification.notionId ?? '')
      : '',
  );
  const [personalCourseTitle, setPersonalCourseTitle] = useState('');
  const [personalChapterTitle, setPersonalChapterTitle] = useState('');
  const [personalNotionTitle, setPersonalNotionTitle] = useState('');
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [variantPreview, setVariantPreview] = useState<readonly string[]>([]);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const activeMath = useRef<HTMLInputElement | null>(null);
  const add = (segment: ContentSegment) =>
    setSegments((value) => [...value, segment]);
  const insertSymbol = (symbol: string) => {
    const input = activeMath.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const source = `${input.value.slice(0, start)}${symbol}${input.value.slice(end)}`;
    input.value = source;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() =>
      input.setSelectionRange(start + symbol.length, start + symbol.length),
    );
  };
  const buildClassification = async () => {
    if (classificationKind === 'official') {
      if (!partId || !chapterId || !notionId) return null;
      return officialClassification(partId, chapterId, notionId);
    }
    let resolvedCourseId = courseId;
    if (!resolvedCourseId && personalCourseTitle.trim()) {
      resolvedCourseId = crypto.randomUUID();
      const now = new Date().toISOString();
      await repository.savePersonalCourse(userId, {
        id: resolvedCourseId,
        ownerId: userId,
        title: personalCourseTitle.trim(),
        createdAt: now,
        updatedAt: now,
      });
      setCourseId(resolvedCourseId);
    }
    if (!resolvedCourseId) return null;
    let resolvedChapterId: string | null = personalChapterId || null;
    let resolvedNotionId: string | null = personalNotionId || null;
    if (personalChapterTitle.trim()) {
      resolvedChapterId = crypto.randomUUID();
      const now = new Date().toISOString();
      await repository.savePersonalChapter(userId, {
        id: resolvedChapterId,
        ownerId: userId,
        courseId: resolvedCourseId,
        title: personalChapterTitle.trim(),
        createdAt: now,
        updatedAt: now,
      });
    }
    if (personalNotionTitle.trim()) {
      resolvedNotionId = crypto.randomUUID();
      const now = new Date().toISOString();
      await repository.savePersonalNotion(userId, {
        id: resolvedNotionId,
        ownerId: userId,
        courseId: resolvedCourseId,
        chapterId: resolvedChapterId,
        title: personalNotionTitle.trim(),
        createdAt: now,
        updatedAt: now,
      });
    }
    return {
      kind: 'personal' as const,
      courseId: resolvedCourseId,
      chapterId: resolvedChapterId,
      notionId: resolvedNotionId,
    };
  };
  const buildQuestion = async (): Promise<Question | null> => {
    const classification = await buildClassification();
    if (!classification) {
      setEditorErrors(['Une classification valide est obligatoire.']);
      return null;
    }
    const now = new Date().toISOString();
    const first = initial ?? null;
    return {
      id: first?.id ?? crypto.randomUUID(),
      version: first ? first.version + 1 : 1,
      source: 'private',
      ownerId: userId,
      status: 'draft',
      validated: false,
      provenance: first?.provenance ?? null,
      classification,
      type: first?.type ?? 'course',
      difficulty: first?.difficulty ?? 'standard',
      parameterization: variables.length
        ? {
            schemaVersion: 1,
            variables,
            constraints,
            validationVariantCount: 10,
          }
        : null,
      prompt: segments,
      hint: hint ? [{ kind: 'text', value: hint }] : [],
      correction: [
        {
          id: 'step-1',
          title: null,
          content: [{ kind: 'text', value: correction }],
        },
      ],
      tags: [],
      createdAt: first?.createdAt ?? now,
      updatedAt: now,
    };
  };
  const save = async () => {
    const question = await buildQuestion();
    if (!question) return;
    await onSave(question, initial ? 'update' : 'create');
  };
  return (
    <div className={styles.editorBackdrop}>
      <section
        className={styles.editor}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <h2 id="editor-title">
          {initial ? 'Modifier la question' : 'Nouvelle question'}
        </h2>
        <div className={styles.editorFooter}>
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" onClick={() => void save()}>
            Enregistrer le brouillon
          </button>
        </div>
        {editorErrors.length ? (
          <ul role="alert">
            {editorErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <fieldset>
          <legend>Classification</legend>
          <label>
            Type de classification
            <select
              aria-label="Type de classification"
              value={classificationKind}
              onChange={(event) =>
                setClassificationKind(
                  event.target.value as 'official' | 'personal',
                )
              }
            >
              <option value="official">Programme officiel</option>
              <option value="personal">Cours personnel</option>
            </select>
          </label>
          {classificationKind === 'official' ? (
            <>
              <label>
                Partie
                <select
                  value={partId}
                  onChange={(event) => {
                    setPartId(event.target.value);
                    setChapterId('');
                    setNotionId('');
                  }}
                >
                  <option value="">Choisir</option>
                  {programIndex?.getAllParts().map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chapitre
                <select
                  value={chapterId}
                  onChange={(event) => {
                    setChapterId(event.target.value);
                    setNotionId('');
                  }}
                >
                  <option value="">Choisir</option>
                  {programIndex?.getChaptersForPart(partId).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notion
                <select
                  value={notionId}
                  onChange={(event) => setNotionId(event.target.value)}
                >
                  <option value="">Choisir</option>
                  {programIndex?.getNotionsForChapter(chapterId).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Cours
                <select
                  value={courseId}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                    setPersonalChapterId('');
                    setPersonalNotionId('');
                  }}
                >
                  <option value="">Créer un cours</option>
                  {workspace.courses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {!courseId ? (
                <label>
                  Nouveau cours
                  <input
                    value={personalCourseTitle}
                    onChange={(event) =>
                      setPersonalCourseTitle(event.target.value)
                    }
                  />
                </label>
              ) : null}
              {courseId ? (
                <label>
                  Chapitre existant facultatif
                  <select
                    value={personalChapterId}
                    onChange={(event) => {
                      setPersonalChapterId(event.target.value);
                      setPersonalNotionId('');
                    }}
                  >
                    <option value="">Aucun</option>
                    {workspace.chapters
                      .filter((item) => item.courseId === courseId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {courseId ? (
                <label>
                  Notion existante facultative
                  <select
                    value={personalNotionId}
                    onChange={(event) =>
                      setPersonalNotionId(event.target.value)
                    }
                  >
                    <option value="">Aucune</option>
                    {workspace.notions
                      .filter(
                        (item) =>
                          item.courseId === courseId &&
                          (!personalChapterId ||
                            item.chapterId === personalChapterId),
                      )
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              <label>
                Nouveau chapitre facultatif
                <input
                  value={personalChapterTitle}
                  onChange={(event) =>
                    setPersonalChapterTitle(event.target.value)
                  }
                />
              </label>
              <label>
                Nouvelle notion facultative
                <input
                  value={personalNotionTitle}
                  onChange={(event) =>
                    setPersonalNotionTitle(event.target.value)
                  }
                />
              </label>
            </>
          )}
        </fieldset>
        <div className={styles.segmentList}>
          {segments.map((segment, index) =>
            segment.kind === 'text' ? (
              <label key={index}>
                Texte
                <textarea
                  value={segment.value}
                  onChange={(event) =>
                    setSegments((items) =>
                      items.map((item, position) =>
                        position === index
                          ? { kind: 'text', value: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            ) : segment.kind === 'line-break' ? (
              <p key={index}>Saut de ligne</p>
            ) : (
              <label key={index}>
                {segment.kind === 'inline-math'
                  ? 'Formule en ligne'
                  : 'Formule affichée'}
                <input
                  ref={(node) => {
                    if (node) activeMath.current = node;
                  }}
                  value={segment.math.source}
                  onFocus={(event) => {
                    activeMath.current = event.currentTarget;
                  }}
                  onChange={(event) =>
                    setSegments((items) =>
                      items.map((item, position) =>
                        position === index
                          ? {
                              ...segment,
                              math: {
                                syntaxVersion: 1,
                                source: event.target.value,
                              },
                            }
                          : item,
                      ),
                    )
                  }
                />
                <MathError source={segment.math.source} />
              </label>
            ),
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => add({ kind: 'text', value: '' })}
          >
            + Texte
          </button>
          <button
            type="button"
            onClick={() =>
              add({
                kind: 'inline-math',
                math: { syntaxVersion: 1, source: 'x^2' },
              })
            }
          >
            + Formule
          </button>
          <button
            type="button"
            onClick={() =>
              add({
                kind: 'display-math',
                math: { syntaxVersion: 1, source: 'x^2' },
              })
            }
          >
            + Formule affichée
          </button>
          <button type="button" onClick={() => add({ kind: 'line-break' })}>
            + Saut de ligne
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowKeyboard((value) => !value)}
        >
          Clavier mathématique
        </button>
        {showKeyboard ? (
          <div className={styles.mathKeyboard}>
            {MATH_SYMBOL_REGISTRY_V1.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-label={`${item.symbol} — ${item.label}`}
                title={`${item.symbol} — ${item.label}`}
                onClick={() => insertSymbol(item.symbol)}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setShowShortcuts((value) => !value)}
        >
          Raccourcis
        </button>
        {showShortcuts ? (
          <ul>
            {MATH_SYNTAX_REGISTRY_V1.map((item) => (
              <li key={item.id}>
                <code>{item.example}</code> — {item.description}
              </li>
            ))}
          </ul>
        ) : null}
        <label>
          Indice
          <textarea
            value={hint}
            onChange={(event) => setHint(event.target.value)}
          />
        </label>
        <label>
          Correction
          <textarea
            value={correction}
            onChange={(event) => setCorrection(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>Assistant de variables</legend>
          <label>
            Nom
            <input
              value={variable}
              onChange={(event) =>
                setVariable(event.target.value.replace(/[^A-Za-z0-9_]/g, ''))
              }
            />
          </label>
          <label>
            Libellé
            <input
              value={variableLabel}
              onChange={(event) => setVariableLabel(event.target.value)}
            />
          </label>
          <label>
            Domaine
            <select
              value={domainKind}
              onChange={(event) =>
                setDomainKind(event.target.value as typeof domainKind)
              }
            >
              <option value="integer">Entier</option>
              <option value="decimal">Décimal</option>
              <option value="choice">Choix</option>
            </select>
          </label>
          {domainKind === 'choice' ? (
            <label>
              Valeurs séparées par des virgules
              <input
                value={choiceValues}
                onChange={(event) => setChoiceValues(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Minimum
                <input
                  type="number"
                  value={domainMinimum}
                  onChange={(event) => setDomainMinimum(event.target.value)}
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  value={domainMaximum}
                  onChange={(event) => setDomainMaximum(event.target.value)}
                />
              </label>
              {domainKind === 'decimal' ? (
                <label>
                  Décimales
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={domainDecimals}
                    onChange={(event) => setDomainDecimals(event.target.value)}
                  />
                </label>
              ) : null}
            </>
          )}
          <button
            type="button"
            disabled={!variable || !variableLabel.trim()}
            onClick={() => {
              const domain: VariableDefinition['domain'] =
                domainKind === 'choice'
                  ? {
                      kind: 'choice' as const,
                      values: choiceValues
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .map((value) =>
                          Number.isNaN(Number(value)) ? value : Number(value),
                        ),
                    }
                  : domainKind === 'integer'
                    ? {
                        kind: 'integer' as const,
                        minimum: Number(domainMinimum),
                        maximum: Number(domainMaximum),
                        step: 1,
                        excludedValues: [],
                      }
                    : {
                        kind: 'decimal' as const,
                        minimum: Number(domainMinimum),
                        maximum: Number(domainMaximum),
                        decimals: Number(domainDecimals),
                        excludedValues: [],
                      };
              setVariables((items) => [
                ...items.filter((item) => item.id !== variable),
                { id: variable, label: variableLabel.trim(), domain },
              ]);
            }}
          >
            Définir la variable
          </button>
          {variables.length ? (
            <ul>
              {variables.map((item) => (
                <li key={item.id}>
                  @{item.id} — {item.label} ({item.domain.kind})
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={!variables.some((item) => item.id === variable)}
            onClick={() => add({ kind: 'text', value: `@${variable}` })}
          >
            Insérer @{variable || 'nom'}
          </button>
          <fieldset>
            <legend>Contrainte visuelle</legend>
            <label>
              Variable gauche
              <select
                value={constraintLeft}
                onChange={(event) => setConstraintLeft(event.target.value)}
              >
                <option value="">Choisir</option>
                {variables.map((item) => (
                  <option key={item.id} value={item.id}>
                    @{item.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opérateur
              <select
                value={constraintOperator}
                onChange={(event) =>
                  setConstraintOperator(
                    event.target.value as typeof constraintOperator,
                  )
                }
              >
                <option value="equal">=</option>
                <option value="not-equal">≠</option>
                <option value="less-than">&lt;</option>
                <option value="less-than-or-equal">≤</option>
                <option value="greater-than">&gt;</option>
                <option value="greater-than-or-equal">≥</option>
              </select>
            </label>
            <label>
              Valeur droite
              <select
                value={constraintRightKind}
                onChange={(event) =>
                  setConstraintRightKind(
                    event.target.value as 'literal' | 'variable',
                  )
                }
              >
                <option value="literal">Valeur</option>
                <option value="variable">Autre variable</option>
              </select>
            </label>
            {constraintRightKind === 'variable' ? (
              <select
                aria-label="Variable droite"
                value={constraintRight}
                onChange={(event) => setConstraintRight(event.target.value)}
              >
                <option value="">Choisir</option>
                {variables.map((item) => (
                  <option key={item.id} value={item.id}>
                    @{item.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label="Valeur de contrainte"
                value={constraintRight}
                onChange={(event) => setConstraintRight(event.target.value)}
              />
            )}
            <button
              type="button"
              disabled={!constraintLeft || !constraintRight}
              onClick={() =>
                setConstraints((items) => [
                  ...items,
                  {
                    kind: 'comparison',
                    operator: constraintOperator,
                    left: { kind: 'variable', variableId: constraintLeft },
                    right:
                      constraintRightKind === 'variable'
                        ? { kind: 'variable', variableId: constraintRight }
                        : {
                            kind: 'literal',
                            value: Number.isNaN(Number(constraintRight))
                              ? constraintRight
                              : Number(constraintRight),
                          },
                  },
                ])
              }
            >
              Ajouter la contrainte
            </button>
          </fieldset>
          <button
            type="button"
            disabled={!variables.length}
            onClick={() =>
              void buildQuestion().then((question) => {
                if (!question) return;
                const result = validateParameterizedQuestion(
                  question,
                  `${question.id}:preview`,
                );
                setEditorErrors(
                  result.errors.map(
                    (entry) => `${entry.path} — ${entry.message}`,
                  ),
                );
                setVariantPreview(
                  result.variants
                    .slice(0, 10)
                    .map((variant) =>
                      variant.content.prompt
                        .map((segment) =>
                          segment.kind === 'text'
                            ? segment.value
                            : segment.kind === 'line-break'
                              ? '\n'
                              : segment.mathSource.source,
                        )
                        .join(' '),
                    ),
                );
              })
            }
          >
            Tester les variantes
          </button>
          {variantPreview.length ? (
            <ol aria-label="Variantes générées">
              {variantPreview.map((value, index) => (
                <li key={`${index}:${value}`}>{value}</li>
              ))}
            </ol>
          ) : null}
        </fieldset>
      </section>
    </div>
  );
}

function MathError({ source }: { source: string }) {
  const result = parseMathSourceText(source);
  return result.ok ? (
    <span className={styles.valid}>Formule valide</span>
  ) : (
    <span className={styles.error}>{result.errors[0]?.message}</span>
  );
}
