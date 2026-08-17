import type { QuizzListing } from '@domain/quizz/QuizzListing';
import type {
  QuizzListingPreview,
  QuizzListingSubmission,
  QuizzMarketplaceGateway,
  QuizzRatingSubmission,
  SubscribedQuizzContent,
} from '@domain/quizz/QuizzMarketplaceGateway';
import { isUserRole, type UserRole } from '@domain/auth/UserRole';

const SESSION_KEY = 'qtsi-controlled-auth-session';
const LISTINGS_KEY = 'qtsi-controlled-quizz-listings';
const SUBSCRIPTIONS_KEY = 'qtsi-controlled-quizz-subscriptions';

interface StoredListing extends QuizzListing {
  ratings: Record<string, number>;
}

function currentIdentity(): { userId: string; email: string; role: UserRole } {
  const stored = sessionStorage.getItem(SESSION_KEY);
  const email = stored
    ? (() => {
        try {
          return (JSON.parse(stored) as { email: string }).email;
        } catch {
          return stored;
        }
      })()
    : 'user@example.test';
  const roleValue = email.split('@')[0];
  const role: UserRole = isUserRole(roleValue) ? roleValue : 'user';
  return { userId: `controlled-${role}`, email, role };
}

function readListings(): StoredListing[] {
  const stored = sessionStorage.getItem(LISTINGS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as StoredListing[];
  } catch {
    return [];
  }
}

function writeListings(listings: readonly StoredListing[]): void {
  sessionStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
}

function readSubscriptions(): string[] {
  const stored = sessionStorage.getItem(SUBSCRIPTIONS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as string[];
  } catch {
    return [];
  }
}

function writeSubscriptions(subscriptions: readonly string[]): void {
  sessionStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
}

function ratingSummary(listing: StoredListing): {
  averageRating: number | null;
  ratingCount: number;
} {
  const scores = Object.values(listing.ratings);
  if (scores.length === 0) return { averageRating: null, ratingCount: 0 };
  return {
    averageRating: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    ratingCount: scores.length,
  };
}

function isAdmin(role: UserRole): boolean {
  return role !== 'user';
}

/**
 * Deterministic browser-test boundary mirroring ControlledQuestionReportGateway.
 * Selected only by the Playwright preview's VITE_AUTH_ADAPTER=controlled flag.
 */
export class ControlledQuizzMarketplaceGateway implements QuizzMarketplaceGateway {
  publishQuizz(submission: QuizzListingSubmission): Promise<void> {
    const identity = currentIdentity();
    const listing: StoredListing = {
      id: crypto.randomUUID(),
      quizzId: submission.quizzId,
      ownerId: identity.userId,
      title: submission.title,
      description: submission.description,
      certified: false,
      hidden: false,
      averageRating: null,
      ratingCount: 0,
      publishedAt: new Date().toISOString(),
      certifiedAt: null,
      hiddenAt: null,
      ratings: {},
    };
    writeListings([listing, ...readListings()]);
    return Promise.resolve();
  }

  listVisibleListings(): Promise<readonly QuizzListing[]> {
    const listings = readListings();
    return Promise.resolve(
      listings
        .filter((listing) => !listing.hidden)
        .map((listing) => ({ ...listing, ...ratingSummary(listing) })),
    );
  }

  getListingPreview(listingId: string): Promise<QuizzListingPreview> {
    const listings = readListings();
    const listing = listings.find(
      (item) => item.id === listingId && !item.hidden,
    );
    if (!listing) return Promise.reject(new Error('Listing introuvable.'));
    return Promise.resolve({
      listingId: listing.id,
      title: listing.title,
      description: listing.description,
      certified: listing.certified,
      ...ratingSummary(listing),
      questions: [],
    });
  }

  subscribeToListing(listingId: string): Promise<void> {
    const identity = currentIdentity();
    const listings = readListings();
    if (!listings.some((listing) => listing.id === listingId && !listing.hidden)) {
      return Promise.reject(new Error('Listing introuvable.'));
    }
    const subscriptions = readSubscriptions();
    const key = `${listingId}:${identity.userId}`;
    if (!subscriptions.includes(key)) writeSubscriptions([...subscriptions, key]);
    return Promise.resolve();
  }

  hasSubscribed(listingId: string): Promise<boolean> {
    const identity = currentIdentity();
    const key = `${listingId}:${identity.userId}`;
    return Promise.resolve(readSubscriptions().includes(key));
  }

  rateListing(submission: QuizzRatingSubmission): Promise<void> {
    const identity = currentIdentity();
    const key = `${submission.listingId}:${identity.userId}`;
    if (!readSubscriptions().includes(key)) {
      return Promise.reject(
        new Error('Seuls les utilisateurs abonnés à ce Quizz peuvent le noter.'),
      );
    }
    const listings = readListings();
    const updated = listings.map((listing) =>
      listing.id === submission.listingId
        ? { ...listing, ratings: { ...listing.ratings, [identity.userId]: submission.score } }
        : listing,
    );
    writeListings(updated);
    return Promise.resolve();
  }

  listSubscribedQuizzContent(): Promise<readonly SubscribedQuizzContent[]> {
    const identity = currentIdentity();
    const subscriptions = readSubscriptions();
    const listings = readListings();
    const content = subscriptions
      .filter((key) => key.endsWith(`:${identity.userId}`))
      .map((key) => key.slice(0, key.lastIndexOf(':')))
      .flatMap((listingId) => {
        const listing = listings.find((item) => item.id === listingId);
        return listing
          ? [
              {
                listingId: listing.id,
                quizzId: listing.quizzId,
                ownerId: listing.ownerId,
                title: listing.title,
                description: listing.description,
                certified: listing.certified,
                questions: [],
              },
            ]
          : [];
      });
    return Promise.resolve(content);
  }

  adminListListings(): Promise<readonly QuizzListing[]> {
    const identity = currentIdentity();
    if (!isAdmin(identity.role)) {
      return Promise.reject(
        new Error('Seuls les administrateurs consultent la modération marketplace.'),
      );
    }
    const listings = readListings();
    return Promise.resolve(
      listings.map((listing) => ({ ...listing, ...ratingSummary(listing) })),
    );
  }

  adminSetCertified(listingId: string, certified: boolean): Promise<void> {
    const identity = currentIdentity();
    if (!isAdmin(identity.role)) {
      return Promise.reject(
        new Error('Seuls les administrateurs certifient un Quizz.'),
      );
    }
    writeListings(
      readListings().map((listing) =>
        listing.id === listingId
          ? {
              ...listing,
              certified,
              certifiedAt: certified ? new Date().toISOString() : null,
            }
          : listing,
      ),
    );
    return Promise.resolve();
  }

  adminSetHidden(listingId: string, hidden: boolean): Promise<void> {
    const identity = currentIdentity();
    if (!isAdmin(identity.role)) {
      return Promise.reject(
        new Error('Seuls les administrateurs modèrent un Quizz.'),
      );
    }
    writeListings(
      readListings().map((listing) =>
        listing.id === listingId
          ? {
              ...listing,
              hidden,
              hiddenAt: hidden ? new Date().toISOString() : null,
            }
          : listing,
      ),
    );
    return Promise.resolve();
  }
}
