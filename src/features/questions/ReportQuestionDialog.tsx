import { useState, type RefObject } from 'react';
import { useAppServices } from '@app/providers/AppServicesProvider';
import {
  questionReportReasonLabels,
  questionReportReasons,
  type QuestionReportReason,
} from '@domain/questions/QuestionReport';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';
import { Button } from '@design-system/components/Button/Button';

export function ReportQuestionDialog({
  open,
  triggerRef,
  questionId,
  questionVersion,
  onClose,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  questionId: string;
  questionVersion: number;
  onClose: () => void;
}) {
  const { questionReportGateway } = useAppServices();
  const [reason, setReason] = useState<QuestionReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');

  const trimmedComment = comment.trim();
  const commentRequired = reason === 'other';
  const canSubmit =
    reason !== null && (!commentRequired || trimmedComment !== '');

  const reset = () => {
    setReason(null);
    setComment('');
    setStatus('idle');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit || reason === null) return;
    setStatus('submitting');
    try {
      await questionReportGateway.submitReport({
        questionId,
        questionVersion,
        reason,
        comment: trimmedComment === '' ? null : trimmedComment,
      });
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  };

  return (
    <OverlayDrawer
      open={open}
      title="Signaler un problème"
      triggerRef={triggerRef}
      onClose={handleClose}
    >
      {status === 'submitted' ? (
        <>
          <p role="status">Merci, ton signalement a bien été envoyé.</p>
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
          <fieldset>
            <legend>Quel est le problème ?</legend>
            {questionReportReasons.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="question-report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
                {questionReportReasonLabels[value]}
              </label>
            ))}
          </fieldset>
          <label>
            Remarque {commentRequired ? '' : '(facultatif)'}
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
            />
          </label>
          {status === 'error' ? (
            <p role="alert">Le signalement n’a pas pu être envoyé.</p>
          ) : null}
          <Button
            type="submit"
            busy={status === 'submitting'}
            disabled={!canSubmit}
          >
            Envoyer
          </Button>
        </form>
      )}
    </OverlayDrawer>
  );
}
