import { useEffect, useState } from 'react';
import { useAuth } from '@app/providers/AuthProvider';
import { useAppServices } from '@app/providers/AppServicesProvider';

/**
 * A quizz the user can pick as a revision/test target: either one of their
 * own, or one they've added from the marketplace. Deliberately thinner than
 * the full `Quizz` domain type — marketplace subscriptions only carry an id
 * and a title (`SubscribedQuizzContent`), not the ownership/visibility
 * metadata that editing a quizz needs.
 */
export interface SelectableQuizz {
  readonly id: string;
  readonly title: string;
}

export function useUserQuizzes(): readonly SelectableQuizz[] {
  const { state } = useAuth();
  const { questionWorkspaceRepository, quizzMarketplaceGateway } =
    useAppServices();
  const [quizzes, setQuizzes] = useState<readonly SelectableQuizz[]>([]);
  const userId = state.status === 'authenticated' ? state.session.user.id : '';
  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setQuizzes([]));
      return;
    }
    let cancelled = false;
    void Promise.all([
      questionWorkspaceRepository
        .load(userId)
        .then((snapshot) => snapshot.quizzes)
        .catch(() => []),
      quizzMarketplaceGateway.listSubscribedQuizzContent().catch(() => []),
    ]).then(([owned, subscribed]) => {
      if (cancelled) return;
      const next: SelectableQuizz[] = [
        ...owned.map((quizz) => ({ id: quizz.id, title: quizz.title })),
        ...subscribed.map((content) => ({
          id: content.quizzId,
          title: content.title,
        })),
      ];
      setQuizzes((current) =>
        current.length === next.length &&
        current.every((quizz, index) => quizz.id === next[index]?.id)
          ? current
          : next,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [questionWorkspaceRepository, quizzMarketplaceGateway, userId]);
  return quizzes;
}
