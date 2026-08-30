import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { QuizzListing } from '@domain/quizz/QuizzListing';
import type { QuizzListingPreview } from '@domain/quizz/QuizzMarketplaceGateway';

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
  authorDisplayName: null,
  ...overrides,
});

const preview = (
  overrides: Partial<QuizzListingPreview> = {},
): QuizzListingPreview => ({
  listingId: 'listing-1',
  title: 'Thermodynamique',
  description: 'Un quizz sur la thermo',
  certified: true,
  averageRating: 3,
  ratingCount: 1,
  authorDisplayName: 'lucien',
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
  ...overrides,
});

const listVisibleListings = vi.fn(() => Promise.resolve([] as QuizzListing[]));
const getListingPreview = vi.fn();
const subscribeToListing = vi.fn(() => Promise.resolve());
const hasSubscribed = vi.fn(() => Promise.resolve(false));
const rateListing = vi.fn(() => Promise.resolve());

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    quizzMarketplaceGateway: {
      listVisibleListings,
      getListingPreview,
      subscribeToListing,
      hasSubscribed,
      rateListing,
    },
  }),
}));

import { MarketplacePage } from '@pages/MarketplacePage/MarketplacePage';

function renderPage() {
  return render(
    <MemoryRouter>
      <MarketplacePage />
    </MemoryRouter>,
  );
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listVisibleListings.mockResolvedValue([]);
    hasSubscribed.mockResolvedValue(false);
  });

  it('shows an empty state when there is nothing published', async () => {
    renderPage();
    expect(
      await screen.findByText('Aucun Quizz publié pour le moment.'),
    ).toBeInTheDocument();
  });

  it('shows an error when listings fail to load', async () => {
    listVisibleListings.mockRejectedValue(new Error('offline'));
    renderPage();
    expect(
      await screen.findByText(
        'Les Quizz de la marketplace n’ont pas pu être chargés.',
      ),
    ).toBeInTheDocument();
  });

  it('renders a listing card with its title and an add button', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    renderPage();
    expect(await screen.findByText('Thermodynamique')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ajouter à mon espace' }),
    ).toHaveTextContent('Ajouter');
  });

  it('filters listings by title or description behind the filter icon', async () => {
    listVisibleListings.mockResolvedValue([
      listing({ id: 'l1', title: 'Thermodynamique' }),
      listing({
        id: 'l2',
        title: 'Algèbre linéaire',
        description: 'Matrices',
      }),
    ]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Thermodynamique');
    await user.click(screen.getByRole('button', { name: 'Filtrer' }));
    await user.type(screen.getByLabelText('Recherche'), 'algèbre');
    expect(screen.queryByText('Thermodynamique')).not.toBeInTheDocument();
    expect(screen.getByText('Algèbre linéaire')).toBeInTheDocument();
  });

  it('subscribes to a listing directly from the Pix badge', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    const user = userEvent.setup();
    renderPage();
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
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: 'Ajouter à mon espace' }),
    );
    expect(
      await screen.findByText('L’ajout du Quizz a échoué.'),
    ).toBeInTheDocument();
  });

  it('opens the detail modal by clicking the card, shows an error on failure, then closes it', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    getListingPreview.mockRejectedValueOnce(new Error('denied'));
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    expect(
      await screen.findByText('L’aperçu n’a pas pu être chargé.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer l’aperçu' }));
    expect(screen.queryByText('L’aperçu n’a pas pu être chargé.')).toBeNull();
  });

  it('renders a loaded preview with rating, certification and author, disabling rating without a subscription', async () => {
    listVisibleListings.mockResolvedValue([listing({ certified: true })]);
    getListingPreview.mockResolvedValue(preview());
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    expect(await screen.findByText('Enoncé')).toBeInTheDocument();
    expect(screen.getByText('3.0 / 5 (1 note)')).toBeInTheDocument();
    expect(screen.getByText('Quizz certifié')).toBeInTheDocument();
    expect(screen.getByText('lucien')).toBeInTheDocument();
    expect(
      screen.getByText('Ajoute ce Quizz à ton espace pour pouvoir le noter.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: 'Noter ce Quizz' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows a parameterized formula as its raw source instead of "indisponible"', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    getListingPreview.mockResolvedValue(
      preview({
        questions: [
          {
            id: 'q1',
            prompt: [
              { kind: 'text', value: 'Calcule ' },
              {
                kind: 'inline-math',
                math: { syntaxVersion: 1, source: '@a+1' },
              },
            ],
            correction: [],
          },
        ],
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    expect(await screen.findByText('@a+1')).toBeInTheDocument();
    expect(
      screen.queryByText('Formule mathématique indisponible.'),
    ).not.toBeInTheDocument();
  });

  it('renders a preview without crashing when a question has no correction or prompt segments', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    getListingPreview.mockResolvedValue(
      preview({
        questions: [
          {
            id: 'q1',
            // Real production rows can store JSON null here instead of []
            // (e.g. a draft with no correction steps yet) — the RPC passes
            // stored content through as-is, so the frontend must tolerate it.
            prompt: null,
            correction: null,
          },
        ] as unknown as QuizzListingPreview['questions'],
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    expect(await screen.findByText('Correction')).toBeInTheDocument();
  });

  it('falls back to a generic author label when the owner never set a display name', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    getListingPreview.mockResolvedValue(preview({ authorDisplayName: null }));
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    expect(await screen.findByText('Auteur')).toBeInTheDocument();
  });

  it('rates a listing with a comment in two steps after subscribing, and reports a submission error', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    hasSubscribed.mockResolvedValue(true);
    getListingPreview.mockResolvedValue(
      preview({ certified: false, authorDisplayName: null }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    const widget = await screen.findByRole('radiogroup', {
      name: 'Noter ce Quizz',
    });
    await user.click(within(widget).getByRole('radio', { name: '5 / 5' }));
    await user.type(
      screen.getByLabelText('Ton avis (facultatif)'),
      'Très clair, merci !',
    );

    rateListing.mockRejectedValueOnce(new Error('denied'));
    await user.click(
      screen.getByRole('button', { name: 'Mettre un avis / note' }),
    );
    expect(
      await screen.findByText('L’envoi de la note a échoué.'),
    ).toBeInTheDocument();

    rateListing.mockResolvedValueOnce(undefined);
    await user.click(
      screen.getByRole('button', { name: 'Mettre un avis / note' }),
    );
    expect(await screen.findByText('Merci pour ta note.')).toBeInTheDocument();
    expect(rateListing).toHaveBeenLastCalledWith({
      listingId: 'listing-1',
      score: 5,
      comment: 'Très clair, merci !',
    });
  });

  it('submits a null comment when the comment field is left empty', async () => {
    listVisibleListings.mockResolvedValue([listing()]);
    hasSubscribed.mockResolvedValue(true);
    getListingPreview.mockResolvedValue(
      preview({ certified: false, authorDisplayName: null }),
    );
    rateListing.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /Thermodynamique/ }),
    );
    const widget = await screen.findByRole('radiogroup', {
      name: 'Noter ce Quizz',
    });
    await user.click(within(widget).getByRole('radio', { name: '5 / 5' }));
    await user.click(
      screen.getByRole('button', { name: 'Mettre un avis / note' }),
    );
    expect(rateListing).toHaveBeenCalledWith({
      listingId: 'listing-1',
      score: 5,
      comment: null,
    });
  });

  it('navigates to Mes Quizz when clicking Add a Quizz', async () => {
    listVisibleListings.mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/marketplace']}>
        <Routes>
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/questions" element={<p>Mes Quizz page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add a Quizz' }),
    );
    expect(await screen.findByText('Mes Quizz page')).toBeInTheDocument();
  });
});
