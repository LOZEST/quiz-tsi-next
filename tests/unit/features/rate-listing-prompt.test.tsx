import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rateListing = vi.fn();

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    quizzMarketplaceGateway: { rateListing },
  }),
}));

import { RateListingPrompt } from '@features/quizz/RateListingPrompt';

describe('RateListingPrompt', () => {
  beforeEach(() => {
    rateListing.mockReset();
  });

  it('submits a rating and shows a success message, then closes and resets on "Fermer"', async () => {
    rateListing.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    const user = userEvent.setup();
    render(
      <RateListingPrompt
        open
        listingId="l1"
        triggerRef={triggerRef}
        onClose={onClose}
      />,
    );
    const widget = screen.getByRole('radiogroup', { name: 'Noter ce Quizz' });
    await user.click(within(widget).getByRole('radio', { name: '5 / 5' }));
    expect(rateListing).toHaveBeenCalledWith({
      listingId: 'l1',
      score: 5,
      comment: null,
    });
    expect(await screen.findByText('Merci pour ta note.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error message when the rating submission fails', async () => {
    rateListing.mockRejectedValue(new Error('denied'));
    const triggerRef = createRef<HTMLButtonElement>();
    const user = userEvent.setup();
    render(
      <RateListingPrompt
        open
        listingId="l1"
        triggerRef={triggerRef}
        onClose={vi.fn()}
      />,
    );
    const widget = screen.getByRole('radiogroup', { name: 'Noter ce Quizz' });
    await user.click(within(widget).getByRole('radio', { name: '3 / 5' }));
    expect(
      await screen.findByText('L’envoi de la note a échoué.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Plus tard' }),
    ).toBeInTheDocument();
  });

  it('closes via "Plus tard" without submitting a rating', async () => {
    const onClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    const user = userEvent.setup();
    render(
      <RateListingPrompt
        open
        listingId="l1"
        triggerRef={triggerRef}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onClose).toHaveBeenCalled();
    expect(rateListing).not.toHaveBeenCalled();
  });
});
