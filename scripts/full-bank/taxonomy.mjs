export const PARTS = Object.freeze([
  { id: 'fundamentals', label: 'Bases indispensables', order: 0 },
  { id: 'sequences', label: 'Suites', order: 1 },
  { id: 'functions-analysis', label: 'Fonctions et analyse', order: 2 },
  { id: 'trigonometry', label: 'Trigonométrie', order: 3 },
  { id: 'complex-numbers', label: 'Nombres complexes', order: 4 },
  {
    id: 'probabilities-statistics',
    label: 'Probabilités et statistiques',
    order: 5,
  },
  { id: 'geometry-measurements', label: 'Géométrie et mesures', order: 6 },
  { id: 'algorithms', label: 'Algorithmique et Python', order: 7 },
]);

export const CHAPTERS = Object.freeze(
  [
    ['numbers-arithmetic', 'fundamentals', 'Nombres et arithmétique'],
    ['algebraic-calculus', 'fundamentals', 'Calcul algébrique'],
    [
      'equations-signs-inequalities',
      'fundamentals',
      'Équations, signes et inéquations',
    ],
    ['sequences', 'sequences', 'Suites numériques'],
    [
      'reference-functions-domains',
      'functions-analysis',
      'Fonctions de référence et domaines',
    ],
    [
      'analysis-logarithms-exponentials',
      'functions-analysis',
      'Analyse, logarithmes et exponentielles',
    ],
    [
      'derivatives-function-study',
      'functions-analysis',
      'Dérivation et étude de fonctions',
    ],
    ['primitives-integrals', 'functions-analysis', 'Primitives et intégrales'],
    ['trigonometry', 'trigonometry', 'Trigonométrie'],
    ['complex-numbers', 'complex-numbers', 'Nombres complexes'],
    [
      'probabilities-statistics',
      'probabilities-statistics',
      'Probabilités et statistiques',
    ],
    ['analytic-geometry', 'geometry-measurements', 'Géométrie analytique'],
    [
      'euclidean-geometry-measurements',
      'geometry-measurements',
      'Géométrie euclidienne et mesures',
    ],
    ['algorithms-python', 'algorithms', 'Algorithmique et Python'],
  ].map(([id, partId, label], order) => ({ id, partId, label, order })),
);

const CHAPTER_BY_LABEL = new Map(CHAPTERS.map((entry) => [entry.label, entry]));

export function createOfficialProgram(rows) {
  const principal = rows.filter((row) => row.Type_base === 'PRINCIPAL');
  const notions = [];
  const seen = new Set();
  const chapterNotionOrder = new Map();
  for (const row of principal) {
    if (seen.has(row.Notion_ID)) continue;
    seen.add(row.Notion_ID);
    const chapter = CHAPTER_BY_LABEL.get(row.Chapitre);
    if (!chapter)
      throw new Error(
        `${row.Calcul_ID}: chapitre sans mapping explicite « ${row.Chapitre} ».`,
      );
    const order = chapterNotionOrder.get(chapter.id) ?? 0;
    chapterNotionOrder.set(chapter.id, order + 1);
    notions.push({
      id: row.Notion_ID,
      chapterId: chapter.id,
      label: row.Notion,
      order,
    });
  }
  return { schemaVersion: 1, parts: PARTS, chapters: CHAPTERS, notions };
}

export function principalClassification(row) {
  const chapter = CHAPTER_BY_LABEL.get(row.Chapitre);
  if (!chapter)
    throw new Error(`${row.Calcul_ID}: chapitre principal non mappé.`);
  return {
    kind: 'official',
    partId: chapter.partId,
    chapterId: chapter.id,
    notionId: row.Notion_ID,
  };
}

export function classificationForNotion(program, notionId) {
  const notion = program.notions.find((entry) => entry.id === notionId);
  if (!notion) return null;
  const chapter = program.chapters.find(
    (entry) => entry.id === notion.chapterId,
  );
  if (!chapter) return null;
  return {
    kind: 'official',
    partId: chapter.partId,
    chapterId: chapter.id,
    notionId,
  };
}
