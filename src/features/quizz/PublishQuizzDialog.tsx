import { useState, type RefObject } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';
import { Button } from '@design-system/components/Button/Button';

export function PublishQuizzDialog({
  open,
  triggerRef,
  quizzId,
  defaultTitle,
  onClose,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  quizzId: string;
  defaultTitle: string;
  onClose: () => void;
}) {
  const { quizzMarketplaceGateway } = useAppServices();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');

  const canSubmit = title.trim() !== '';

  const reset = () => {
    setTitle(defaultTitle);
    setDescription('');
    setStatus('idle');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setStatus('submitting');
    try {
      await quizzMarketplaceGateway.publishQuizz({
        quizzId,
        title: title.trim(),
        description: description.trim(),
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  return (
    <OverlayDrawer
      open={open}
      title="Publier sur la marketplace"
      triggerRef={triggerRef}
      onClose={handleClose}
    >
      {status === 'submitted' ? (
        <>
          <p role="status">
            Ton Quizz est publié sur la marketplace et visible immédiatement.
          </p>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Fermer
          </Button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            Titre
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label>
            Description (facultatif)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </label>
          {status === 'error' ? (
            <p role="alert">La publication a échoué.</p>
          ) : null}
          <Button
            type="submit"
            busy={status === 'submitting'}
            disabled={!canSubmit}
          >
            Publier
          </Button>
        </form>
      )}
    </OverlayDrawer>
  );
}
