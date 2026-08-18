import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionHelpPanels } from '@features/session/QuestionHelpPanels';
import type { InstantiatedQuestion } from '@domain/questions/QuestionInstantiation';

const content: InstantiatedQuestion = {
  questionId: 'q1',
  questionVersion: 1,
  parameterValues: {},
  prompt: [{ kind: 'text', value: 'Énoncé' }],
  hint: [{ kind: 'text', value: 'Un indice' }],
  correction: [
    {
      id: 'step-1',
      title: 'Étape 1',
      content: [{ kind: 'text', value: 'Réponse' }],
    },
    {
      id: 'step-2',
      title: null,
      content: [{ kind: 'text', value: 'Suite sans titre' }],
    },
  ],
};

describe('QuestionHelpPanels', () => {
  it('renders nothing when both panels are closed', () => {
    render(
      <QuestionHelpPanels
        content={content}
        hintOpen={false}
        correctionOpen={false}
        onCloseHint={vi.fn()}
        onCloseCorrection={vi.fn()}
      />,
    );
    expect(screen.queryByText('Indice')).toBeNull();
    expect(screen.queryByText('Correction')).toBeNull();
  });

  it('closes the hint panel on Escape and via the close button', async () => {
    const onCloseHint = vi.fn();
    const user = userEvent.setup();
    render(
      <QuestionHelpPanels
        content={content}
        hintOpen
        correctionOpen={false}
        onCloseHint={onCloseHint}
        onCloseCorrection={vi.fn()}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCloseHint).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onCloseHint).toHaveBeenCalledTimes(2);
  });

  it('ignores non-Escape keys and renders the correction panel with step titles', async () => {
    const onCloseCorrection = vi.fn();
    const user = userEvent.setup();
    render(
      <QuestionHelpPanels
        content={content}
        hintOpen={false}
        correctionOpen
        onCloseHint={vi.fn()}
        onCloseCorrection={onCloseCorrection}
      />,
    );
    expect(screen.getByText('Étape 1')).toBeInTheDocument();
    expect(screen.getByText('Suite sans titre')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(onCloseCorrection).not.toHaveBeenCalled();
  });
});
