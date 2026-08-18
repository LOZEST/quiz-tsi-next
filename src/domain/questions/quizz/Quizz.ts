export type QuizzVisibility = 'public' | 'private';

export interface Quizz {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly visibility: QuizzVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function assertQuizzOwner(
  value: { readonly ownerId: string },
  ownerId: string,
): void {
  if (!ownerId || value.ownerId !== ownerId)
    throw new Error('Compte incohérent.');
}
