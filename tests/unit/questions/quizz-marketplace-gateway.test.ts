import { SupabaseQuizzMarketplaceGateway } from '@infrastructure/quizz/SupabaseQuizzMarketplaceGateway';
import type { SupabaseClient } from '@supabase/supabase-js';

function fakeClient(
  rpc: ReturnType<typeof vi.fn>,
  tableResponses: Record<string, { data?: unknown; error?: unknown }> = {},
): SupabaseClient {
  return {
    rpc,
    from(table: string) {
      const response = tableResponses[table] ?? { data: [], error: null };
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        then(resolve: (value: unknown) => void) {
          resolve(response);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe('SupabaseQuizzMarketplaceGateway', () => {
  it('publishes a quizz through the submit_quizz_listing RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await gateway.publishQuizz({
      quizzId: 'quizz-1',
      title: 'Mon Quizz',
      description: 'Une description',
    });
    expect(rpc).toHaveBeenCalledWith('submit_quizz_listing', {
      p_quizz_id: 'quizz-1',
      p_title: 'Mon Quizz',
      p_description: 'Une description',
    });
  });

  it('rejects when the publish RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(
      gateway.publishQuizz({ quizzId: 'q1', title: 't', description: '' }),
    ).rejects.toThrow();
  });

  it('maps visible listings with certified/hidden booleans, no status field', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          id: 'l1',
          quizz_id: 'q1',
          owner_id: 'u1',
          title: 'Titre',
          description: 'Desc',
          certified: true,
          hidden: false,
          average_rating: 4.5,
          rating_count: 2,
          published_at: '2026-01-01T00:00:00Z',
          certified_at: '2026-01-02T00:00:00Z',
          hidden_at: null,
        },
      ],
    });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    const listings = await gateway.listVisibleListings();
    expect(rpc).toHaveBeenCalledWith('list_visible_quizz_listings');
    expect(listings).toEqual([
      {
        id: 'l1',
        quizzId: 'q1',
        ownerId: 'u1',
        title: 'Titre',
        description: 'Desc',
        certified: true,
        hidden: false,
        averageRating: 4.5,
        ratingCount: 2,
        publishedAt: '2026-01-01T00:00:00Z',
        certifiedAt: '2026-01-02T00:00:00Z',
        hiddenAt: null,
      },
    ]);
  });

  it('subscribes to a listing through subscribe_to_quizz_listing', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await gateway.subscribeToListing('l1');
    expect(rpc).toHaveBeenCalledWith('subscribe_to_quizz_listing', {
      p_listing_id: 'l1',
    });
  });

  it('reports subscription status via has_subscribed_to_quizz_listing', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: true });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(gateway.hasSubscribed('l1')).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('has_subscribed_to_quizz_listing', {
      p_listing_id: 'l1',
    });
  });

  it('rejects rating submissions when the RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(
      gateway.rateListing({ listingId: 'l1', score: 5, comment: null }),
    ).rejects.toThrow();
    expect(rpc).toHaveBeenCalledWith('rate_quizz_listing', {
      p_listing_id: 'l1',
      p_score: 5,
      p_comment: null,
    });
  });

  it('returns no subscribed content when there is no subscription', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: [] });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    const content = await gateway.listSubscribedQuizzContent();
    expect(rpc).toHaveBeenCalledWith('list_my_quizz_subscriptions');
    expect(content).toEqual([]);
  });

  it('rejects when the subscription-status RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(gateway.hasSubscribed('l1')).rejects.toThrow();
  });

  it('rejects when the hide/unhide RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(gateway.adminSetHidden('l1', true)).rejects.toThrow();
  });

  it('rejects when listing subscribed content fails to load the subscriptions', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(gateway.listSubscribedQuizzContent()).rejects.toThrow();
  });

  it('rejects when a question fetch for a subscribed quizz fails', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          listing_id: 'l1',
          quizz_id: 'q1',
          owner_id: 'u1',
          title: 'T',
          description: '',
          certified: false,
        },
      ],
    });
    const client = {
      rpc,
      from() {
        const query = {
          select: () => query,
          eq: () => query,
          then(resolve: (value: unknown) => void) {
            resolve({ data: null, error: new Error('denied') });
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;
    const gateway = new SupabaseQuizzMarketplaceGateway(client);
    await expect(gateway.listSubscribedQuizzContent()).rejects.toThrow();
  });

  it('returns subscribed content with its questions, silently dropping ones that fail to parse', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          listing_id: 'l1',
          quizz_id: 'q1',
          owner_id: 'u1',
          title: 'T',
          description: '',
          certified: true,
        },
      ],
    });
    const client = {
      rpc,
      from() {
        const query = {
          select: () => query,
          eq: () => query,
          then(resolve: (value: unknown) => void) {
            resolve({
              data: [
                { id: 'bad', classification: { courseId: 'q1' } },
                {
                  id: 'other-quizz',
                  classification: { courseId: 'other' },
                },
              ],
              error: null,
            });
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;
    const gateway = new SupabaseQuizzMarketplaceGateway(client);
    const content = await gateway.listSubscribedQuizzContent();
    expect(content).toEqual([
      {
        listingId: 'l1',
        quizzId: 'q1',
        ownerId: 'u1',
        title: 'T',
        description: '',
        certified: true,
        questions: [],
      },
    ]);
  });

  it('rejects when the admin listings RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await expect(gateway.adminListListings()).rejects.toThrow();
  });

  it('certifies and hides listings independently through their own RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const gateway = new SupabaseQuizzMarketplaceGateway(fakeClient(rpc));
    await gateway.adminSetCertified('l1', true);
    expect(rpc).toHaveBeenCalledWith('admin_set_quizz_listing_certified', {
      p_listing_id: 'l1',
      p_certified: true,
    });
    await gateway.adminSetHidden('l1', true);
    expect(rpc).toHaveBeenCalledWith('admin_set_quizz_listing_hidden', {
      p_listing_id: 'l1',
      p_hidden: true,
    });
  });
});
