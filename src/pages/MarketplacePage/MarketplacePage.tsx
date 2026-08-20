import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@design-system/components/PageHeader/PageHeader';
import { Surface } from '@design-system/components/Surface/Surface';
import { Button } from '@design-system/components/Button/Button';
import { IconButton } from '@design-system/components/IconButton/IconButton';
import { IconFilter } from '@design-system/components/Icon/Icon';
import { useAppServices } from '@app/providers/AppServicesProvider';
import type { QuizzListing } from '@domain/quizz/QuizzListing';
import type { QuizzListingPreview as QuizzListingPreviewData } from '@domain/quizz/QuizzMarketplaceGateway';
import type { QuizzRatingScore } from '@domain/quizz/QuizzRating';
import { ListingDetailModal } from './ListingDetailModal';
import styles from './MarketplacePage.module.css';

function ListingCard({
  listing,
  onOpenPreview,
  onSubscribe,
  pending,
}: {
  listing: QuizzListing;
  onOpenPreview: (listingId: string, trigger: HTMLButtonElement) => void;
  onSubscribe: (listingId: string) => void;
  pending: boolean;
}) {
  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.cardMain}
        onClick={(event) => onOpenPreview(listing.id, event.currentTarget)}
      >
        <div className={styles.cardPreview}>{listing.description}</div>
        <div className={styles.cardMeta}>
          <strong>{listing.title}</strong>
        </div>
      </button>
      <button
        type="button"
        className={styles.priceBadge}
        aria-label="Ajouter à mon espace"
        disabled={pending}
        onClick={() => onSubscribe(listing.id)}
      >
        Ajouter
      </button>
    </article>
  );
}

export function MarketplacePage() {
  const { quizzMarketplaceGateway } = useAppServices();
  const navigate = useNavigate();
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
  const [showFilter, setShowFilter] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const activeCardTriggerRef = useRef<HTMLButtonElement | null>(null);

  const reload = () => {
    quizzMarketplaceGateway
      .listVisibleListings()
      .then(setListings)
      .catch(() =>
        setError('Les Quizz de la marketplace n’ont pas pu être chargés.'),
      );
  };
  useEffect(reload, [quizzMarketplaceGateway]);

  const subscribe = async (listingId: string) => {
    setPendingListingId(listingId);
    setNotice(null);
    setError(null);
    try {
      await quizzMarketplaceGateway.subscribeToListing(listingId);
      setSubscribedListingIds((current) => [...current, listingId]);
      setNotice('Le Quizz a été ajouté à ton espace.');
    } catch {
      setError('L’ajout du Quizz a échoué.');
    } finally {
      setPendingListingId(null);
    }
  };

  const openPreview = async (listingId: string, trigger: HTMLButtonElement) => {
    activeCardTriggerRef.current = trigger;
    setPreviewListingId(listingId);
    setPreview(null);
    setPreviewError(null);
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

  const submitRating = async (
    score: QuizzRatingScore,
    comment: string | null,
  ) => {
    if (!previewListingId) return;
    await quizzMarketplaceGateway.rateListing({
      listingId: previewListingId,
      score,
      comment,
    });
  };

  const query = filterQuery.trim().toLowerCase();
  const visibleListings = (listings ?? []).filter(
    (listing) =>
      !query ||
      listing.title.toLowerCase().includes(query) ||
      listing.description.toLowerCase().includes(query),
  );

  return (
    <>
      <PageHeader
        title="Market Place"
        description="Découvre des Quizz publiés par la communauté, ajoute-les à ton espace et note ceux que tu as essayés."
        actions={
          <div className={styles.headerActions}>
            <Button
              type="button"
              onClick={() => {
                void navigate('/questions');
              }}
            >
              Add a Quizz
            </Button>
            <IconButton
              label={showFilter ? 'Masquer le filtre' : 'Filtrer'}
              onClick={() => setShowFilter((value) => !value)}
            >
              <IconFilter />
            </IconButton>
          </div>
        }
      />
      {showFilter ? (
        <div className={styles.filterBar}>
          <label>
            Recherche
            <input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Titre ou description"
            />
          </label>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <Surface>
        {listings === null ? (
          <p>Chargement des Quizz…</p>
        ) : visibleListings.length === 0 ? (
          <p>Aucun Quizz publié pour le moment.</p>
        ) : (
          <div className={styles.list}>
            {visibleListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onOpenPreview={(id, trigger) => void openPreview(id, trigger)}
                onSubscribe={(id) => void subscribe(id)}
                pending={pendingListingId === listing.id}
              />
            ))}
          </div>
        )}
      </Surface>
      <ListingDetailModal
        open={previewListingId !== null}
        preview={preview}
        previewError={previewError}
        canRate={canRate}
        triggerRef={activeCardTriggerRef}
        onClose={closePreview}
        onSubmitRating={submitRating}
      />
    </>
  );
}
