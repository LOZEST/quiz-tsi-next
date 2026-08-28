import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { IconButton } from '@design-system/components/IconButton/IconButton';
import { IconFilter } from '@design-system/components/Icon/Icon';
import { Button } from '@design-system/components/Button/Button';
import type { FolderLocation } from '@domain/questions/QuestionBankSearch';
import {
  officialClassification,
  personalClassification,
  questionClassification,
  type ContentSegment,
  type Question,
  type SafeExpressionNode,
  type VariableDefinition,
  type QuestionType,
  type Difficulty,
  type CorrectionStep,
} from '@domain/questions/Question';
import { prepareQuestionForReview } from '@domain/questions/QuestionAuthoringValidation';
import { validateParameterizedQuestion } from '@domain/questions/QuestionParameterValidation';
import {
  MATH_SYMBOL_REGISTRY_V1,
  MATH_SYNTAX_REGISTRY_V1,
} from '@domain/math/MathSyntaxRegistry';
import { parseMathSourceText } from '@domain/math/MathParser';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
import type { ProgramIndex } from '@domain/program/Program';
import type { Quizz } from '@domain/questions/quizz/Quizz';
import styles from './QuestionsPage.module.css';
import { QuestionsFolderGrid } from './QuestionsFolderGrid';
import { syncQuestionWorkspace } from '@features/questions/syncQuestionWorkspace';
import { readChatGptImportUrl } from '@infrastructure/chatgpt/ChatGptImportConfiguration';
import { QuestionContentRenderer } from '@features/questions/QuestionContentRenderer';
import type { InstantiatedContentSegment } from '@domain/questions/QuestionInstantiation';

const emptySnapshot: QuestionWorkspaceSnapshot = {
  questions: [],
  quizzes: [],
  pendingOperationCount: 0,
  conflicts: [],
};

