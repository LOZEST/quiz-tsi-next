import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizzListing } from '@domain/quizz/QuizzListing';

const listing = (overrides: Partial<QuizzListing> = {}): QuizzListing => ({
  id: 'listing-1',
  quizzId: 'quizz-1',
  ownerId: 'owner-1',
  title: 'Thermodynamique',
  description: 'Un quizz sur la thermo',
  certified: false,
  hidden: false,
  averageRating: null,
  ratingCount: 0,
  publishedAt: '2026-01-01T00:00:00.000Z',
  certifiedAt: null,
  hiddenAt: null,
  ...overrides,
});

const listVisibleListings = vi.fn(() => Promise.resolve([] as QuizzListing[]));
const getListingPreview = vi.fn();
const subscribeToListing = vi.fn(() => Promise.resolve());
const rateListing = vi.fn(() => Promise.resolve());

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    quizzMarketplaceGateway: {
      listVisibleListings,
      getListingPreview,
      subscribeToListing,
      rateListing,
    },
  }),
}));

import { MarketplacePage } from '@pages/MarketplacePage/MarketplacePage';

describe('MarketplacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listVisibleListings.mockResolvedValue([]);
  });

  it('shows an empty state when there is nothing published', async () => {
    render(<MarketplacePage />);
    expect(
      await screen.findByText('Aucun Quizz publié pour le moment.'),
    ).toBeInTheDocument();
  });

  it('shows an error when listings fail to load', async () => {
    listVisibleListings.mockRejectedValue(new Error('offline'));
    render(<MarketplacePage />);
    expect(
      await screen.findByText(
        'Les Quizz de la marketplace n’ont pas pu être chargés.',
      ),
    ).toBeInTheDocument();
  });

  it('renders a listing card with its rating and certification', async () => {
    listVisibleListings.mockResolvedValue([
      listing({ certified: true, averageRating: 4.5, ratingCount: 3 }),
    ]);
    render(<MarketplacePage />);
    expect(await screen.findByText('Thermodynamique')).toBeInTheDocument();
    expect(screen.getByText('4.5 / 5 (3)')).toBeInTheDocument();
  });

  it('subscribes to a listing and opens the rate prompt', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    const user = userEvent.setup();
    render(<MarketplacePage />);
    await user.click(
      await screen.findByRole('button', { name: 'Ajouter à mon espace' }),
    );
    expect(subscribeToListing).toHaveBeenCalledWith('listing-1');
    expect(
      await screen.findByText('Le Quizz a été ajouté à ton espace.'),
    ).toBeInTheDocument();
  });

  it('shows an error when subscribing fails', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    subscribeToListing.mockRejectedValueOnce(new Error('denied'));
    const user = userEvent.setup();
    render(<MarketplacePage />);
    await user.click(
      await screen.findByRole('button', { name: 'Ajouter à mon espace' }),
    );
    expect(
      await screen.findByText('L’ajout du Quizz a échoué.'),
    ).toBeInTheDocument();
  });

  it('opens a preview, shows an error on failure, then closes it', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    getListingPreview.mockRejectedValueOnce(new Error('denied'));
    const user = userEvent.setup();
    render(<MarketplacePage />);
    await user.click(await screen.findByRole('button', { name: 'Aperçu' }));
    expect(
      await screen.findByText('L’aperçu n’a pas pu être chargé.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer l’aperçu' }));
    expect(screen.queryByText('L’aperçu n’a pas pu être chargé.')).toBeNull();
  });

  it('renders a loaded preview and disables rating without a subscription', async () => {
    listVisibleListings.mockResolvedValue([listing({ certified: true })]);
    getListingPreview.mockResolvedValue({
      listingId: 'listing-1',
      title: 'Thermodynamique',
      description: 'Un quizz sur la thermo',
      certified: true,
      averageRating: 3,
      ratingCount: 1,
      questions: [
        {
          id: 'q1',
          prompt: [{ kind: 'text', value: 'Enoncé' }],
          correction: [
            {
              id: 'step-1',
              title: null,
              content: [{ kind: 'text', value: 'Réponse' }],
            },
          ],
        },
      ],
    });
    const user = userEvent.setup();
    render(<MarketplacePage />);
    await user.click(await screen.findByRole('button', { name: 'Aperçu' }));
    expect(await screen.findByText('Enoncé')).toBeInTheDocument();
    expect(
      screen.getByText('Abonne-toi à ce Quizz pour pouvoir le noter.'),
    ).toBeInTheDocument();
  });

  it('rates a listing after subscribing, and reports a submission error', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    getListingPreview.mockResolvedValue({
      listingId: 'listing-1',
      title: 'Thermodynamique',
      description: '',
      certified: false,
      averageRating: null,
      ratingCount: 0,
      questions: [],
    });
    const user = userEvent.setup();
    render(<MarketplacePage />);
    await user.click(
      await screen.findByRole('button', { name: 'Ajouter à mon espace' }),
    );
    await waitFor(() => expect(subscribeToListing).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Plus tard' }));
    await user.click(screen.getByRole('button', { name: 'Aperçu' }));
    const widget = await screen.findByRole('radiogroup', {
      name: 'Noter ce Quizz',
    });
    rateListing.mockRejectedValueOnce(new Error('denied'));
    await user.click(within(widget).getByRole('radio', { name: '5 / 5' }));
    expect(
      await screen.findByText('L’envoi de la note a échoué.'),
    ).toBeInTheDocument();
    rateListing.mockResolvedValueOnce(undefined);
    await user.click(within(widget).getByRole('radio', { name: '4 / 5' }));
    expect(await screen.findByText('Merci pour ta note.')).toBeInTheDocument();
    expect(rateListing).toHaveBeenLastCalledWith({
      listingId: 'listing-1',
      score: 4,
      comment: null,
    });
  });
});
