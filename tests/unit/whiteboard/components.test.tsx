import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';
import { WhiteboardToolbar } from '@features/whiteboard/components/WhiteboardToolbar';
import { QuestionActions } from '@features/whiteboard/components/QuestionActions';
import { WhiteboardContainer } from '@features/whiteboard/components/WhiteboardContainer';
import { RevisionExperienceProvider } from '@features/session/RevisionExperienceProvider';
import { useRevisionExperience } from '@features/session/RevisionExperienceProvider';
import { AppServicesProvider } from '@app/providers/AppServicesProvider';
import { useWhiteboard } from '@app/providers/WhiteboardProvider';

vi.mock('@features/whiteboard/canvas/WhiteboardCanvas', () => ({
  WhiteboardCanvas: () => <div data-testid="whiteboard-canvas" />,
}));

const PRODUCTION_QUESTION_WITH_HELP_SEED =
  '00000000-0000-4000-8000-000000000001';

afterEach(() => vi.restoreAllMocks());

function useProductionQuestionWithHelp() {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    PRODUCTION_QUESTION_WITH_HELP_SEED,
  );
}

describe('WhiteboardToolbar', () => {
  function ActiveToolProbe() {
    const board = useWhiteboard();
    return <output data-testid="active-tool">{board.activeTool}</output>;
  }

  it('toggles the single writing button immediately between pen and eraser', async () => {
    const user = userEvent.setup();
    render(
      <WhiteboardProvider>
        <WhiteboardToolbar />
        <ActiveToolProbe />
      </WhiteboardProvider>,
    );
    const tools = screen.getByRole('group', { name: 'Outils principaux' });
    expect(
      within(tools)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Stylo', 'Formes']);

    const pen = within(tools).getByRole('button', { name: 'Stylo' });
    const shapes = within(tools).getByRole('button', { name: 'Formes' });
    expect(pen).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('active-tool')).toHaveTextContent('pen');
    await user.click(pen);
    const eraser = within(tools).getByRole('button', { name: 'Gomme' });
    expect(eraser).toHaveTextContent('Gomme');
    expect(eraser).not.toHaveAttribute('aria-haspopup');
    expect(eraser).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByRole('menu', { name: 'Choisir un outil' })).toBeNull();
    expect(screen.getByTestId('active-tool')).toHaveTextContent('eraser');
    await user.click(eraser);
    expect(within(tools).getByRole('button', { name: 'Stylo' })).toBeVisible();
    expect(screen.getByTestId('active-tool')).toHaveTextContent('pen');

    await user.click(shapes);
    await user.click(
      screen.getByRole('menuitemradio', { name: 'Repère quadrillé' }),
    );
    expect(screen.getByTestId('active-tool')).toHaveTextContent('shape');
    await user.click(within(tools).getByRole('button', { name: 'Stylo' }));
    expect(screen.getByTestId('active-tool')).toHaveTextContent('pen');
  });

  it('shows exactly four graphic mathematical cards and a separate selection action', async () => {
    const user = userEvent.setup();
    render(
      <WhiteboardProvider>
        <WhiteboardToolbar />
      </WhiteboardProvider>,
    );
    const tools = screen.getByRole('group', { name: 'Outils principaux' });
    const shapes = within(tools).getByRole('button', { name: 'Formes' });

    await user.click(shapes);
    const shapeMenu = screen.getByRole('menu', { name: 'Choisir une forme' });
    expect(shapeMenu).toBeVisible();
    expect(
      within(shapeMenu).getByRole('menuitem', {
        name: 'Sélectionner et modifier une forme',
      }),
    ).toBeVisible();
    const expected = [
      'Repère quadrillé',
      'Repère gradué',
      'Cercle trigonométrique',
      'Tableau de signes/variations',
    ];
    expect(within(shapeMenu).getAllByTestId('shape-option')).toHaveLength(4);
    for (const name of expected) {
      expect(
        within(shapeMenu).getByRole('menuitemradio', { name }),
      ).toBeVisible();
    }
    for (const excluded of [
      'Droite',
      'Flèche',
      'Rectangle',
      'Carré',
      'Cercle',
      'Triangle',
      'Axes',
      'Repère orthonormé',
    ])
      expect(
        within(shapeMenu).queryByRole('menuitemradio', { name: excluded }),
      ).toBeNull();
    for (const preview of within(shapeMenu).getAllByRole('img', {
      name: 'Aperçu graphique',
    }))
      expect(
        preview.querySelectorAll('line, ellipse, polyline, polygon, text')
          .length,
      ).toBeGreaterThan(0);
    expect(
      within(shapeMenu).queryByRole('radio', { name: /taille/i }),
    ).toBeNull();
    expect(within(shapeMenu).queryByText(/petite|moyenne|grande/i)).toBeNull();
    await user.click(document.body);
    expect(
      screen.queryByRole('menu', { name: 'Choisir une forme' }),
    ).toBeNull();
    await user.click(shapes);
    await user.click(
      within(screen.getByRole('menu', { name: 'Choisir une forme' })).getByRole(
        'menuitemradio',
        { name: 'Repère gradué' },
      ),
    );
    expect(shapes).toHaveAttribute('aria-pressed', 'true');
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
  it('loads the production action bar with deterministic real help content', async () => {
    useProductionQuestionWithHelp();
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
    useProductionQuestionWithHelp();
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
