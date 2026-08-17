import { useEffect, useState } from 'react';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { PersonalCourse } from '@domain/questions/personal-taxonomy/PersonalTaxonomy';

export function useUserQuizzes(): readonly PersonalCourse[] {
  const { state } = useAuth();
  const { questionWorkspaceRepository } = useAppServices();
  const [courses, setCourses] = useState<readonly PersonalCourse[]>([]);
  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setCourses([]));
      return;
    }
    let cancelled = false;
    void questionWorkspaceRepository
      .load(userId)
      .then((snapshot) => {
        if (cancelled) return;
        setCourses((current) =>
          current.length === snapshot.courses.length &&
          current.every(
            (course, index) => course.id === snapshot.courses[index]?.id,
          )
            ? current
            : snapshot.courses,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [questionWorkspaceRepository, userId]);
  return courses;
}
