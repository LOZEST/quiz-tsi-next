import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WhiteboardProvider } from '@app/providers/WhiteboardProvider';
import { WhiteboardToolbar } from '@features/whiteboard/components/WhiteboardToolbar';

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
    await user.click(eraser);
    expect(eraser).toHaveAttribute('aria-pressed', 'true');
    await user.click(grid);
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('button', { name: /forme|rectangle|cercle/i }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    await user.click(screen.getByRole('button', { name: 'Rétablir' }));
  });
});
