import type {
  ContentSegment,
  CorrectionStep,
  Question,
} from '../questions/Question';
import type { QuizzListing } from './QuizzListing';
import type { QuizzRatingScore } from './QuizzRating';

export interface QuizzListingSubmission {
  readonly quizzId: string;
  readonly title: string;
  readonly description: string;
}

export interface QuizzListingPreviewQuestion {
  readonly id: string;
  readonly prompt: readonly ContentSegment[];
  readonly correction: readonly CorrectionStep[];
}

export interface QuizzListingPreview {
  readonly listingId: string;
  readonly title: string;
  readonly description: string;
  readonly certified: boolean;
  readonly averageRating: number | null;
  readonly ratingCount: number;
  readonly authorDisplayName: string | null;
  readonly questions: readonly QuizzListingPreviewQuestion[];
}

export interface QuizzRatingSubmission {
  readonly listingId: string;
  readonly score: QuizzRatingScore;
  readonly comment: string | null;
}

export interface SubscribedQuizzContent {
  readonly listingId: string;
  readonly quizzId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly certified: boolean;
  readonly questions: readonly Readonly<Question>[];
}

export interface QuizzMarketplaceGateway {
  publishQuizz(submission: QuizzListingSubmission): Promise<void>;
  setOwnListingHidden(quizzId: string, hidden: boolean): Promise<void>;
  listVisibleListings(): Promise<readonly QuizzListing[]>;
  getListingPreview(listingId: string): Promise<QuizzListingPreview>;
  subscribeToListing(listingId: string): Promise<void>;
  hasSubscribed(listingId: string): Promise<boolean>;
  unsubscribeFromListing(listingId: string): Promise<void>;
  rateListing(submission: QuizzRatingSubmission): Promise<void>;
  listSubscribedQuizzContent(): Promise<readonly SubscribedQuizzContent[]>;
  adminListListings(): Promise<readonly QuizzListing[]>;
  adminSetCertified(listingId: string, certified: boolean): Promise<void>;
  adminSetHidden(listingId: string, hidden: boolean): Promise<void>;
}
