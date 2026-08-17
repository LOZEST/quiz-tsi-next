import { useState } from 'react';
import type { Question } from '@domain/questions/Question';
import type {
  PersonalCourse,
  PersonalCourseVisibility,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import { RawContentPreview } from '@features/questions/RawContentPreview';
import styles from './QuizWorkspace.module.css';

function promptLabel(question: Readonly<Question>) {
  return (
    question.prompt.find((segment) => segment.kind === 'text')?.value ??
    'Question mathématique'
  );
}

function QuestionColumn({
  title,
  questions,
  selectedId,
  onSelect,
  selectedIds,
  onToggleSelected,
  emptyMessage,
}: {
  title: string;
  questions: readonly Readonly<Question>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedIds: ReadonlySet<string>;
  onToggleSelected: (id: string) => void;
  emptyMessage: string;
}) {
  return (
    <div className={styles.column}>
      <h3>{title}</h3>
      {questions.length ? (
        <ul>
          {questions.map((question) => {
            const label = promptLabel(question);
            return (
              <li key={`${question.id}:${question.version}`}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(question.id)}
                  onChange={() => onToggleSelected(question.id)}
                  aria-label={`Sélectionner ${label}`}
                />
                <button
                  type="button"
                  aria-pressed={selectedId === question.id}
                  onClick={() => onSelect(question.id)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>{emptyMessage}</p>
      )}
    </div>
  );
}

export function QuizWorkspace({
  questions,
  course,
  selectedId,
  onSelect,
  onValidate,
  onDelete,
  onEdit,
  onToggleCourseVisibility,
  onUpdateCourseMeta,
  onCreateManual,
  chatGptImportUrl,
  selectedIds,
  onToggleSelected,
  bulkBusy,
  onBulkValidate,
  onBulkDelete,
  onClearSelection,
  onDeleteCourse,
}: {
  questions: readonly Readonly<Question>[];
  course: PersonalCourse | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onValidate: (question: Readonly<Question>) => void;
  onDelete: (question: Readonly<Question>) => void;
  onEdit: (question: Readonly<Question>) => void;
  onToggleCourseVisibility: (
    courseId: string,
    visibility: PersonalCourseVisibility,
  ) => void;
  onUpdateCourseMeta: (
    courseId: string,
    title: string,
    description: string,
  ) => void;
  onCreateManual: () => void;
  chatGptImportUrl: string | null;
  selectedIds: ReadonlySet<string>;
  onToggleSelected: (id: string) => void;
  bulkBusy: Readonly<{ done: number; total: number }> | null;
  onBulkValidate: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onDeleteCourse: (courseId: string) => void;
}) {
  const [editingMeta, setEditingMeta] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [confirmingDeleteCourse, setConfirmingDeleteCourse] = useState(false);
  const startEditingMeta = () => {
    if (!course) return;
    setDraftTitle(course.title);
    setDraftDescription(course.description);
    setEditingMeta(true);
  };
  const saveMeta = () => {
    if (!course || !draftTitle.trim()) return;
    onUpdateCourseMeta(course.id, draftTitle.trim(), draftDescription.trim());
    setEditingMeta(false);
  };
  const validated = questions.filter(
    (question) => question.status === 'published',
  );
  const toValidate = questions.filter(
    (question) => question.status === 'draft',
  );
  const selected =
    questions.find((question) => question.id === selectedId) ?? null;

  return (
    <div className={styles.workspace}>
      <QuestionColumn
        title="Questions validées"
        questions={validated}
        selectedId={selectedId}
        onSelect={onSelect}
        selectedIds={selectedIds}
        onToggleSelected={onToggleSelected}
        emptyMessage="Aucune question validée pour l’instant."
      />
      <QuestionColumn
        title="Questions à valider"
        questions={toValidate}
        selectedId={selectedId}
        onSelect={onSelect}
        selectedIds={selectedIds}
        onToggleSelected={onToggleSelected}
        emptyMessage="Aucune question en attente de validation."
      />
      <div className={styles.detailColumn}>
        {selectedIds.size ? (
          <div
            className={styles.bulkBar}
            role="toolbar"
            aria-label="Actions groupées"
          >
            <span>
              {selectedIds.size} question{selectedIds.size > 1 ? 's' : ''}{' '}
              sélectionnée{selectedIds.size > 1 ? 's' : ''}
            </span>
            {bulkBusy ? (
              <span role="status">
                {bulkBusy.done}/{bulkBusy.total} traitées…
              </span>
            ) : (
              <>
                <button type="button" onClick={onBulkValidate}>
                  Valider
                </button>
                <button type="button" onClick={onBulkDelete}>
                  Supprimer
                </button>
                <button type="button" onClick={onClearSelection}>
                  Annuler
                </button>
              </>
            )}
          </div>
        ) : null}
        <div className={styles.detail}>
          <h3>Détail question</h3>
          {selected ? (
            <>
              {selected.provenance?.chatGptImport ? (
                <section className={styles.importReview}>
                  <strong>Import ChatGPT — À vérifier</strong>
                  <p>
                    Couverture : {selected.provenance.chatGptImport.coverage}
                  </p>
                  {selected.provenance.chatGptImport.coverage !==
                  'text-and-visuals' ? (
                    <p role="alert">
                      {selected.provenance.chatGptImport.coverage ===
                      'incomplete'
                        ? 'Analyse incomplète : vérifie attentivement le document.'
                        : 'Les visuels n’ont pas été analysés.'}
                    </p>
                  ) : null}
                  <ul>
                    {selected.provenance.chatGptImport.uncertainties.map(
                      (item, index) => (
                        <li key={`${item.path}:${index}`}>
                          {item.message} ({item.path})
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              ) : null}
              <h4>Énoncé</h4>
              <p>
                <RawContentPreview segments={selected.prompt} />
              </p>
              {selected.hint.length ? (
                <>
                  <h4>Indice</h4>
                  <p>
                    <RawContentPreview segments={selected.hint} />
                  </p>
                </>
              ) : null}
              <h4>Correction</h4>
              {selected.correction.map((step) => (
                <div key={step.id} className={styles.correctionStep}>
                  {step.title ? <strong>{step.title}</strong> : null}
                  <p>
                    <RawContentPreview segments={step.content} />
                  </p>
                </div>
              ))}
              <div className={styles.detailActions}>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => onEdit(selected)}
                >
                  Modifier
                </button>
                {selected.status !== 'published' ? (
                  <button
                    type="button"
                    className={styles.validateButton}
                    onClick={() => onValidate(selected)}
                  >
                    Valider
                  </button>
                ) : null}
                {selected.status !== 'archived' ? (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => onDelete(selected)}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className={styles.empty}>
              Sélectionne une question dans les colonnes de gauche.
            </p>
          )}
        </div>
        {course ? (
          <div className={styles.meta}>
            {editingMeta ? (
              <div className={styles.metaEdit}>
                <label>
                  Nom du quizz
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={draftDescription}
                    onChange={(event) =>
                      setDraftDescription(event.target.value)
                    }
                  />
                </label>
                <div className={styles.metaEditActions}>
                  <button
                    type="button"
                    disabled={!draftTitle.trim()}
                    onClick={saveMeta}
                  >
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEditingMeta(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.metaHeader}>
                  <button
                    type="button"
                    className={styles.metaTitleButton}
                    onClick={startEditingMeta}
                    title="Cliquer pour modifier"
                  >
                    <strong>{course.title}</strong>
                  </button>
                  <label className={styles.visibilityToggle}>
                    <input
                      type="checkbox"
                      checked={course.visibility === 'public'}
                      onChange={(event) =>
                        onToggleCourseVisibility(
                          course.id,
                          event.target.checked ? 'public' : 'private',
                        )
                      }
                    />
                    <span>
                      {course.visibility === 'public' ? 'Public' : 'Privé'}
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  className={styles.metaDescriptionButton}
                  onClick={startEditingMeta}
                >
                  {course.description || 'Ajouter une description…'}
                </button>
              </>
            )}
            <div className={styles.metaActions}>
              {chatGptImportUrl ? (
                <a
                  href={chatGptImportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ajouter une question avec GPT
                </a>
              ) : null}
              <button type="button" onClick={onCreateManual}>
                Ajouter une question à la main
              </button>
            </div>
            {confirmingDeleteCourse ? (
              <div className={styles.deleteCourseConfirm} role="alertdialog">
                <p>Supprimer ce quizz ? Ses questions seront archivées.</p>
                <div className={styles.deleteCourseConfirmActions}>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => onDeleteCourse(course.id)}
                  >
                    Confirmer la suppression
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteCourse(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.deleteCourseButton}
                onClick={() => setConfirmingDeleteCourse(true)}
              >
                Supprimer le quizz
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
