import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { Button } from '@design-system/components/Button/Button';
import { CertifiedBadge } from '@design-system/components/CertifiedBadge/CertifiedBadge';
import { RatingWidget } from '@design-system/components/RatingWidget/RatingWidget';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { QuizzListing } from '@domain/quizz/QuizzListing';
import type { QuizzListingPreview as QuizzListingPreviewData } from '@domain/quizz/QuizzMarketplaceGateway';
import type { QuizzRatingScore } from '@domain/quizz/QuizzRating';
import { RateListingPrompt } from '@features/quizz/RateListingPrompt';
import { QuizzListingPreview } from './QuizzListingPreview';
import styles from './MarketplacePage.module.css';

function ListingCard({
  listing,
  onOpenPreview,
  onSubscribe,
  pending,
}: {
  listing: QuizzListing;
  onOpenPreview: (listingId: string) => void;
  onSubscribe: (
    listingId: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  pending: boolean;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <h3>{listing.title}</h3>
        {listing.certified ? <CertifiedBadge /> : null}
      </div>
      <p>{listing.description}</p>
      <p>
        {listing.averageRating !== null
          ? `${listing.averageRating.toFixed(1)} / 5 (${listing.ratingCount})`
          : 'Pas encore noté'}
      </p>
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenPreview(listing.id)}
        >
          Aperçu
        </Button>
        <Button
          type="button"
          busy={pending}
          onClick={(event) => onSubscribe(listing.id, event)}
        >
          Ajouter à mon espace
        </Button>
      </div>
    </article>
  );
}

export function MarketplacePage() {
  const { quizzMarketplaceGateway } = useAppServices();
  const [listings, setListings] = useState<readonly QuizzListing[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewListingId, setPreviewListingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuizzListingPreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [subscribedListingIds, setSubscribedListingIds] = useState<
    readonly string[]
  >([]);
  const [ratePromptListingId, setRatePromptListingId] = useState<string | null>(
    null,
  );
  const activeSubscribeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [rating, setRating] = useState<QuizzRatingScore | null>(null);
  const [ratingStatus, setRatingStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');

  const reload = () => {
    quizzMarketplaceGateway
      .listVisibleListings()
      .then(setListings)
      .catch(() =>
        setError('Les Quizz de la marketplace n’ont pas pu être chargés.'),
      );
  };
  useEffect(reload, [quizzMarketplaceGateway]);

  const subscribe = async (
    listingId: string,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setPendingListingId(listingId);
    setNotice(null);
    setError(null);
    try {
      await quizzMarketplaceGateway.subscribeToListing(listingId);
      setSubscribedListingIds((current) => [...current, listingId]);
      setNotice('Le Quizz a été ajouté à ton espace.');
      activeSubscribeButtonRef.current = event.currentTarget;
      setRatePromptListingId(listingId);
    } catch {
      setError('L’ajout du Quizz a échoué.');
    } finally {
      setPendingListingId(null);
    }
  };

  const openPreview = async (listingId: string) => {
    setPreviewListingId(listingId);
    setPreview(null);
    setPreviewError(null);
    setRating(null);
    setRatingStatus('idle');
    try {
      setPreview(await quizzMarketplaceGateway.getListingPreview(listingId));
    } catch {
      setPreviewError('L’aperçu n’a pas pu être chargé.');
    }
    try {
      if (await quizzMarketplaceGateway.hasSubscribed(listingId))
        setSubscribedListingIds((current) =>
          current.includes(listingId) ? current : [...current, listingId],
        );
    } catch {
      // Subscription status is an enhancement over the read-only preview; if
      // it's unavailable, rating just stays disabled instead of failing hard.
    }
  };

  const closePreview = () => {
    setPreviewListingId(null);
    setPreview(null);
    setPreviewError(null);
  };

  const canRate =
    previewListingId !== null &&
    subscribedListingIds.includes(previewListingId);

  const submitRating = async (score: QuizzRatingScore) => {
    if (!previewListingId) return;
    setRating(score);
    setRatingStatus('submitting');
    try {
      await quizzMarketplaceGateway.rateListing({
        listingId: previewListingId,
        score,
        comment: null,
      });
      setRatingStatus('submitted');
    } catch {
      setRatingStatus('error');
    }
  };

  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Découvre des Quizz publiés par la communauté, abonne-toi et note ceux que tu as essayés."
      />
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <Surface>
        {listings === null ? (
          <p>Chargement des Quizz…</p>
        ) : listings.length === 0 ? (
          <p>Aucun Quizz publié pour le moment.</p>
        ) : (
          <div className={styles.list}>
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onOpenPreview={(id) => void openPreview(id)}
                onSubscribe={(id, event) => void subscribe(id, event)}
                pending={pendingListingId === listing.id}
              />
            ))}
          </div>
        )}
      </Surface>
      {previewListingId ? (
        <Surface>
          {previewError ? <p role="alert">{previewError}</p> : null}
          {preview ? (
            <>
              <QuizzListingPreview preview={preview} />
              <RatingWidget
                value={rating}
                onChange={(score) => {
                  if (canRate) void submitRating(score);
                }}
                disabled={!canRate || ratingStatus === 'submitting'}
                label="Noter ce Quizz"
              />
              {!canRate ? (
                <p>Abonne-toi à ce Quizz pour pouvoir le noter.</p>
              ) : null}
              {ratingStatus === 'submitted' ? (
                <p role="status">Merci pour ta note.</p>
              ) : null}
              {ratingStatus === 'error' ? (
                <p role="alert">L’envoi de la note a échoué.</p>
              ) : null}
            </>
          ) : (
            <p>Chargement de l’aperçu…</p>
          )}
          <Button type="button" variant="secondary" onClick={closePreview}>
            Fermer l’aperçu
          </Button>
        </Surface>
      ) : null}
      {ratePromptListingId ? (
        <RateListingPrompt
          open
          listingId={ratePromptListingId}
          triggerRef={activeSubscribeButtonRef}
          onClose={() => setRatePromptListingId(null)}
        />
      ) : null}
    </>
  );
}
