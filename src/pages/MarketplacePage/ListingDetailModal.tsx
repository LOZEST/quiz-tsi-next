import { useState, type RefObject } from 'react';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';
import { Button } from '@design-system/components/Button/Button';
import { CertifiedBadge } from '@design-system/components/CertifiedBadge/CertifiedBadge';
import { RatingWidget } from '@design-system/components/RatingWidget/RatingWidget';
import type { QuizzListingPreview as QuizzListingPreviewData } from '@domain/quizz/QuizzMarketplaceGateway';
import type { QuizzRatingScore } from '@domain/quizz/QuizzRating';
import { QuizzListingPreview } from './QuizzListingPreview';
import styles from './MarketplacePage.module.css';

export function ListingDetailModal({
  open,
  preview,
  previewError,
  canRate,
  triggerRef,
  onClose,
  onSubmitRating,
}: {
  open: boolean;
  preview: QuizzListingPreviewData | null;
  previewError: string | null;
  canRate: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSubmitRating: (score: QuizzRatingScore) => Promise<void>;
}) {
  const [pendingRating, setPendingRating] = useState<QuizzRatingScore | null>(
    null,
  );
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');

  const handleClose = () => {
    setPendingRating(null);
    setStatus('idle');
    onClose();
  };

  const confirmRating = async () => {
    if (pendingRating === null) return;
    setStatus('submitting');
    try {
      await onSubmitRating(pendingRating);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  return (
    <OverlayDrawer
      variant="centered"
      open={open}
      title={preview?.title ?? 'Détail du Quizz'}
      triggerRef={triggerRef}
      closeLabel="Fermer l’aperçu"
      onClose={handleClose}
    >
      {previewError ? <p role="alert">{previewError}</p> : null}
      {preview ? (
        <div className={styles.detailGrid}>
          <div className={styles.detailLeft}>
            <p className={styles.detailTitle}>
              {preview.title}
              {preview.certified ? <CertifiedBadge /> : null}
            </p>
            <p>
              {preview.averageRating !== null
                ? `${preview.averageRating.toFixed(1)} / 5 (${preview.ratingCount} note${preview.ratingCount > 1 ? 's' : ''})`
                : 'Pas encore noté'}
            </p>
            <p>{preview.description}</p>
            <div className={styles.avisBox}>
              <RatingWidget
                value={pendingRating}
                onChange={setPendingRating}
                disabled={
                  !canRate || status === 'submitting' || status === 'submitted'
                }
                label="Noter ce Quizz"
              />
              {!canRate ? (
                <p>Abonne-toi à ce Quizz pour pouvoir le noter.</p>
              ) : null}
              <Button
                type="button"
                disabled={
                  !canRate ||
                  pendingRating === null ||
                  status === 'submitting' ||
                  status === 'submitted'
                }
                onClick={() => void confirmRating()}
              >
                Mettre un avis / note
              </Button>
              {status === 'submitted' ? (
                <p role="status">Merci pour ta note.</p>
              ) : null}
              {status === 'error' ? (
                <p role="alert">L’envoi de la note a échoué.</p>
              ) : null}
            </div>
            <p className={styles.author}>
              {preview.authorDisplayName ?? 'Auteur'}
            </p>
          </div>
          <div className={styles.detailRight}>
            <h3>Question</h3>
            <QuizzListingPreview preview={preview} />
          </div>
        </div>
      ) : previewError ? null : (
        <p>Chargement de l’aperçu…</p>
      )}
    </OverlayDrawer>
  );
}
