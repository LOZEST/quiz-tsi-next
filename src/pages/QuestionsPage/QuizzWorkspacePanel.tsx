import { useState, type DragEvent } from 'react';
import { Button } from '@design-system/components/Button/Button';
import type { Question } from '@domain/questions/Question';
import type { Quizz } from '@domain/questions/quizz/Quizz';
import { RawContentPreview } from '@features/questions/RawContentPreview';
import styles from './QuizzWorkspacePanel.module.css';

function questionLabel(question: Readonly<Question>): string {
  return (
    question.prompt.find((segment) => segment.kind === 'text')?.value ??
    'Question mathématique'
  );
}

function QuestionColumn({
  title,
  items,
  selectedId,
  onSelect,
  bulkSelectedIds,
  onToggleBulk,
  draggableItems = false,
  onDragStartItem,
  dropTarget = false,
  onDropItems,
}: {
  title: string;
  items: readonly Readonly<Question>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  bulkSelectedIds: ReadonlySet<string>;
  onToggleBulk: (id: string) => void;
  draggableItems?: boolean;
  onDragStartItem?: (event: DragEvent<HTMLLIElement>, id: string) => void;
  dropTarget?: boolean;
  onDropItems?: (event: DragEvent<HTMLElement>) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <section
      className={`${styles.column} ${
        dropTarget && isDragOver ? styles.columnDropActive : ''
      }`}
      aria-label={title}
      onDragOver={
        dropTarget
          ? (event) => {
              event.preventDefault();
              setIsDragOver(true);
            }
          : undefined
      }
      onDragLeave={dropTarget ? () => setIsDragOver(false) : undefined}
      onDrop={
        dropTarget
          ? (event) => {
              setIsDragOver(false);
              onDropItems?.(event);
            }
          : undefined
      }
    >
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.columnEmpty}>Aucune question.</p>
      ) : (
        <ul className={styles.columnList}>
          {items.map((question) => (
            <li
              key={question.id}
              className={styles.columnItem}
              draggable={draggableItems}
              onDragStart={
                draggableItems
                  ? (event) => onDragStartItem?.(event, question.id)
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={bulkSelectedIds.has(question.id)}
                onChange={() => onToggleBulk(question.id)}
                aria-label={`Sélectionner ${questionLabel(question)}`}
              />
              <button
                type="button"
                aria-pressed={selectedId === question.id}
                onClick={() => onSelect(question.id)}
              >
                {questionLabel(question)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QuizzWorkspacePanel({
  quizz,
  questions,
  selectedId,
  onSelect,
  onEdit,
  onValidate,
  reviewErrors,
  onDelete,
  onValidateQuestions,
  onDeleteQuestions,
  onCreateNew,
  onUpdateMeta,
  onDeleteQuizz,
  chatGptImportUrl,
}: {
  quizz: Quizz;
  questions: readonly Readonly<Question>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onValidate: (question: Readonly<Question>) => void;
  reviewErrors: readonly { path: string; message: string }[];
  onDelete: (question: Readonly<Question>) => void;
  onValidateQuestions: (questions: readonly Readonly<Question>[]) => void;
  onDeleteQuestions: (questions: readonly Readonly<Question>[]) => void;
  onCreateNew: () => void;
  onUpdateMeta: (updates: { title: string; description: string }) => void;
  onDeleteQuizz: () => void;
  chatGptImportUrl: string | null;
}) {
  const validated = questions.filter((question) => question.validated);
  const toValidate = questions.filter((question) => !question.validated);
  const selected =
    questions.find((question) => question.id === selectedId) ?? null;
  const [editingMeta, setEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState(quizz.title);
  const [editDescription, setEditDescription] = useState(quizz.description);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleBulk = (id: string) =>
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const bulkSelectedQuestions = questions.filter((question) =>
    bulkSelectedIds.has(question.id),
  );
  const canBulkValidate = bulkSelectedQuestions.some(
    (question) => !question.validated,
  );
  const canBulkDelete = bulkSelectedQuestions.some(
    (question) => question.status !== 'archived',
  );
  const validateByIds = (ids: readonly string[]) => {
    const targets = questions.filter(
      (question) => ids.includes(question.id) && !question.validated,
    );
    if (targets.length) onValidateQuestions(targets);
    setBulkSelectedIds(new Set());
  };
  const deleteByIds = (ids: readonly string[]) => {
    const targets = questions.filter(
      (question) => ids.includes(question.id) && question.status !== 'archived',
    );
    if (targets.length) onDeleteQuestions(targets);
    setBulkSelectedIds(new Set());
  };
  const handleDragStart = (event: DragEvent<HTMLLIElement>, id: string) => {
    const ids =
      bulkSelectedIds.has(id) && bulkSelectedIds.size > 1
        ? Array.from(bulkSelectedIds)
        : [id];
    event.dataTransfer.setData('application/json', JSON.stringify(ids));
    event.dataTransfer.effectAllowed = 'move';
  };
  const handleDropOnValidated = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const ids: unknown = JSON.parse(raw);
      if (Array.isArray(ids)) validateByIds(ids as string[]);
    } catch {
      // Payload wasn't produced by this panel's drag source — ignore.
    }
  };

  const startEditingMeta = () => {
    setEditTitle(quizz.title);
    setEditDescription(quizz.description);
    setEditingMeta(true);
  };
  const saveMeta = () => {
    const title = editTitle.trim();
    if (!title) return;
    onUpdateMeta({ title, description: editDescription.trim() });
    setEditingMeta(false);
  };

  return (
    <div className={styles.workspace}>
      {bulkSelectedIds.size > 0 ? (
        <div
          className={styles.bulkToolbar}
          role="toolbar"
          aria-label="Actions groupées"
        >
          <span>{bulkSelectedIds.size} sélectionnée(s)</span>
          <Button
            type="button"
            variant="success"
            disabled={!canBulkValidate}
            onClick={() => validateByIds(Array.from(bulkSelectedIds))}
          >
            Valider la sélection
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!canBulkDelete}
            onClick={() => deleteByIds(Array.from(bulkSelectedIds))}
          >
            Supprimer la sélection
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => setBulkSelectedIds(new Set())}
          >
            Annuler la sélection
          </Button>
        </div>
      ) : null}
      <div className={styles.columns}>
        <QuestionColumn
          title="question valider"
          items={validated}
          selectedId={selectedId}
          onSelect={onSelect}
          bulkSelectedIds={bulkSelectedIds}
          onToggleBulk={toggleBulk}
          dropTarget
          onDropItems={handleDropOnValidated}
        />
        <QuestionColumn
          title="question a valider"
          items={toValidate}
          selectedId={selectedId}
          onSelect={onSelect}
          bulkSelectedIds={bulkSelectedIds}
          onToggleBulk={toggleBulk}
          draggableItems
          onDragStartItem={handleDragStart}
        />
        <section className={styles.column} aria-label="detaille question">
          <h3>detaille question</h3>
          {selected ? (
            <>
              <button
                type="button"
                className={styles.detailPrompt}
                onClick={onEdit}
              >
                <h4>ennoncer</h4>
                <RawContentPreview segments={selected.prompt} />
              </button>
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
              <h4>corection</h4>
              {selected.correction.length === 0 ? (
                <p className={styles.columnEmpty}>Aucune correction.</p>
              ) : (
                selected.correction.map((step) => (
                  <div key={step.id}>
                    <RawContentPreview segments={step.content} />
                  </div>
                ))
              )}
              <h4>indice</h4>
              {selected.hint.length === 0 ? (
                <p className={styles.columnEmpty}>Aucun indice.</p>
              ) : (
                <div>
                  <RawContentPreview segments={selected.hint} />
                </div>
              )}
              {reviewErrors.length ? (
                <ul role="alert" className={styles.validationErrors}>
                  {reviewErrors.map((entry) => (
                    <li key={`${entry.path}:${entry.message}`}>
                      {entry.path} — {entry.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.detailActions}>
                {!selected.validated ? (
                  <Button
                    type="button"
                    variant="success"
                    onClick={() => onValidate(selected)}
                  >
                    valider
                  </Button>
                ) : null}
                {selected.status !== 'archived' ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => onDelete(selected)}
                  >
                    suprimer
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className={styles.columnEmpty}>Sélectionne une question.</p>
          )}
        </section>
      </div>
      <div className={styles.meta}>
        {editingMeta ? (
          <form
            className={styles.metaEditForm}
            onSubmit={(event) => {
              event.preventDefault();
              saveMeta();
            }}
          >
            <label>
              Nom du quizz
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={2}
              />
            </label>
            <div className={styles.metaActions}>
              <Button type="submit">Enregistrer</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingMeta(false)}
              >
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles.metaHeader}>
              <strong>{quizz.title}</strong>
              <span className={styles.visibilityPill}>
                {quizz.visibility === 'public' ? 'Public' : 'Privé'}
              </span>
            </div>
            {quizz.description ? <p>{quizz.description}</p> : null}
            <div className={styles.metaActions}>
              {chatGptImportUrl ? (
                <a
                  className={styles.pillLink}
                  href={chatGptImportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ajouter une question avec GPT
                </a>
              ) : null}
              <Button type="button" onClick={onCreateNew}>
                ajouter une question a la mains
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={startEditingMeta}
              >
                Modifier
              </Button>
              <Button type="button" variant="danger" onClick={onDeleteQuizz}>
                Supprimer le quizz
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
