export const quizzRatingScores = [1, 2, 3, 4, 5] as const;

export type QuizzRatingScore = (typeof quizzRatingScores)[number];

export function isQuizzRatingScore(value: unknown): value is QuizzRatingScore {
  return (
    typeof value === 'number' &&
    (quizzRatingScores as readonly number[]).includes(value)
  );
}

export interface QuizzRating {
  readonly id: string;
  readonly listingId: string;
  readonly raterId: string;
  readonly score: QuizzRatingScore;
  readonly comment: string | null;
  readonly createdAt: string;
}
