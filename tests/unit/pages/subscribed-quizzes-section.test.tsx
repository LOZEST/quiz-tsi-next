import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscribedQuizzContent } from '@domain/quizz/QuizzMarketplaceGateway';

const listSubscribedQuizzContent =
  vi.fn<() => Promise<readonly SubscribedQuizzContent[]>>();

vi.mock('@app/providers/AppServicesProvider', () => ({
  useAppServices: () => ({
    quizzMarketplaceGateway: { listSubscribedQuizzContent },
  }),
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
});
