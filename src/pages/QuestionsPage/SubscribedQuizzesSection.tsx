import { useEffect, useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { CertifiedBadge } from '@design-system/components/CertifiedBadge/CertifiedBadge';
import type { SubscribedQuizzContent } from '@domain/quizz/QuizzMarketplaceGateway';
import styles from './QuestionsFolderGrid.module.css';

/**
 * Read-only view of the Quizz the current user has subscribed to on the
 * marketplace — separate from "Mes Quizz" because these stay the property of
 * their original author: not editable, not republishable as the subscriber's
 * own. Content is fetched live by reference (no local copy).
 */
export function SubscribedQuizzesSection() {
  const { quizzMarketplaceGateway } = useAppServices();
  const [subscriptions, setSubscriptions] = useState<
    readonly SubscribedQuizzContent[] | null
  >(null);

  useEffect(() => {
    quizzMarketplaceGateway
      .listSubscribedQuizzContent()
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, [quizzMarketplaceGateway]);

  if (!subscriptions || subscriptions.length === 0) return null;

  return (
    <section aria-label="Abonnements" className={styles.subscriptions}>
      <h2>Abonnements</h2>
      <p>
        Quizz de la marketplace auxquels tu es abonné — lecture et jeu
        uniquement, pas d’édition.
      </p>
      <div className={styles.quizCards}>
        {subscriptions.map((subscription) => (
          <div key={subscription.listingId} className={styles.quizCard}>
            <div className={styles.quizCardMain}>
              <div className={styles.quizMeta}>
                <strong>{subscription.title}</strong>
                {subscription.certified ? <CertifiedBadge /> : null}
                {subscription.description ? (
                  <p>{subscription.description}</p>
                ) : null}
                <small>{subscription.questions.length} question(s)</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
