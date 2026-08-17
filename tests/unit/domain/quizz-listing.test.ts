import { isQuizzRatingScore } from '@domain/quizz/QuizzRating';
import type { QuizzListing } from '@domain/quizz/QuizzListing';

describe('QuizzListing shape', () => {
  it('carries certified and hidden as independent booleans, no status enum', () => {
    const listing: QuizzListing = {
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
    };
    expect(listing.certified).toBe(true);
    expect(listing.hidden).toBe(false);
    expect('status' in listing).toBe(false);
  });
});

describe('isQuizzRatingScore', () => {
  it('accepts integers from 1 to 5', () => {
    for (const score of [1, 2, 3, 4, 5]) {
      expect(isQuizzRatingScore(score)).toBe(true);
    }
  });

  it('rejects out-of-range numbers, decimals, and non-numbers', () => {
    expect(isQuizzRatingScore(0)).toBe(false);
    expect(isQuizzRatingScore(6)).toBe(false);
    expect(isQuizzRatingScore(3.5)).toBe(false);
    expect(isQuizzRatingScore('3')).toBe(false);
    expect(isQuizzRatingScore(null)).toBe(false);
  });
});
