import { useState } from 'react';
import {
  questionClassification,
  type Question,
} from '@domain/questions/Question';
import type { FolderLocation } from '@domain/questions/QuestionBankSearch';
import type {
  PersonalCourse,
  PersonalCourseVisibility,
} from '@domain/questions/personal-taxonomy/PersonalTaxonomy';
import { RawContentPreview } from '@features/questions/RawContentPreview';
import styles from './QuestionsFolderGrid.module.css';

export function QuestionsFolderGrid({
  location,
  onLocationChange,
  courses,
  questions,
  onCreateCourse,
  onToggleCourseVisibility,
}: {
  location: FolderLocation;
  onLocationChange: (location: FolderLocation) => void;
  courses: readonly PersonalCourse[];
  questions: readonly Readonly<Question>[];
  onCreateCourse: (title: string) => void;
  onToggleCourseVisibility: (
    courseId: string,
    visibility: PersonalCourseVisibility,
  ) => void;
}) {
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const countIn = (courseId: string) => {
    let count = 0;
    for (const question of questions) {
      const classification = questionClassification(question);
      if (
        classification?.kind === 'personal' &&
        classification.courseId === courseId
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

  const currentCourse =
    location.kind === 'course' || location.kind === 'chapter'
      ? (courses.find((item) => item.id === location.courseId) ?? null)
      : null;

  const startCreating = () => {
    setNewCourseTitle('');
    setCreatingCourse(true);
  };
  const cancelCreating = () => {
    setCreatingCourse(false);
    setNewCourseTitle('');
  };
  const submitNewCourse = () => {
    const title = newCourseTitle.trim();
    if (!title) return;
    onCreateCourse(title);
    setNewCourseTitle('');
    setCreatingCourse(false);
  };

  const normalizedSearch = search.trim().toLocaleLowerCase('fr');
  const visibleCourses = normalizedSearch
    ? courses.filter((course) =>
        course.title.toLocaleLowerCase('fr').includes(normalizedSearch),
      )
    : courses;

  return (
    <div className={styles.folderGrid}>
      {location.kind === 'root' ? (
        <div className={styles.gridHeader}>
          <span />
          <div className={styles.searchArea}>
            {searchOpen ? (
              <input
                autoFocus
                className={styles.searchInput}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un quizz"
                onBlur={() => {
                  if (!search.trim()) setSearchOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearch('');
                    setSearchOpen(false);
                  }
                }}
              />
            ) : null}
            <button
              type="button"
              className={styles.searchToggle}
              aria-label="Filtrer les quizz"
              title="Filtrer les quizz"
              onClick={() => setSearchOpen((value) => !value)}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <nav aria-label="Fil d’Ariane" className={styles.breadcrumb}>
          <button
            type="button"
            onClick={() => onLocationChange({ kind: 'root' })}
          >
            Mes Quizz
          </button>
          <span aria-hidden="true"> / </span>
          <span>{currentCourse?.title ?? 'Quizz'}</span>
        </nav>
      )}
      {location.kind === 'root' ? (
        <div className={styles.quizCards}>
          {creatingCourse ? (
            <form
              className={styles.addQuizCard}
              onSubmit={(event) => {
                event.preventDefault();
                submitNewCourse();
              }}
            >
              <label className={styles.addCardLabel}>
                Nouveau quizz
                <input
                  autoFocus
                  value={newCourseTitle}
                  onChange={(event) => setNewCourseTitle(event.target.value)}
                  placeholder="Nouveau quizz"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') cancelCreating();
                  }}
                />
              </label>
              <div className={styles.addCardActions}>
                <button type="submit" disabled={!newCourseTitle.trim()}>
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
              className={styles.addQuizCard}
              onClick={startCreating}
            >
              <span>Ajoute un quizz</span>
              <span className={styles.addQuizPlus} aria-hidden="true">
                +
              </span>
            </button>
          )}
          {visibleCourses.map((course) => {
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
                    <small>{countIn(course.id)} question(s)</small>
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
        </div>
      ) : null}
    </div>
  );
}
