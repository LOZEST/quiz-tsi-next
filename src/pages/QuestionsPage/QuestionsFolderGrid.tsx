import { useState } from 'react';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import type { FolderLocation } from '@domain/questions/QuestionBankSearch';
import type {
  PersonalChapter,
  PersonalCourse,
  PersonalNotion,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import styles from './QuestionsFolderGrid.module.css';

const folderLabel = {
  static: 'Officielle',
  shared: 'Partagée',
} as const;

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
}) {
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const countIn = (predicate: (location: FolderLocation) => boolean) => {
    let count = 0;
    for (const question of questions) {
      const classification = questionClassification(question);
      if (classification?.kind !== 'personal') {
        if (
          predicate({
            kind: 'source',
            source: question.source as 'static' | 'shared',
          })
        )
          count += 1;
        continue;
      }
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

  const breadcrumb: { label: string; location: FolderLocation }[] = [
    { label: 'Tous les dossiers', location: { kind: 'root' } },
  ];
  if (location.kind === 'source')
    breadcrumb.push({ label: folderLabel[location.source], location });
  if (
    location.kind === 'course' ||
    location.kind === 'chapter' ||
    location.kind === 'notion'
  ) {
    const course = courses.find((item) => item.id === location.courseId);
    breadcrumb.push({
      label: course?.title ?? 'Cours',
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

  const submitNewFolder = () => {
    const title = newFolderTitle.trim();
    if (!title) return;
    if (location.kind === 'root') onCreateCourse(title);
    else if (location.kind === 'course') onCreateChapter(title);
    else if (location.kind === 'chapter') onCreateNotion(title);
    setNewFolderTitle('');
  };

  const canCreateFolder =
    location.kind === 'root' ||
    location.kind === 'course' ||
    location.kind === 'chapter';
  const newFolderPlaceholder =
    location.kind === 'root'
      ? 'Nouveau cours'
      : location.kind === 'course'
        ? 'Nouveau chapitre'
        : 'Nouvelle notion';

  return (
    <div className={styles.folderGrid}>
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
      <div className={styles.cards}>
        {location.kind === 'root' ? (
          <>
            <button
              type="button"
              className={styles.card}
              onClick={() =>
                onLocationChange({ kind: 'source', source: 'static' })
              }
            >
              <span className={styles.cardIcon} aria-hidden="true">
                📁
              </span>
              <span>Officielle</span>
              <small>
                {countIn(
                  (item) => item.kind === 'source' && item.source === 'static',
                )}{' '}
                question(s)
              </small>
            </button>
            <button
              type="button"
              className={styles.card}
              onClick={() =>
                onLocationChange({ kind: 'source', source: 'shared' })
              }
            >
              <span className={styles.cardIcon} aria-hidden="true">
                📁
              </span>
              <span>Partagée</span>
              <small>
                {countIn(
                  (item) => item.kind === 'source' && item.source === 'shared',
                )}{' '}
                question(s)
              </small>
            </button>
            {courses.map((course) => (
              <button
                type="button"
                key={course.id}
                className={styles.card}
                onClick={() =>
                  onLocationChange({ kind: 'course', courseId: course.id })
                }
              >
                <span className={styles.cardIcon} aria-hidden="true">
                  📁
                </span>
                <span>{course.title}</span>
                <small>
                  {countIn(
                    (item) =>
                      item.kind === 'course' && item.courseId === course.id,
                  )}{' '}
                  question(s)
                </small>
              </button>
            ))}
          </>
        ) : null}
        {location.kind === 'course'
          ? chapters
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
              ))
          : null}
        {location.kind === 'chapter'
          ? notions
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
              ))
          : null}
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
            {newFolderPlaceholder}
            <input
              value={newFolderTitle}
              onChange={(event) => setNewFolderTitle(event.target.value)}
              placeholder={newFolderPlaceholder}
            />
          </label>
          <button type="submit" disabled={!newFolderTitle.trim()}>
            Créer
          </button>
        </form>
      ) : null}
    </div>
  );
}
