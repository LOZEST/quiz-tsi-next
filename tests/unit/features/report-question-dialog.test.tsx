import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportQuestionDialog } from '@features/questions/ReportQuestionDialog';

const submitReport = vi.fn(() => Promise.resolve());

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    questionReportGateway: { submitReport },
  }),
}));

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Signaler
      </button>
      <ReportQuestionDialog
        open={open}
        triggerRef={triggerRef}
        questionId="q1"
        questionVersion={3}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe('ReportQuestionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables submission until a reason is picked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Signaler' }));

    const submit = screen.getByRole('button', { name: 'Envoyer' });
    expect(submit).toBeDisabled();

    await user.click(
      screen.getByRole('radio', { name: 'Rendu mathématique cassé' }),
    );
    expect(submit).toBeEnabled();
  });

  it('requires a comment when the reason is "Autre"', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Signaler' }));
    await user.click(screen.getByRole('radio', { name: 'Autre' }));

    const submit = screen.getByRole('button', { name: 'Envoyer' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'Précision nécessaire');
    expect(submit).toBeEnabled();
  });

  it('submits the report and shows a confirmation', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Signaler' }));
    await user.click(
      screen.getByRole('radio', { name: 'Correction incomplète' }),
    );
    await user.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() =>
      expect(submitReport).toHaveBeenCalledWith({
        questionId: 'q1',
        questionVersion: 3,
        reason: 'correction_incomplete',
        comment: null,
      }),
    );
    expect(
      await screen.findByText('Merci, ton signalement a bien été envoyé.'),
    ).toBeInTheDocument();
  });
});
