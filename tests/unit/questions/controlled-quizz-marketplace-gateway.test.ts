import { beforeEach, describe, expect, it } from 'vitest';
import { ControlledQuizzMarketplaceGateway } from '@infrastructure/quizz/ControlledQuizzMarketplaceGateway';

const SESSION_KEY = 'qtsi-controlled-auth-session';

function signInAs(email: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email }));
}

describe('ControlledQuizzMarketplaceGateway', () => {
  let gateway: ControlledQuizzMarketplaceGateway;
  beforeEach(() => {
    sessionStorage.clear();
    gateway = new ControlledQuizzMarketplaceGateway();
  });

  it('publishes a quizz and lists it as visible', async () => {
    signInAs('user@example.test');
    await gateway.publishQuizz({
      quizzId: 'q1',
      title: 'Mon Quizz',
      description: 'Desc',
    });
    const listings = await gateway.listVisibleListings();
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      quizzId: 'q1',
      title: 'Mon Quizz',
      description: 'Desc',
      certified: false,
      hidden: false,
      averageRating: null,
      ratingCount: 0,
    });
  });

  it('stamps the publisher’s display name as the listing author', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    expect(listing?.authorDisplayName).toBe('owner');
  });

  it('republishing the same quizz updates the existing listing instead of duplicating it', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'V1', description: '' });
    const [first] = await gateway.listVisibleListings();
    await gateway.publishQuizz({
      quizzId: 'q1',
      title: 'V2',
      description: 'Nouvelle description',
    });
    const listings = await gateway.listVisibleListings();
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      id: first!.id,
      title: 'V2',
      description: 'Nouvelle description',
    });
  });

  it('setOwnListingHidden hides the caller’s own listing', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    await gateway.setOwnListingHidden('q1', true);
    expect(await gateway.listVisibleListings()).toEqual([]);
  });

  it('setOwnListingHidden rejects for a quizz the caller does not own', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    signInAs('user@example.test');
    await expect(gateway.setOwnListingHidden('q1', true)).rejects.toThrow();
  });

  it('preserves rating history across an unpublish/republish cycle', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    await gateway.subscribeToListing(listing!.id);
    await gateway.rateListing({
      listingId: listing!.id,
      score: 5,
      comment: null,
    });
    signInAs('owner@example.test');
    await gateway.setOwnListingHidden('q1', true);
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [republished] = await gateway.listVisibleListings();
    expect(republished?.id).toBe(listing!.id);
    expect(republished?.averageRating).toBe(5);
    expect(republished?.ratingCount).toBe(1);
  });

  it('hides a listing so it stops appearing in the visible list', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({
      quizzId: 'q1',
      title: 'Caché plus tard',
      description: '',
    });
    const [listing] = await gateway.listVisibleListings();
    await gateway.adminSetHidden(listing!.id, true);
    expect(await gateway.listVisibleListings()).toEqual([]);
    const admin = await gateway.adminListListings();
    expect(admin[0]?.hidden).toBe(true);
    expect(admin[0]?.hiddenAt).not.toBeNull();
  });

  it('certifies a listing through the admin action', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    await gateway.adminSetCertified(listing!.id, true);
    const [updated] = await gateway.listVisibleListings();
    expect(updated?.certified).toBe(true);
    expect(updated?.certifiedAt).not.toBeNull();
  });

  it('rejects certification and hiding for non-admin users', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    await expect(
      gateway.adminSetCertified(listing!.id, true),
    ).rejects.toThrow();
    await expect(gateway.adminSetHidden(listing!.id, true)).rejects.toThrow();
    await expect(gateway.adminListListings()).rejects.toThrow();
  });

  it('rejects fetching a preview for an unknown or hidden listing', async () => {
    signInAs('user@example.test');
    await expect(gateway.getListingPreview('missing')).rejects.toThrow();
  });

  it('returns a preview with rating summary for a visible listing', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: 'D' });
    const [listing] = await gateway.listVisibleListings();
    const preview = await gateway.getListingPreview(listing!.id);
    expect(preview).toMatchObject({
      listingId: listing!.id,
      title: 'T',
      description: 'D',
      averageRating: null,
      ratingCount: 0,
      questions: [],
    });
  });

  it('rejects subscribing to an unknown listing', async () => {
    signInAs('user@example.test');
    await expect(gateway.subscribeToListing('missing')).rejects.toThrow();
  });

  it('subscribes and reports subscription status per user', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    expect(await gateway.hasSubscribed(listing!.id)).toBe(false);
    await gateway.subscribeToListing(listing!.id);
    expect(await gateway.hasSubscribed(listing!.id)).toBe(true);
  });

  it('unsubscribeFromListing removes the caller’s own subscription', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    await gateway.subscribeToListing(listing!.id);
    expect(await gateway.hasSubscribed(listing!.id)).toBe(true);
    await gateway.unsubscribeFromListing(listing!.id);
    expect(await gateway.hasSubscribed(listing!.id)).toBe(false);
    expect(await gateway.listSubscribedQuizzContent()).toEqual([]);
  });

  it('unsubscribeFromListing is a no-op when the caller was never subscribed', async () => {
    signInAs('user@example.test');
    await expect(
      gateway.unsubscribeFromListing('missing'),
    ).resolves.toBeUndefined();
  });

  it('rejects rating a listing the user has not subscribed to', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    await expect(
      gateway.rateListing({ listingId: listing!.id, score: 5, comment: null }),
    ).rejects.toThrow();
  });

  it('rates a subscribed listing and reflects the average', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    await gateway.subscribeToListing(listing!.id);
    await gateway.rateListing({
      listingId: listing!.id,
      score: 4,
      comment: 'Bien',
    });
    const [rated] = await gateway.listVisibleListings();
    expect(rated?.averageRating).toBe(4);
    expect(rated?.ratingCount).toBe(1);
  });

  it('lists subscribed quizz content only for the current user', async () => {
    signInAs('owner@example.test');
    await gateway.publishQuizz({ quizzId: 'q1', title: 'T', description: '' });
    const [listing] = await gateway.listVisibleListings();
    signInAs('user@example.test');
    expect(await gateway.listSubscribedQuizzContent()).toEqual([]);
    await gateway.subscribeToListing(listing!.id);
    const content = await gateway.listSubscribedQuizzContent();
    expect(content).toEqual([
      {
        listingId: listing!.id,
        quizzId: 'q1',
        ownerId: 'controlled-owner',
        title: 'T',
        description: '',
        certified: false,
        questions: [],
      },
    ]);
  });
});
