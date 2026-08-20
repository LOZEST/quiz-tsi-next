import { useEffect, useState } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { Button } from '@design-system/components/Button/Button';
import { CertifiedBadge } from '@design-system/components/CertifiedBadge/CertifiedBadge';
import type { SubscribedQuizzContent } from '@domain/quizz/QuizzMarketplaceGateway';
import styles from './QuestionsFolderGrid.module.css';

/**
 * Read-only view of the Quizz the current user has added from the
 * marketplace — separate from "Mes Quizz" because these stay the property of
 * their original author: not editable, not republishable as the subscriber's
 * own. Content is fetched live by reference (no local copy).
 */
export function SubscribedQuizzesSection() {
  const { quizzMarketplaceGateway } = useAppServices();
  const [subscriptions, setSubscriptions] = useState<
    readonly SubscribedQuizzContent[] | null
  >(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    quizzMarketplaceGateway
      .listSubscribedQuizzContent()
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }, [quizzMarketplaceGateway]);

  const remove = async (listingId: string) => {
    setPendingListingId(listingId);
    setError(null);
    try {
      await quizzMarketplaceGateway.unsubscribeFromListing(listingId);
      setSubscriptions(
        (current) =>
          current?.filter((item) => item.listingId !== listingId) ?? current,
      );
    } catch {
      setError('Le retrait du Quizz a échoué.');
    } finally {
      setPendingListingId(null);
    }
  };

  if (!subscriptions || subscriptions.length === 0) return null;

  return (
    <section aria-label="Quizz ajoutés" className={styles.subscriptions}>
      <h2>Quizz ajoutés</h2>
      <p>
        Quizz de la marketplace que tu as ajoutés à ton espace — lecture et jeu
        uniquement, pas d’édition.
      </p>
      {error ? <p role="alert">{error}</p> : null}
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
            <div className={styles.removeAction}>
              <Button
                type="button"
                variant="danger"
                disabled={pendingListingId === subscription.listingId}
                onClick={() => void remove(subscription.listingId)}
              >
                Retirer de mon espace
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
