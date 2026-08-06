import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';
import { WhiteboardToolbar } from '@features/whiteboard/components/WhiteboardToolbar';
import { QuestionActions } from '@features/whiteboard/components/QuestionActions';
import { WhiteboardContainer } from '@features/whiteboard/components/WhiteboardContainer';
import { RevisionExperienceProvider } from '@features/session/RevisionExperienceProvider';
import { AppServicesProvider } from '@app/providers/AppServicesProvider';

vi.mock('@features/whiteboard/canvas/WhiteboardCanvas', () => ({
  WhiteboardCanvas: () => <div data-testid="whiteboard-canvas" />,
}));

describe('WhiteboardToolbar', () => {
  it('exposes only the handwritten PR3 tools and changes selection', async () => {
    const user = userEvent.setup();
    render(
      <WhiteboardProvider>
        <WhiteboardToolbar />
      </WhiteboardProvider>,
    );
    const pen = screen.getByRole('button', { name: 'Stylo' });
    const eraser = screen.getByRole('button', { name: 'Gomme' });
    const grid = screen.getByRole('button', { name: 'Grille' });
    expect(pen).toHaveAttribute('aria-pressed', 'true');
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    await user.click(eraser);
    expect(eraser).toHaveAttribute('aria-pressed', 'true');
    await user.click(grid);
    expect(grid).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.queryByRole('button', { name: /forme|rectangle|cercle/i }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    await user.click(screen.getByRole('button', { name: 'Rétablir' }));
  });
});

describe('QuestionActions', () => {
  it('keeps the no-bank action bar visible and fully disabled', async () => {
    render(
      <AppServicesProvider>
        <WhiteboardProvider>
          <RevisionExperienceProvider>
            <WhiteboardContainer />
          </RevisionExperienceProvider>
        </WhiteboardProvider>
      </AppServicesProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'Aucune banque de questions validée n’est disponible pour le moment.',
        ),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('group', { name: 'Actions de la question' }),
    ).toBeVisible();
    for (const label of ['Indice', 'Correction', 'Suivante']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
  });

  it('enables only next for an active question', () => {
    render(<QuestionActions active onNext={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Indice' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Correction' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suivante' })).toBeEnabled();
  });
});
