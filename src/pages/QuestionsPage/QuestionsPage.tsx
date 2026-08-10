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
} from '@domain/questions/Question';
import {
  MATH_SYMBOL_REGISTRY_V1,
  MATH_SYNTAX_REGISTRY_V1,
} from '@domain/math/MathSyntaxRegistry';
import { parseMathSourceText } from '@domain/math/MathParser';
import type { QuestionWorkspaceSnapshot } from '@domain/repositories/QuestionWorkspaceRepository';
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
                onReview={() =>
                  void mutate(
                    {
                      ...selected,
                      version: selected.version + 1,
                      validated: true,
                      updatedAt: new Date().toISOString(),
                    },
                    'update',
                  )
                }
                onPublish={() =>
                  void mutate(
                    {
                      ...selected,
                      version: selected.version + 1,
                      source: 'shared',
                      status: 'published',
                      updatedAt: new Date().toISOString(),
                    },
                    'publish',
                  )
                }
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
  onCancel,
  onSave,
}: {
  initial: Readonly<Question> | null;
  userId: string;
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
  const save = async () => {
    const now = new Date().toISOString();
    const first = initial ?? null;
    const official = first ? questionClassification(first) : null;
    const question: Question = {
      id: first?.id ?? crypto.randomUUID(),
      version: first ? first.version + 1 : 1,
      source: 'private',
      ownerId: userId,
      status: 'draft',
      validated: false,
      provenance: first?.provenance ?? null,
      classification:
        official ??
        officialClassification('numbers', 'numbers-arithmetic', 'NUM-F01'),
      type: first?.type ?? 'course',
      difficulty: first?.difficulty ?? 'standard',
      parameterization: null,
      prompt: segments,
      hint: hint ? [{ kind: 'text', value: hint }] : [],
      correction: [
        {
          id: 'step-1',
          title: null,
          content: [{ kind: 'text', value: correction || 'À compléter' }],
        },
      ],
      tags: [],
      createdAt: first?.createdAt ?? now,
      updatedAt: now,
    };
    await onSave(question, first ? 'update' : 'create');
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
          <button
            type="button"
            disabled={!variable}
            onClick={() => add({ kind: 'text', value: `@${variable}` })}
          >
            Insérer @{variable || 'nom'}
          </button>
          <p>
            Domaines disponibles : entier, décimal, choix. Les contraintes sont
            composées visuellement et jamais en JavaScript.
          </p>
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
