export const CHATGPT_IMPORT_LIMITS = Object.freeze({
  totalCharacters: 1_000_000,
  questions: 100,
  segmentsPerField: 100,
  correctionSteps: 30,
  tags: 30,
  uncertainties: 30,
  textCharacters: 20_000,
  variables: 32,
  importIdCharacters: 200,
});

export const CHATGPT_IMPORT_FORBIDDEN_FIELDS = Object.freeze([
  'ownerId',
  'userId',
  'source',
  'status',
  'validated',
  'partId',
  'role',
  'createdAt',
  'updatedAt',
  'questionId',
] as const);
