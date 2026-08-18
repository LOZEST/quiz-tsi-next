import { useState } from 'react';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import {
  questionsInFolder,
  type FolderLocation,
} from '@domain/questions/QuestionBankSearch';
import type { Quizz, QuizzVisibility } from '@domain/questions/quizz/Quizz';
import { RawContentPreview } from '@features/questions/RawContentPreview';
import { SubscribedQuizzesSection } from './SubscribedQuizzesSection';
import { QuizzWorkspacePanel } from './QuizzWorkspacePanel';
import styles from './QuestionsFolderGrid.module.css';

export function QuestionsFolderGrid({
  location,
  onLocationChange,
  quizzes,
  questions,
  onCreateQuizz,
  onToggleQuizzVisibility,
  onUpdateQuizzMeta,
  onDeleteQuizz,
  selectedId,
  onSelectQuestion,
  onEditQuestion,
  onValidateQuestion,
  onDeleteQuestion,
  onCreateQuestion,
  chatGptImportUrl,
}: {
  location: FolderLocation;
  onLocationChange: (location: FolderLocation) => void;
  quizzes: readonly Quizz[];
  questions: readonly Readonly<Question>[];
  onCreateQuizz: (title: string) => void;
  onToggleQuizzVisibility: (
    quizzId: string,
    visibility: QuizzVisibility,
  ) => void;
  onUpdateQuizzMeta: (
    quizzId: string,
    updates: { title: string; description: string },
  ) => void;
  onDeleteQuizz: (quizzId: string) => void;
  selectedId: string | null;
  onSelectQuestion: (id: string) => void;
  onEditQuestion: () => void;
  onValidateQuestion: (question: Readonly<Question>) => void;
  onDeleteQuestion: (question: Readonly<Question>) => void;
  onCreateQuestion: () => void;
  chatGptImportUrl: string | null;
}) {
  const [isCreatingQuizz, setIsCreatingQuizz] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const countIn = (quizzId: string) =>
    questions.filter((question) => {
      const classification = questionClassification(question);
      return (
        classification?.kind === 'personal' &&
        classification.courseId === quizzId
      );
    }).length;
  const exampleFor = (quizzId: string) =>
    questions.find((question) => {
      const classification = questionClassification(question);
      return (
        classification?.kind === 'personal' &&
        classification.courseId === quizzId
      );
    })?.prompt ?? null;

  const breadcrumb: { label: string; location: FolderLocation }[] = [
    { label: 'Mes Quizz', location: { kind: 'root' } },
  ];
  if (location.kind === 'quizz') {
    const quizz = quizzes.find((item) => item.id === location.courseId);
    breadcrumb.push({
      label: quizz?.title ?? 'Quizz',
      location: { kind: 'quizz', courseId: location.courseId },
    });
  }

  const submitNewFolder = () => {
    const title = newFolderTitle.trim();
    if (!title) return;
    onCreateQuizz(title);
    setNewFolderTitle('');
    setIsCreatingQuizz(false);
  };

  const cancelNewFolder = () => {
    setNewFolderTitle('');
    setIsCreatingQuizz(false);
  };

  return (
    <div className={styles.folderGrid}>
      {location.kind !== 'root' ? (
        <nav aria-label="Fil d’Ariane" className={styles.breadcrumb}>
          {breadcrumb.map((crumb, index) => (
            <span key={index}>
              {index > 0 ? <span aria-hidden="true"> / </span> : null}
              {index === breadcrumb.length - 1 ? (
                <span>{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onLocationChange(crumb.location)}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div
        className={location.kind === 'root' ? styles.quizCards : styles.cards}
      >
        {location.kind === 'root' ? (
          <>
            {isCreatingQuizz ? (
              <form
                className={styles.addQuizCard}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitNewFolder();
                }}
              >
                <input
                  value={newFolderTitle}
                  onChange={(event) => setNewFolderTitle(event.target.value)}
                  placeholder="Nouveau quizz"
                  aria-label="Nouveau quizz"
                  autoFocus
                />
                <div className={styles.addQuizActions}>
                  <button type="submit" disabled={!newFolderTitle.trim()}>
                    Créer
                  </button>
                  <button type="button" onClick={cancelNewFolder}>
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className={styles.addQuizCard}
                onClick={() => setIsCreatingQuizz(true)}
              >
                <span>Ajoute un quizz</span>
                <span className={styles.addQuizPlus} aria-hidden="true">
                  +
                </span>
              </button>
            )}
            {quizzes.map((quizz) => {
              const example = exampleFor(quizz.id);
              return (
                <div key={quizz.id} className={styles.quizCard}>
                  <button
                    type="button"
                    className={styles.quizCardMain}
                    onClick={() =>
                      onLocationChange({ kind: 'quizz', courseId: quizz.id })
                    }
                  >
                    <div className={styles.quizPreview}>
                      {example ? (
                        <RawContentPreview segments={example} />
                      ) : (
                        <span className={styles.quizPreviewEmpty}>
                          Pas encore de question
                        </span>
                      )}
                    </div>
                    <div className={styles.quizMeta}>
                      <strong>{quizz.title}</strong>
                      {quizz.description ? <p>{quizz.description}</p> : null}
                      <small>{countIn(quizz.id)} question(s)</small>
                    </div>
                  </button>
                  <label className={styles.visibilityToggle}>
                    <input
                      type="checkbox"
                      checked={quizz.visibility === 'public'}
                      onChange={(event) =>
                        onToggleQuizzVisibility(
                          quizz.id,
                          event.target.checked ? 'public' : 'private',
                        )
                      }
                    />
                    <span>
                      {quizz.visibility === 'public' ? 'Public' : 'Privé'}
                    </span>
                  </label>
                </div>
              );
            })}
          </>
        ) : null}
      </div>
      {location.kind === 'quizz'
        ? (() => {
            const quizz = quizzes.find((item) => item.id === location.courseId);
            return quizz ? (
              <QuizzWorkspacePanel
                quizz={quizz}
                questions={questionsInFolder(questions, location)}
                selectedId={selectedId}
                onSelect={onSelectQuestion}
                onEdit={onEditQuestion}
                onValidate={onValidateQuestion}
                onDelete={onDeleteQuestion}
                onCreateNew={onCreateQuestion}
                onUpdateMeta={(updates) => onUpdateQuizzMeta(quizz.id, updates)}
                onDeleteQuizz={() => onDeleteQuizz(quizz.id)}
                chatGptImportUrl={chatGptImportUrl}
              />
            ) : null;
          })()
        : null}
      {location.kind === 'root' ? <SubscribedQuizzesSection /> : null}
    </div>
  );
}
