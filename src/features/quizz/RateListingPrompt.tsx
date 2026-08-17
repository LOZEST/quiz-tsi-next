import { useState, type RefObject } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';
import { Button } from '@design-system/components/Button/Button';
import { RatingWidget } from '@design-system/components/RatingWidget/RatingWidget';
import type { QuizzRatingScore } from '@domain/quizz/QuizzRating';

export function RateListingPrompt({
  open,
  listingId,
  triggerRef,
  onClose,
}: {
  open: boolean;
  listingId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { quizzMarketplaceGateway } = useAppServices();
  const [rating, setRating] = useState<QuizzRatingScore | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');

  const reset = () => {
    setRating(null);
    setStatus('idle');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submitRating = async (score: QuizzRatingScore) => {
    setRating(score);
    setStatus('submitting');
    try {
      await quizzMarketplaceGateway.rateListing({
        listingId,
        score,
        comment: null,
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  return (
    <OverlayDrawer
      open={open}
      title="Noter ce Quizz"
      triggerRef={triggerRef}
      onClose={handleClose}
    >
      <p>
        Tu es maintenant abonné à ce Quizz. Tu peux le noter tout de suite, ou
        plus tard depuis la marketplace.
      </p>
      <RatingWidget
        value={rating}
        onChange={(score) => void submitRating(score)}
        disabled={status === 'submitting' || status === 'submitted'}
        label="Noter ce Quizz"
      />
      {status === 'submitted' ? <p role="status">Merci pour ta note.</p> : null}
      {status === 'error' ? (
        <p role="alert">L’envoi de la note a échoué.</p>
      ) : null}
      <Button type="button" variant="secondary" onClick={handleClose}>
        {status === 'submitted' ? 'Fermer' : 'Plus tard'}
      </Button>
    </OverlayDrawer>
  );
}