export function QuestionsPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const {
    questionWorkspaceRepository,
    questionRemoteGateway,
    programIndex,
    refreshQuestionRepositoryForUser,
    quizzMarketplaceGateway,
  } = useAppServices();
  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  const chatGptImportUrl = readChatGptImportUrl();
  const [workspace, setWorkspace] =
    useState<QuestionWorkspaceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [showDisplayNameNudge, setShowDisplayNameNudge] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<
    readonly { path: string; message: string }[]
  >([]);
  const [showFilter, setShowFilter] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [folderLocation, setFolderLocation] = useState<FolderLocation>({
    kind: 'root',
  });
  const reload = useCallback(async () => {
    try {
      if (userId) {
        setWorkspace(await questionWorkspaceRepository.load(userId));
        // Keep the revision session's merged question pool (captured once at
        // login) in sync whenever this page's own view of the workspace
        // changes — otherwise a quizz question created/validated here never
        // becomes selectable for revision until the next login.
        void refreshQuestionRepositoryForUser(userId);
      }
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
  }, [questionWorkspaceRepository, refreshQuestionRepositoryForUser, userId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const synchronize = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    try {
      await syncQuestionWorkspace(
        userId,
        questionWorkspaceRepository,
        questionRemoteGateway,
      );
      await reload();
    } catch {
      // Sync failures are non-fatal: drafts are already safe in IndexedDB
      // and will retry on the next reload/login.
    }
  }, [questionRemoteGateway, questionWorkspaceRepository, reload, userId]);
  useEffect(() => {
    if (userId && navigator.onLine) void synchronize();
  }, [synchronize, userId]);
  const selected =
    workspace.questions.find((question) => question.id === selectedId) ?? null;
  const validateQuestions = async (targets: readonly Readonly<Question>[]) => {
    const prepared = targets.map((question) => ({
      question,
      review: prepareQuestionForReview(question),
    }));
    const multiple = targets.length > 1;
    setReviewErrors(
      prepared.flatMap(({ question, review }) =>
        review.issues.map((issue) => ({
          path: multiple
            ? `${question.id.slice(0, 8)} · ${issue.path}`
            : issue.path,
          message: issue.message,
        })),
      ),
    );
    const now = new Date().toISOString();
    for (const { question, review } of prepared) {
      if (review.issues.length) continue;
      await questionWorkspaceRepository.saveQuestion(
        userId,
        {
          ...review.normalizedQuestion,
          version: question.version + 1,
          validated: true,
          updatedAt: now,
        },
        'update',
        crypto.randomUUID(),
      );
    }
    await reload();
  };
  const validateQuestion = (question: Readonly<Question>) =>
    void validateQuestions([question]);
  const deleteQuestions = async (targets: readonly Readonly<Question>[]) => {
    const now = new Date().toISOString();
    for (const question of targets) {
      await questionWorkspaceRepository.saveQuestion(
        userId,
        {
          ...question,
          version: question.version + 1,
          status: 'archived',
          validated: false,
          updatedAt: now,
        },
        'archive',
        crypto.randomUUID(),
      );
    }
    await reload();
  };
  const deleteQuestion = (question: Readonly<Question>) =>
    void deleteQuestions([question]);
  const onCreateQuizz = async (title: string) => {
    const now = new Date().toISOString();
    const quizz = {
      id: crypto.randomUUID(),
      ownerId: userId,
      title,
      description: '',
      visibility: 'private' as const,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await questionWorkspaceRepository.saveQuizz(
      userId,
      quizz,
      crypto.randomUUID(),
    );
    await reload();
    setFolderLocation({ kind: 'quizz', courseId: quizz.id });
  };
  const onToggleQuizzVisibility = async (
    courseId: string,
    visibility: 'public' | 'private',
  ) => {
    const quizz = workspace.quizzes.find((item) => item.id === courseId);
    if (!quizz) return;
    await questionWorkspaceRepository.saveQuizz(
      userId,
      { ...quizz, visibility, updatedAt: new Date().toISOString() },
      crypto.randomUUID(),
      'update',
    );
    try {
      if (visibility === 'public') {
        await quizzMarketplaceGateway.publishQuizz({
          quizzId: courseId,
          title: quizz.title,
          description: quizz.description,
        });
        if (state.status === 'authenticated' && !state.session.user.displayName)
          setShowDisplayNameNudge(true);
      } else {
        await quizzMarketplaceGateway.setOwnListingHidden(courseId, true);
      }
      setStorageError(null);
    } catch {
      setStorageError(
        'La mise à jour de la visibilité sur la marketplace a échoué.',
      );
    }
    await reload();
  };
  const onUpdateQuizzMeta = async (
    quizzId: string,
    updates: { title: string; description: string },
  ) => {
    const quizz = workspace.quizzes.find((item) => item.id === quizzId);
    if (!quizz) return;
    const updated = {
      ...quizz,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await questionWorkspaceRepository.saveQuizz(
      userId,
      updated,
      crypto.randomUUID(),
      'update',
    );
    if (quizz.visibility === 'public') {
      try {
        await quizzMarketplaceGateway.publishQuizz({
          quizzId,
          title: updated.title,
          description: updated.description,
        });
      } catch {
        setStorageError('La mise à jour du Quizz sur la marketplace a échoué.');
      }
    }
    await reload();
  };
  const onDeleteQuizz = async (quizzId: string) => {
    const quizz = workspace.quizzes.find((item) => item.id === quizzId);
    if (!quizz) return;
    const now = new Date().toISOString();
    const questionsInQuizz = workspace.questions.filter((question) => {
      const classification = questionClassification(question);
      return (
        classification?.kind === 'personal' &&
        classification.courseId === quizzId &&
        question.status !== 'archived'
      );
    });
    for (const question of questionsInQuizz) {
      await questionWorkspaceRepository.saveQuestion(
        userId,
        {
          ...question,
          version: question.version + 1,
          status: 'archived',
          updatedAt: now,
        },
        'archive',
        crypto.randomUUID(),
      );
    }
    await questionWorkspaceRepository.saveQuizz(
      userId,
      { ...quizz, deletedAt: now, updatedAt: now },
      crypto.randomUUID(),
      'update',
    );
    if (quizz.visibility === 'public') {
      try {
        await quizzMarketplaceGateway.setOwnListingHidden(quizzId, true);
      } catch {
        // Best-effort unpublish; the quizz itself is already deleted locally
        // and won't be offered for republishing.
      }
    }
    setFolderLocation({ kind: 'root' });
    await reload();
  };

  const visibleQuizzes = (() => {
    const query = filterQuery.trim().toLowerCase();
    return query
      ? workspace.quizzes.filter((quizz) =>
          quizz.title.toLowerCase().includes(query),
        )
      : workspace.quizzes;
  })();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Mes Quizz"
        description="Crée, organise et relis tes quizz, même hors connexion."
      />
      <div className={styles.filterToggle}>
        <IconButton
          label={showFilter ? 'Masquer le filtre' : 'Filtrer'}
          onClick={() => setShowFilter((value) => !value)}
        >
          <IconFilter />
        </IconButton>
      </div>
      {showFilter ? (
        <div className={styles.filters}>
          <label>
            Recherche
            <input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Titre du quizz"
            />
          </label>
        </div>
      ) : null}
      {storageError ? <p role="alert">{storageError}</p> : null}
      {showDisplayNameNudge ? (
        <p role="status">
          Ton profil n’a pas de nom affiché : les autres utilisateurs verront «
          Auteur » à la place sur la marketplace.{' '}
          <Button
            type="button"
            variant="quiet"
            onClick={() => void navigate('/account')}
          >
            Ajouter un nom affiché
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => setShowDisplayNameNudge(false)}
          >
            Fermer
          </Button>
        </p>
      ) : null}
      {loading ? (
        <p role="status">Chargement de la banque…</p>
      ) : (
        <QuestionsFolderGrid
          location={folderLocation}
          onLocationChange={setFolderLocation}
          quizzes={visibleQuizzes}
          questions={workspace.questions}
          onCreateQuizz={(title) => void onCreateQuizz(title)}
          onToggleQuizzVisibility={(courseId, visibility) =>
            void onToggleQuizzVisibility(courseId, visibility)
          }
          onUpdateQuizzMeta={(quizzId, updates) =>
            void onUpdateQuizzMeta(quizzId, updates)
          }
          onDeleteQuizz={(quizzId) => void onDeleteQuizz(quizzId)}
          selectedId={selectedId}
          onSelectQuestion={(id) => {
            setReviewErrors([]);
            setSelectedId(id);
          }}
          onEditQuestion={() => {
            setReviewErrors([]);
            setEditing(true);
          }}
          onValidateQuestion={validateQuestion}
          reviewErrors={reviewErrors}
          onDeleteQuestion={deleteQuestion}
          onValidateQuestions={(targets) => void validateQuestions(targets)}
          onDeleteQuestions={(targets) => void deleteQuestions(targets)}
          onCreateQuestion={() => {
            setReviewErrors([]);
            setSelectedId(null);
            setEditing(true);
          }}
          chatGptImportUrl={chatGptImportUrl}
        />
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
          initial={selected}
          userId={userId}
          programIndex={programIndex}
          workspace={workspace}
          defaultQuizzId={
            !selected && folderLocation.kind === 'quizz'
              ? folderLocation.courseId
              : null
          }
          onCancel={() => setEditing(false)}
          onSave={async (question, kind, quizz) => {
            if (quizz) {
              await questionWorkspaceRepository.saveQuestionWithQuizz(
                userId,
                question,
                quizz,
                {
                  question: crypto.randomUUID(),
                  quizz: crypto.randomUUID(),
                },
              );
            } else {
              await questionWorkspaceRepository.saveQuestion(
                userId,
                question,
                kind,
                crypto.randomUUID(),
              );
            }
            setEditing(false);
            setReviewErrors([]);
            setSelectedId(question.id);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function QuestionEditor({
  initial,
  userId,
  programIndex,
  workspace,
  defaultQuizzId,
  onCancel,
  onSave,
}: {
  initial: Readonly<Question> | null;
  userId: string;
  programIndex: ProgramIndex | null;
  workspace: QuestionWorkspaceSnapshot;
  defaultQuizzId: string | null;
  onCancel: () => void;
  onSave: (
    question: Question,
    kind: 'create' | 'update',
    quizz: Readonly<Quizz> | null,
  ) => Promise<void>;
}) {
  const [segments, setSegments] = useState<ContentSegment[]>(
    initial ? [...initial.prompt] : [{ kind: 'text', value: '' }],
  );
  const [hintSegments, setHintSegments] = useState<ContentSegment[]>(
    initial ? [...initial.hint] : [],
  );
  const [correctionSteps, setCorrectionSteps] = useState<CorrectionStep[]>(
    initial
      ? initial.correction.map((step) => ({
          ...step,
          content: [...step.content],
        }))
      : [{ id: 'step-1', title: null, content: [] }],
  );
  const [questionType, setQuestionType] = useState<QuestionType>(
    initial?.type ?? 'course',
  );
  const [difficulty, setDifficulty] = useState<Difficulty | null>(
    initial?.type === 'reflex' ? null : (initial?.difficulty ?? 'standard'),
  );
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
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
  >(existingClassification?.kind ?? (defaultQuizzId ? 'personal' : 'official'));
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
      : (defaultQuizzId ?? ''),
  );
  const [personalChapter, setPersonalChapter] = useState(
    existingClassification?.kind === 'personal'
      ? (existingClassification.chapter ?? '')
      : '',
  );
  const [personalCourseTitle, setPersonalCourseTitle] = useState('');
  const pendingQuizzId = useRef(crypto.randomUUID());
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [variantPreview, setVariantPreview] = useState<
    readonly (readonly InstantiatedContentSegment[])[]
  >([]);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const activeMath = useRef<HTMLInputElement | null>(null);
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
  const buildClassification = (): Readonly<{
    classification: NonNullable<Question['classification']>;
    quizz: Readonly<Quizz> | null;
  }> | null => {
    if (classificationKind === 'official') {
      if (!partId || !chapterId || !notionId) return null;
      return {
        classification: officialClassification(partId, chapterId, notionId),
        quizz: null,
      };
    }
    const now = new Date().toISOString();
    const newCourse = !courseId && personalCourseTitle.trim() !== '';
    const resolvedCourseId =
      courseId || (newCourse ? pendingQuizzId.current : '');
    if (!resolvedCourseId) return null;
    const existingCourse = workspace.quizzes.find(
      (item) => item.id === resolvedCourseId && item.ownerId === userId,
    );
    if (!newCourse && !existingCourse) return null;
    return {
      classification: personalClassification(
        resolvedCourseId,
        personalChapter.trim() || null,
      ),
      quizz: newCourse
        ? {
            id: resolvedCourseId,
            ownerId: userId,
            title: personalCourseTitle.trim(),
            description: '',
            visibility: 'private' as const,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          }
        : null,
    };
  };
  const buildQuestion = (): Readonly<{
    question: Question;
    quizz: Readonly<Quizz> | null;
  }> | null => {
    const builtClassification = buildClassification();
    if (!builtClassification) {
      setEditorErrors(['Une classification valide est obligatoire.']);
      return null;
    }
    const now = new Date().toISOString();
    const first = initial ?? null;
    const question: Question = {
      id: first?.id ?? crypto.randomUUID(),
      version: first ? first.version + 1 : 1,
      source: 'private',
      ownerId: userId,
      status: 'draft',
      validated: false,
      provenance: first?.provenance ?? null,
      classification: builtClassification.classification,
      type: questionType,
      difficulty: questionType === 'reflex' ? null : difficulty,
      parameterization: variables.length
        ? {
            schemaVersion: 1,
            variables,
            constraints,
            validationVariantCount:
              initial?.parameterization?.validationVariantCount ?? 0,
          }
        : null,
      prompt: segments,
      hint: hintSegments,
      correction: correctionSteps,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      createdAt: first?.createdAt ?? now,
      updatedAt: now,
    };
    return { question, quizz: builtClassification.quizz };
  };
  const save = async () => {
    const built = buildQuestion();
    if (!built) return;
    await onSave(built.question, initial ? 'update' : 'create', built.quizz);
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
              <option value="personal">Quizz personnel</option>
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
                Quizz
                <select
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                >
                  <option value="">Créer un quizz</option>
                  {workspace.quizzes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {!courseId ? (
                <label>
                  Nouveau quizz
                  <input
                    value={personalCourseTitle}
                    onChange={(event) =>
                      setPersonalCourseTitle(event.target.value)
                    }
                  />
                </label>
              ) : null}
              <label>
                Chapitre facultatif
                <input
                  value={personalChapter}
                  onChange={(event) => setPersonalChapter(event.target.value)}
                  placeholder="Étiquette libre"
                />
              </label>
            </>
          )}
        </fieldset>
        <fieldset>
          <legend>Propriétés</legend>
          <label>
            Type
            <select
              value={questionType}
              onChange={(event) => {
                const next = event.target.value as QuestionType;
                setQuestionType(next);
                setDifficulty(next === 'reflex' ? null : 'standard');
              }}
            >
              <option value="formula">Formules</option>
              <option value="course">Cours</option>
              <option value="calculation">Calcul</option>
              <option value="reflex">Réflexe</option>
            </select>
          </label>
          {questionType !== 'reflex' ? (
            <label>
              Difficulté
              <select
                value={difficulty ?? ''}
                onChange={(event) =>
                  setDifficulty(event.target.value as Difficulty)
                }
              >
                <option value="fundamental">Fondamental</option>
                <option value="standard">Standard</option>
                <option value="trap">Piège</option>
              </select>
            </label>
          ) : null}
          <label>
            Tags séparés par des virgules
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </label>
        </fieldset>
        <SegmentEditor
          label="Énoncé"
          segments={segments}
          onChange={setSegments}
          onMathFocus={(input) => {
            activeMath.current = input;
          }}
        />
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
        <SegmentEditor
          label="Indice"
          segments={hintSegments}
          onChange={setHintSegments}
          onMathFocus={(input) => {
            activeMath.current = input;
          }}
        />
        <fieldset>
          <legend>Correction</legend>
          {correctionSteps.map((step, stepIndex) => (
            <div key={step.id}>
              <label>
                Titre de l’étape
                <input
                  value={step.title ?? ''}
                  onChange={(event) =>
                    setCorrectionSteps((items) =>
                      items.map((item, index) =>
                        index === stepIndex
                          ? { ...item, title: event.target.value || null }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <SegmentEditor
                label={`Contenu de l’étape ${stepIndex + 1}`}
                segments={step.content}
                onChange={(content) =>
                  setCorrectionSteps((items) =>
                    items.map((item, index) =>
                      index === stepIndex ? { ...item, content } : item,
                    ),
                  )
                }
                onMathFocus={(input) => {
                  activeMath.current = input;
                }}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={stepIndex === 0}
                  aria-label={`Monter l’étape ${stepIndex + 1}`}
                  onClick={() =>
                    setCorrectionSteps((items) => {
                      const current = items[stepIndex];
                      const previous = items[stepIndex - 1];
                      if (!current || !previous) return items;
                      const next = [...items];
                      next[stepIndex - 1] = current;
                      next[stepIndex] = previous;
                      return next;
                    })
                  }
                >
                  Monter l’étape
                </button>
                <button
                  type="button"
                  disabled={stepIndex === correctionSteps.length - 1}
                  aria-label={`Descendre l’étape ${stepIndex + 1}`}
                  onClick={() =>
                    setCorrectionSteps((items) => {
                      const current = items[stepIndex];
                      const following = items[stepIndex + 1];
                      if (!current || !following) return items;
                      const next = [...items];
                      next[stepIndex] = following;
                      next[stepIndex + 1] = current;
                      return next;
                    })
                  }
                >
                  Descendre l’étape
                </button>
                <button
                  type="button"
                  aria-label={`Supprimer l’étape ${stepIndex + 1}`}
                  onClick={() =>
                    setCorrectionSteps((items) =>
                      items.filter((_, index) => index !== stepIndex),
                    )
                  }
                >
                  Supprimer l’étape
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCorrectionSteps((items) => [
                ...items,
                {
                  id: crypto.randomUUID(),
                  title: null,
                  content: [],
                },
              ])
            }
          >
            + Étape de correction
          </button>
        </fieldset>
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
            onClick={() =>
              setSegments((items) => [
                ...items,
                { kind: 'text', value: `@${variable}` },
              ])
            }
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
            onClick={() => {
              const built = buildQuestion();
              if (!built) return;
              const question = built.question;
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
                  .map((variant) => variant.content.prompt),
              );
            }}
          >
            Tester les variantes
          </button>
          {variantPreview.length ? (
            <ol aria-label="Variantes générées">
              {variantPreview.map((segments, index) => (
                <li key={index}>
                  <QuestionContentRenderer segments={segments} />
                </li>
              ))}
            </ol>
          ) : null}
        </fieldset>
      </section>
    </div>
  );
}

function SegmentEditor({
  label,
  segments,
  onChange,
  onMathFocus,
}: {
  label: string;
  segments: readonly ContentSegment[];
  onChange: (segments: ContentSegment[]) => void;
  onMathFocus: (input: HTMLInputElement) => void;
}) {
  const replace = (index: number, segment: ContentSegment) =>
    onChange(
      segments.map((item, position) => (position === index ? segment : item)),
    );
  const add = (segment: ContentSegment) => onChange([...segments, segment]);
  const remove = (index: number) =>
    onChange(segments.filter((_, position) => position !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    const current = segments[index];
    const swapped = segments[target];
    if (!current || !swapped) return;
    const next = [...segments];
    next[index] = swapped;
    next[target] = current;
    onChange(next);
  };
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className={styles.segmentList}>
        {segments.map((segment, index) => (
          <div className={styles.segmentItem} key={index}>
            {segment.kind === 'text' ? (
              <label>
                Texte
                <textarea
                  value={segment.value}
                  onChange={(event) =>
                    replace(index, { kind: 'text', value: event.target.value })
                  }
                />
              </label>
            ) : segment.kind === 'line-break' ? (
              <p>Saut de ligne</p>
            ) : (
              <label>
                {segment.kind === 'inline-math'
                  ? 'Formule en ligne'
                  : 'Formule affichée'}
                <input
                  value={segment.math.source}
                  onFocus={(event) => onMathFocus(event.currentTarget)}
                  onChange={(event) =>
                    replace(index, {
                      kind: segment.kind,
                      math: {
                        syntaxVersion: 1,
                        source: event.target.value,
                      },
                    })
                  }
                />
                <MathError source={segment.math.source} />
              </label>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Monter le bloc ${index + 1}`}
                onClick={() => move(index, -1)}
              >
                Monter
              </button>
              <button
                type="button"
                disabled={index === segments.length - 1}
                aria-label={`Descendre le bloc ${index + 1}`}
                onClick={() => move(index, 1)}
              >
                Descendre
              </button>
              <button
                type="button"
                aria-label={`Supprimer le bloc ${index + 1}`}
                onClick={() => remove(index)}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => add({ kind: 'text', value: '' })}>
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
    </fieldset>
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
