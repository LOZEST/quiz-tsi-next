import { useEffect, useState } from 'react';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { Quizz } from '@domain/questions/quizz/Quizz';

export function useUserQuizzes(): readonly Quizz[] {
  const { state } = useAuth();
  const { questionWorkspaceRepository } = useAppServices();
  const [quizzes, setQuizzes] = useState<readonly Quizz[]>([]);
  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setQuizzes([]));
      return;
    }
    let cancelled = false;
    void questionWorkspaceRepository
      .load(userId)
      .then((snapshot) => {
        if (cancelled) return;
        setQuizzes((current) =>
          current.length === snapshot.quizzes.length &&
          current.every(
            (quizz, index) => quizz.id === snapshot.quizzes[index]?.id,
          )
            ? current
            : snapshot.quizzes,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [questionWorkspaceRepository, userId]);
  return quizzes;
}
