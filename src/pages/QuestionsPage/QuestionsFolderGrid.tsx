import { useRef, useState } from 'react';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import type { FolderLocation } from '@domain/questions/QuestionBankSearch';
import type { Quizz, QuizzVisibility } from '@domain/questions/quizz/Quizz';
import { RawContentPreview } from '@features/questions/RawContentPreview';
import { PublishQuizzDialog } from '@features/quizz/PublishQuizzDialog';
import { SubscribedQuizzesSection } from './SubscribedQuizzesSection';
import styles from './QuestionsFolderGrid.module.css';

export function QuestionsFolderGrid({
  location,
  onLocationChange,
  quizzes,
  questions,
  onCreateQuizz,
  onToggleQuizzVisibility,
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
}) {
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [publishingQuizz, setPublishingQuizz] = useState<Quizz | null>(null);
  const publishTriggerRef = useRef<HTMLButtonElement>(null);
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
    if (location.kind === 'root') onCreateQuizz(title);
    setNewFolderTitle('');
  };

  const canCreateFolder = location.kind === 'root';

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
            <button
              type="button"
              className={styles.addQuizCard}
              onClick={() => newFolderInputRef.current?.focus()}
            >
              <span aria-hidden="true">Ajoute un quizz</span>
              <span className={styles.addQuizPlus} aria-hidden="true">
                +
              </span>
            </button>
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
                  <button
                    type="button"
                    ref={(element) => {
                      if (publishingQuizz?.id === quizz.id)
                        publishTriggerRef.current = element;
                    }}
                    onClick={() => setPublishingQuizz(quizz)}
                  >
                    Publier sur la marketplace
                  </button>
                </div>
              );
            })}
          </>
        ) : null}
        {publishingQuizz ? (
          <PublishQuizzDialog
            open
            triggerRef={publishTriggerRef}
            quizzId={publishingQuizz.id}
            defaultTitle={publishingQuizz.title}
            onClose={() => setPublishingQuizz(null)}
          />
        ) : null}
      </div>
      {canCreateFolder ? (
        <form
          className={styles.newFolder}
          onSubmit={(event) => {
            event.preventDefault();
            submitNewFolder();
          }}
        >
          <label>
            Nouveau quizz
            <input
              ref={newFolderInputRef}
              value={newFolderTitle}
              onChange={(event) => setNewFolderTitle(event.target.value)}
              placeholder="Nouveau quizz"
            />
          </label>
          <button type="submit" disabled={!newFolderTitle.trim()}>
            Créer
          </button>
        </form>
      ) : null}
      {location.kind === 'root' ? <SubscribedQuizzesSection /> : null}
    </div>
  );
}
