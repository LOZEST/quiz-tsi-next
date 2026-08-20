import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscribedQuizzContent } from '@domain/quizz/QuizzMarketplaceGateway';

const listSubscribedQuizzContent =
  vi.fn<() => Promise<readonly SubscribedQuizzContent[]>>();
const unsubscribeFromListing = vi.fn<() => Promise<void>>();

// A stable object reference matters here: the component's data-loading
// effect depends on `quizzMarketplaceGateway` — the real AppServicesProvider
// memoizes it, but a fresh object literal returned from this mock on every
// call would make the effect re-fire on every render and clobber optimistic
// local state updates (e.g. the remove button's) with a stale refetch.
const services = {
  quizzMarketplaceGateway: {
    listSubscribedQuizzContent,
    unsubscribeFromListing,
  },
};

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => services,
}));

import { SubscribedQuizzesSection } from '@pages/QuestionsPage/SubscribedQuizzesSection';

const subscription = (
  overrides: Partial<SubscribedQuizzContent> = {},
): SubscribedQuizzContent => ({
  listingId: 'l1',
  quizzId: 'q1',
  ownerId: 'owner-1',
  title: 'Thermodynamique',
  description: 'Un quizz sur la thermo',
  certified: false,
  questions: [],
  ...overrides,
});

describe('SubscribedQuizzesSection', () => {
  beforeEach(() => {
    listSubscribedQuizzContent.mockReset();
    listSubscribedQuizzContent.mockImplementation(() => Promise.resolve([]));
    unsubscribeFromListing.mockReset();
    unsubscribeFromListing.mockResolvedValue(undefined);
  });

  it('renders nothing when there are no subscriptions', async () => {
    const { container } = render(<SubscribedQuizzesSection />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the gateway fails', async () => {
    listSubscribedQuizzContent.mockImplementation(() =>
      Promise.reject(new Error('offline')),
    );
    const { container } = render(<SubscribedQuizzesSection />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a certified subscription with its description and question count', async () => {
    listSubscribedQuizzContent.mockImplementation(() =>
      Promise.resolve([
        subscription({ certified: true, questions: [{}, {}] as never }),
      ]),
    );
    render(<SubscribedQuizzesSection />);
    expect(await screen.findByText('Thermodynamique')).toBeInTheDocument();
    expect(screen.getByText('Un quizz sur la thermo')).toBeInTheDocument();
    expect(screen.getByText('2 question(s)')).toBeInTheDocument();
  });

  it('omits the description paragraph when there is none', async () => {
    listSubscribedQuizzContent.mockImplementation(() =>
      Promise.resolve([subscription({ description: '' })]),
    );
    render(<SubscribedQuizzesSection />);
    expect(await screen.findByText('Thermodynamique')).toBeInTheDocument();
    expect(screen.queryByText('Un quizz sur la thermo')).toBeNull();
  });

  it('removes a subscription when its remove button is clicked', async () => {
    listSubscribedQuizzContent.mockImplementation(() =>
      Promise.resolve([subscription()]),
    );
    const user = userEvent.setup();
    render(<SubscribedQuizzesSection />);
    await screen.findByText('Thermodynamique');
    await user.click(
      screen.getByRole('button', { name: 'Retirer de mon espace' }),
    );
    expect(unsubscribeFromListing).toHaveBeenCalledWith('l1');
    await waitFor(() =>
      expect(screen.queryByText('Thermodynamique')).toBeNull(),
    );
  });

  it('shows an error and keeps the card when removal fails', async () => {
    unsubscribeFromListing.mockRejectedValueOnce(new Error('denied'));
    listSubscribedQuizzContent.mockImplementation(() =>
      Promise.resolve([subscription()]),
    );
    const user = userEvent.setup();
    render(<SubscribedQuizzesSection />);
    await screen.findByText('Thermodynamique');
    await user.click(
      screen.getByRole('button', { name: 'Retirer de mon espace' }),
    );
    expect(
      await screen.findByText('Le retrait du Quizz a échoué.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Thermodynamique')).toBeInTheDocument();
  });
});
