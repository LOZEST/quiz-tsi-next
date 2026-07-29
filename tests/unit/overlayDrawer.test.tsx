import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverlayDrawer } from '@design-system/components/OverlayDrawer/OverlayDrawer';

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <main>Arrière-plan</main>
      <OverlayDrawer
        open={open}
        title="Navigation"
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
      >
        <a href="/first">Premier lien</a>
        <button type="button">Dernière action</button>
      </OverlayDrawer>
    </>
  );
}

describe('OverlayDrawer', () => {
  it('starts closed, opens modally and moves focus inside', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));

    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(
      screen.getByRole('button', { name: 'Fermer le menu' }),
    ).toHaveFocus();
  });

  it('closes using its button and restores focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Fermer le menu' }));
    await waitFor(() => expect(trigger).toHaveFocus());

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
      'open',
    );
    expect(trigger).toHaveFocus();
  });

  it('closes with Escape and backdrop', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir' });
    await user.click(trigger);
    fireEvent(screen.getByRole('dialog'), new Event('cancel'));
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    fireEvent.click(screen.getByRole('dialog'));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps keyboard navigation within the native modal', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
    await user.tab();
    expect(screen.getByRole('link', { name: 'Premier lien' })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Dernière action' }),
    ).toHaveFocus();
  });
});
