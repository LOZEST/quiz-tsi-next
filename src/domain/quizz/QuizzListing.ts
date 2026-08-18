export interface QuizzListing {
  readonly id: string;
  readonly quizzId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly certified: boolean;
  readonly hidden: boolean;
  readonly averageRating: number | null;
  readonly ratingCount: number;
  readonly publishedAt: string;
  readonly certifiedAt: string | null;
  readonly hiddenAt: string | null;
  readonly authorDisplayName: string | null;
}
