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
}: {
  title: string;
  items: readonly Readonly<Question>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className={styles.column} aria-label={title}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className={styles.columnEmpty}>Aucune question.</p>
      ) : (
        <ul className={styles.columnList}>
          {items.map((question) => (
            <li key={question.id}>
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
  onDelete,
  onCreateNew,
  chatGptImportUrl,
}: {
  quizz: Quizz;
  questions: readonly Readonly<Question>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onValidate: (question: Readonly<Question>) => void;
  onDelete: (question: Readonly<Question>) => void;
  onCreateNew: () => void;
  chatGptImportUrl: string | null;
}) {
  const validated = questions.filter((question) => question.validated);
  const toValidate = questions.filter((question) => !question.validated);
  const selected =
    questions.find((question) => question.id === selectedId) ?? null;

  return (
    <div className={styles.workspace}>
      <div className={styles.columns}>
        <QuestionColumn
          title="question valider"
          items={validated}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <QuestionColumn
          title="question a valider"
          items={toValidate}
          selectedId={selectedId}
          onSelect={onSelect}
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
              <h4>corection</h4>
              {selected.correction.length === 0 ? (
                <p className={styles.columnEmpty}>Aucune correction.</p>
              ) : (
                selected.correction.map((step) => (
                  <p key={step.id}>
                    <RawContentPreview segments={step.content} />
                  </p>
                ))
              )}
              <h4>indice</h4>
              {selected.hint.length === 0 ? (
                <p className={styles.columnEmpty}>Aucun indice.</p>
              ) : (
                <p>
                  <RawContentPreview segments={selected.hint} />
                </p>
              )}
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
        </div>
      </div>
    </div>
  );
}
