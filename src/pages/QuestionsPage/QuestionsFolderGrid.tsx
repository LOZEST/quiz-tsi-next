import { useState } from 'react';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import type { FolderLocation } from '@domain/questions/QuestionBankSearch';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalCourseVisibility,
  PersonalNotion,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import { RawContentPreview } from '@features/questions/RawContentPreview';
import styles from './QuestionsFolderGrid.module.css';

export function QuestionsFolderGrid({
  location,
  onLocationChange,
  courses,
  chapters,
  notions,
  questions,
  onCreateCourse,
  onCreateChapter,
  onCreateNotion,
  onToggleCourseVisibility,
}: {
  location: FolderLocation;
  onLocationChange: (location: FolderLocation) => void;
  courses: readonly PersonalCourse[];
  chapters: readonly PersonalChapter[];
  notions: readonly PersonalNotion[];
  questions: readonly Readonly<Question>[];
  onCreateCourse: (title: string) => void;
  onCreateChapter: (title: string) => void;
  onCreateNotion: (title: string) => void;
  onToggleCourseVisibility: (
    courseId: string,
    visibility: PersonalCourseVisibility,
  ) => void;
}) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const countIn = (predicate: (location: FolderLocation) => boolean) => {
    let count = 0;
    for (const question of questions) {
      const classification = questionClassification(question);
      if (classification?.kind !== 'personal') continue;
      if (
        predicate({ kind: 'course', courseId: classification.courseId }) ||
        (classification.chapterId &&
          predicate({
            kind: 'chapter',
            courseId: classification.courseId,
            chapterId: classification.chapterId,
          })) ||
        (classification.chapterId &&
          classification.notionId &&
          predicate({
            kind: 'notion',
            courseId: classification.courseId,
            chapterId: classification.chapterId,
            notionId: classification.notionId,
          }))
      )
        count += 1;
    }
    return count;
  };
  const exampleFor = (courseId: string) =>
    questions.find((question) => {
      const classification = questionClassification(question);
      return (
        classification?.kind === 'personal' &&
        classification.courseId === courseId
      );
    })?.prompt ?? null;

  const breadcrumb: { label: string; location: FolderLocation }[] = [
    { label: 'Mes Quizz', location: { kind: 'root' } },
  ];
  if (
    location.kind === 'course' ||
    location.kind === 'chapter' ||
    location.kind === 'notion'
  ) {
    const course = courses.find((item) => item.id === location.courseId);
    breadcrumb.push({
      label: course?.title ?? 'Quizz',
      location: { kind: 'course', courseId: location.courseId },
    });
  }
  if (location.kind === 'chapter' || location.kind === 'notion') {
    const chapter = chapters.find((item) => item.id === location.chapterId);
    breadcrumb.push({
      label: chapter?.title ?? 'Chapitre',
      location: {
        kind: 'chapter',
        courseId: location.courseId,
        chapterId: location.chapterId,
      },
    });
  }
  if (location.kind === 'notion') {
    const notion = notions.find((item) => item.id === location.notionId);
    breadcrumb.push({ label: notion?.title ?? 'Notion', location });
  }

  const canCreateFolder =
    location.kind === 'root' ||
    location.kind === 'course' ||
    location.kind === 'chapter';
  const newFolderLabel =
    location.kind === 'root'
      ? 'Nouveau quizz'
      : location.kind === 'course'
        ? 'Nouveau chapitre'
        : 'Nouvelle notion';

  const startCreating = () => {
    setNewFolderTitle('');
    setCreatingFolder(true);
  };
  const cancelCreating = () => {
    setCreatingFolder(false);
    setNewFolderTitle('');
  };
  const submitNewFolder = () => {
    const title = newFolderTitle.trim();
    if (!title) return;
    if (location.kind === 'root') onCreateCourse(title);
    else if (location.kind === 'course') onCreateChapter(title);
    else if (location.kind === 'chapter') onCreateNotion(title);
    setNewFolderTitle('');
    setCreatingFolder(false);
  };

  const addTile = canCreateFolder ? (
    creatingFolder ? (
      <form
        className={
          location.kind === 'root' ? styles.addQuizCard : styles.addCard
        }
        onSubmit={(event) => {
          event.preventDefault();
          submitNewFolder();
        }}
      >
        <label className={styles.addCardLabel}>
          {newFolderLabel}
          <input
            autoFocus
            value={newFolderTitle}
            onChange={(event) => setNewFolderTitle(event.target.value)}
            placeholder={newFolderLabel}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancelCreating();
            }}
          />
        </label>
        <div className={styles.addCardActions}>
          <button type="submit" disabled={!newFolderTitle.trim()}>
            Créer
          </button>
          <button type="button" onClick={cancelCreating}>
            Annuler
          </button>
        </div>
      </form>
    ) : (
      <button
        type="button"
        className={
          location.kind === 'root' ? styles.addQuizCard : styles.addCard
        }
        onClick={startCreating}
      >
        <span>
          {location.kind === 'root' ? 'Ajoute un quizz' : newFolderLabel}
        </span>
        <span
          className={
            location.kind === 'root' ? styles.addQuizPlus : styles.addCardPlus
          }
          aria-hidden="true"
        >
          +
        </span>
      </button>
    )
  ) : null;

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
            {addTile}
            {courses.map((course) => {
              const example = exampleFor(course.id);
              return (
                <div key={course.id} className={styles.quizCard}>
                  <button
                    type="button"
                    className={styles.quizCardMain}
                    onClick={() =>
                      onLocationChange({ kind: 'course', courseId: course.id })
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
                      <strong>{course.title}</strong>
                      {course.description ? <p>{course.description}</p> : null}
                      <small>
                        {countIn(
                          (item) =>
                            item.kind === 'course' &&
                            item.courseId === course.id,
                        )}{' '}
                        question(s)
                      </small>
                    </div>
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
              );
            })}
          </>
        ) : null}
        {location.kind === 'course' ? (
          <>
            {addTile}
            {chapters
              .filter((chapter) => chapter.courseId === location.courseId)
              .map((chapter) => (
                <button
                  type="button"
                  key={chapter.id}
                  className={styles.card}
                  onClick={() =>
                    onLocationChange({
                      kind: 'chapter',
                      courseId: location.courseId,
                      chapterId: chapter.id,
                    })
                  }
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    📁
                  </span>
                  <span>{chapter.title}</span>
                  <small>
                    {countIn(
                      (item) =>
                        item.kind === 'chapter' &&
                        item.chapterId === chapter.id,
                    )}{' '}
                    question(s)
                  </small>
                </button>
              ))}
          </>
        ) : null}
        {location.kind === 'chapter' ? (
          <>
            {addTile}
            {notions
              .filter(
                (notion) =>
                  notion.courseId === location.courseId &&
                  notion.chapterId === location.chapterId,
              )
              .map((notion) => (
                <button
                  type="button"
                  key={notion.id}
                  className={styles.card}
                  onClick={() =>
                    onLocationChange({
                      kind: 'notion',
                      courseId: location.courseId,
                      chapterId: location.chapterId,
                      notionId: notion.id,
                    })
                  }
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    📁
                  </span>
                  <span>{notion.title}</span>
                  <small>
                    {countIn(
                      (item) =>
                        item.kind === 'notion' && item.notionId === notion.id,
                    )}{' '}
                    question(s)
                  </small>
                </button>
              ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
