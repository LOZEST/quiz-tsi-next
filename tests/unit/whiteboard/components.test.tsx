import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';
import { WhiteboardToolbar } from '@features/whiteboard/components/WhiteboardToolbar';
import { QuestionActions } from '@features/whiteboard/components/QuestionActions';
import { WhiteboardContainer } from '@features/whiteboard/components/WhiteboardContainer';
import { RevisionExperienceProvider } from '@features/session/RevisionExperienceProvider';
import { useRevisionExperience } from '@features/session/RevisionExperienceProvider';
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
  function AttemptProbe() {
    const experience = useRevisionExperience();
    return (
      <output data-testid="hint-used">
        {experience.state.kind === 'ready'
          ? String(experience.state.attempt.hintUsed)
          : 'false'}
      </output>
    );
  }
  it('loads the production NUM action bar with real help content', async () => {
    render(
      <AppServicesProvider>
        <WhiteboardProvider>
          <RevisionExperienceProvider userId="test-user">
            <WhiteboardContainer />
          </RevisionExperienceProvider>
        </WhiteboardProvider>
      </AppServicesProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('article', { name: 'Question active' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('group', { name: 'Actions de la question' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Indice' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Voir la correction' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeEnabled();
  });

  it('enables Passer for an active question before correction', () => {
    render(<QuestionActions active onNext={() => undefined} />);
    expect(
      screen.getByRole('button', { name: 'Indice indisponible' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Correction indisponible' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Passer' })).toBeEnabled();
  });

  it('shows exactly the normative actions after correction is opened', () => {
    render(
      <QuestionActions
        active
        hasHint
        hasCorrection
        correctionOpen
        afterCorrection
        onNext={() => undefined}
      />,
    );
    const group = screen.getByRole('group', {
      name: 'Actions de la question',
    });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Réussi', 'Raté', 'Question suivante']);
    for (const name of [
      'Indice',
      'Voir la correction',
      'Passer',
      'Partiellement réussi',
      'Presque réussi',
    ])
      expect(within(group).queryByRole('button', { name })).toBeNull();
  });

  it('keeps the after-correction phase after closing and closes an open hint', async () => {
    const user = userEvent.setup();
    render(
      <AppServicesProvider>
        <WhiteboardProvider>
          <RevisionExperienceProvider userId="phase-user">
            <WhiteboardContainer />
            <AttemptProbe />
          </RevisionExperienceProvider>
        </WhiteboardProvider>
      </AppServicesProvider>,
    );
    const question = await screen.findByRole('article', {
      name: 'Question active',
    });
    const prompt = question.textContent;
    await user.click(screen.getByRole('button', { name: 'Indice' }));
    expect(screen.getByRole('complementary', { name: 'Indice' })).toBeVisible();
    expect(screen.getByTestId('hint-used')).toHaveTextContent('true');
    await user.click(
      screen.getByRole('button', { name: 'Voir la correction' }),
    );
    expect(screen.queryByRole('complementary', { name: 'Indice' })).toBeNull();
    expect(
      screen.getByRole('complementary', { name: 'Correction' }),
    ).toBeVisible();
    expect(screen.getByTestId('hint-used')).toHaveTextContent('true');
    const actions = screen.getByRole('group', {
      name: 'Actions de la question',
    });
    const expectAfterCorrectionActions = () => {
      expect(
        within(actions)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['Réussi', 'Raté', 'Question suivante']);
      for (const name of [
        'Indice',
        'Voir la correction',
        'Passer',
        'Partiellement réussi',
        'Presque réussi',
      ])
        expect(within(actions).queryByRole('button', { name })).toBeNull();
    };
    expectAfterCorrectionActions();
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(
      screen.queryByRole('complementary', { name: 'Correction' }),
    ).toBeNull();
    expectAfterCorrectionActions();
    await user.click(
      within(actions).getByRole('button', { name: 'Question suivante' }),
    );
    expect(question).toHaveTextContent(prompt ?? '');
    expect(
      screen.getByText(
        'Indique ton résultat avant de passer à la question suivante.',
      ),
    ).toBeVisible();
  });
});
