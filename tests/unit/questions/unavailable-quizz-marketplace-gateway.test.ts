import { describe, expect, it } from 'vitest';
import { UnavailableQuizzMarketplaceGateway } from '@infrastructure/quizz/UnavailableQuizzMarketplaceGateway';

describe('UnavailableQuizzMarketplaceGateway', () => {
  const gateway = new UnavailableQuizzMarketplaceGateway();
  const message = 'La marketplace de Quizz n’est pas configurée.';
  const methods = [
    'publishQuizz',
    'setOwnListingHidden',
    'listVisibleListings',
    'getListingPreview',
    'subscribeToListing',
    'hasSubscribed',
    'rateListing',
    'listSubscribedQuizzContent',
    'adminListListings',
    'adminSetCertified',
    'adminSetHidden',
  ] as const;
  it.each(methods)('rejects %s with an unavailable error', async (method) => {
    await expect((gateway[method] as () => Promise<unknown>)()).rejects.toThrow(
      message,
    );
  });
});
