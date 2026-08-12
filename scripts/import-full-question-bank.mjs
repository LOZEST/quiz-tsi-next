import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import prettier from 'prettier';
import { validateQuestion } from '../src/domain/questions/Question.ts';
import { auditFullBank } from './full-bank/audit.mjs';
import { automationNotionMapping } from './full-bank/automation-taxonomy.mjs';
import { compileContent } from './full-bank/content-compiler.mjs';
import {
  classificationForNotion,
  createOfficialProgram,
  principalClassification,
} from './full-bank/taxonomy.mjs';

const GENERATED_AT = '2026-08-12T00:00:00.000Z';
const DEFAULT_SOURCE =
  'data/source/Base_Complete_Quiz_TSI_1765_Generateurs.json';
const BUNDLE_OUTPUT = resolve(
  'src/data/question-banks/full-production-v1.json',
);
const PROGRAM_OUTPUT = resolve('src/data/program/official-program-v2.json');
const AUDIT_OUTPUT = resolve('tests/fixtures/full-production-bank-audit.json');
const DIFFICULTY = Object.freeze({
  Fondamental: 'fundamental',
  Normal: 'standard',
  Piège: 'trap',
});

function fail(message) {
  throw new Error(message);
}

function sourceReference(row) {
  const details = [
    row.Source_document,
    row.Page_source ? `page ${row.Page_source}` : '',
    row.Source_structure,
  ].filter(Boolean);
  return {
    sourceLabel: 'Base complète Quiz TSI — 1765 générateurs validés',
    sourceReference: row.Calcul_ID,
    sourceLocator: details.length > 0 ? details.join(' — ') : null,
  };
}

function compileTracked(source, ids, calculId, field, metrics) {
  const compiled = compileContent(source, ids);
  metrics.structured += compiled.structured;
  metrics.fallback += compiled.fallback;
  if (compiled.fallback > 0) metrics.fallbackIds.add(calculId);
  metrics.fields.push({
    calculId,
    field,
    structured: compiled.structured,
    fallback: compiled.fallback,
  });
  return compiled.segments;
}

function visibleReferences(segments) {
  const result = new Set();
  for (const segment of segments) {
    const source =
      segment.kind === 'text' ? segment.value : segment.math?.source;
    if (!source) continue;
    for (const match of source.matchAll(/@([A-Za-z][A-Za-z0-9_]*)/g))
      result.add(match[1]);
  }
  return result;
}

function analyzeReferences(question) {
  const definitions = new Set([
    ...(question.parameterization?.variables.map((entry) => entry.id) ?? []),
    ...(question.parameterization?.derivedVariables?.map((entry) => entry.id) ??
      []),
  ]);
  const references = new Set();
  const visitSegments = (segments) => {
    for (const segment of segments) {
      const source =
        segment.kind === 'text' ? segment.value : segment.math?.source;
      if (!source) continue;
      for (const match of source.matchAll(/@([A-Za-z][A-Za-z0-9_]*)/g))
        references.add(match[1]);
    }
  };
  visitSegments(question.prompt);
  visitSegments(question.hint);
  question.correction.forEach((step) => visitSegments(step.content));
  return [...references].filter((id) => !definitions.has(id)).sort();
}

function serializeValues(values, ids) {
  return ids
    .map((id) => {
      const value = values[id];
      const canonical =
        typeof value === 'number'
          ? `n:${Object.is(value, -0) ? 0 : value}`
          : typeof value === 'string'
            ? `s:${JSON.stringify(value)}`
            : `b:${value}`;
      return `${JSON.stringify(id)}=${canonical}`;
    })
    .join('|');
}

function instantiateSegmentsForAudit(segments, values, calculId, test) {
  const replace = (source) =>
    source.replace(/@([A-Za-z][A-Za-z0-9_]*)/g, (match, id) => {
      if (!Object.hasOwn(values, id))
        fail(
          `${calculId}: Test${test} contient la référence inconnue ${match}.`,
        );
      return String(values[id]);
    });
  return segments.map((segment) =>
    segment.kind === 'text'
      ? { ...segment, value: replace(segment.value) }
      : segment.kind === 'inline-math' || segment.kind === 'display-math'
        ? {
            ...segment,
            math: { ...segment.math, source: replace(segment.math.source) },
          }
        : segment,
  );
}

function ensureVisibleBaseVariables(prompt, parameterization) {
  if (parameterization === null) return { prompt, appended: [] };
  const visible = visibleReferences(prompt);
  const missing = parameterization.variables
    .map((entry) => entry.id)
    .filter((id) => !visible.has(id));
  if (missing.length === 0) return { prompt, appended: [] };
  return {
    prompt: [
      ...prompt,
      {
        kind: 'text',
        value: ` Paramètres de cette variante : ${missing
          .map((id) => `${id} = @${id}`)
          .join(', ')}.`,
      },
    ],
    appended: missing,
  };
}

function hintSource(row) {
  return [
    row.Contraintes_generation && row.Contraintes_generation !== 'Aucune'
      ? `Contraintes de génération : ${row.Contraintes_generation}`
      : '',
    row.Valeurs_interdites && row.Valeurs_interdites !== 'Aucune'
      ? `Valeurs interdites : ${row.Valeurs_interdites}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function validationVariantCount(parsed) {
  if (parsed.parameterization === null) return null;
  const { variantSpace } = parsed;
  if (variantSpace.exhaustive) {
    if (!variantSpace.validCombinations)
      fail(`${parsed.row.Calcul_ID}: aucune combinaison valide.`);
    return Math.min(10, variantSpace.validCombinations);
  }
  return 10;
}

function sourceTestResult(question, sourceTest) {
  const ids =
    question.parameterization?.variables.map((entry) => entry.id) ?? [];
  return sourceTest.vectors.map((vector) => {
    const instantiated = {
      prompt: instantiateSegmentsForAudit(
        question.prompt,
        vector.resolvedParameters,
        question.id,
        vector.test,
      ),
      hint: instantiateSegmentsForAudit(
        question.hint,
        vector.resolvedParameters,
        question.id,
        vector.test,
      ),
      correction: question.correction.map((step) => ({
        ...step,
        content: instantiateSegmentsForAudit(
          step.content,
          vector.resolvedParameters,
          question.id,
          vector.test,
        ),
      })),
    };
    const allIds = [
      ...ids,
      ...(question.parameterization?.derivedVariables?.map(
        (entry) => entry.id,
      ) ?? []),
    ];
    const serialized = serializeValues(vector.resolvedParameters, allIds);
    const repeated = serializeValues(vector.resolvedParameters, allIds);
    if (serialized !== repeated)
      fail(`${question.id}: sérialisation Test${vector.test} instable.`);
    const rendered = JSON.stringify(instantiated);
    if (/@[A-Za-z][A-Za-z0-9_]*/.test(rendered))
      fail(
        `${question.id}: Test${vector.test} conserve une référence non résolue.`,
      );
    return {
      ...vector,
      serializedParameters: serialized,
    };
  });
}

const sourcePath = resolve(process.argv[2] ?? DEFAULT_SOURCE);
const sourceBytes = await readFile(sourcePath);
let rows;
try {
  rows = JSON.parse(sourceBytes.toString('utf8'));
} catch (error) {
  fail(`JSON global invalide : ${error.message}`);
}

const startedAt = performance.now();
const audited = auditFullBank(rows, sourceBytes);
const program = createOfficialProgram(rows);
const sourceTestsById = new Map(
  audited.sourceTests.map((entry) => [entry.calculId, entry]),
);
const metrics = {
  structured: 0,
  fallback: 0,
  fallbackIds: new Set(),
  fields: [],
};
const unmappedRows = [];
const unknownParameterReferences = [];
const appendedParameterDeclarations = [];
const sourceTestVectors = [];

const questions = audited.parsed.map((parsed) => {
  const { row } = parsed;
  let classification;
  let taxonomyRule;
  if (row.Type_base === 'PRINCIPAL') {
    classification = principalClassification(row);
    taxonomyRule = `principal:${row.Notion_ID}`;
  } else {
    const mapping = automationNotionMapping(row);
    classification = mapping
      ? classificationForNotion(program, mapping.notionId)
      : null;
    taxonomyRule = mapping?.rule ?? null;
  }
  if (!classification) {
    unmappedRows.push({
      calculId: row.Calcul_ID,
      categorie: row.Categorie,
      famille: row.Famille,
    });
    return null;
  }
  const ids = [
    ...(parsed.parameterization?.variables.map((entry) => entry.id) ?? []),
    ...(parsed.parameterization?.derivedVariables?.map((entry) => entry.id) ??
      []),
  ];
  const compiledPrompt = compileTracked(
    row.Enonce_parametrique,
    ids,
    row.Calcul_ID,
    'Enonce_parametrique',
    metrics,
  );
  const visiblePrompt = ensureVisibleBaseVariables(
    compiledPrompt,
    parsed.parameterization,
  );
  if (visiblePrompt.appended.length > 0)
    appendedParameterDeclarations.push({
      calculId: row.Calcul_ID,
      parameterIds: visiblePrompt.appended,
    });
  const hint = hintSource(row);
  const count = validationVariantCount(parsed);
  const parameterization =
    parsed.parameterization === null
      ? null
      : { ...parsed.parameterization, validationVariantCount: count };
  const question = {
    id: row.Calcul_ID,
    version: 1,
    source: 'static',
    ownerId: null,
    status: 'published',
    provenance: null,
    classification,
    type: row.Type_base === 'PRINCIPAL' ? 'calculation' : 'reflex',
    difficulty: row.Type_base === 'PRINCIPAL' ? DIFFICULTY[row.Niveau] : null,
    parameterization,
    prompt: visiblePrompt.prompt,
    hint: hint ? compileTracked(hint, ids, row.Calcul_ID, 'hint', metrics) : [],
    correction: [
      {
        id: `${row.Calcul_ID}-expected-answer`,
        title: 'Réponse attendue',
        content: compileTracked(
          row.Reponse_generale,
          ids,
          row.Calcul_ID,
          'Reponse_generale',
          metrics,
        ),
      },
      {
        id: `${row.Calcul_ID}-correction`,
        title: 'Correction',
        content: compileTracked(
          row.Correction,
          ids,
          row.Calcul_ID,
          'Correction',
          metrics,
        ),
      },
    ],
    tags: [
      row.Type_base,
      row.Origine_validation,
      row.Categorie,
      row.Famille,
      row.Signature_structurelle,
      ...(row.Notion_ID ? [row.Notion_ID] : []),
      `source-level:${row.Niveau}`,
      `source-schema:${parsed.sourceSchemaVersion}`,
      `taxonomy-rule:${taxonomyRule}`,
      ...(count !== null && count < 10 ? ['finite-official-domain'] : []),
    ],
    validated: true,
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
  };
  const validated = validateQuestion(question);
  if (!validated.ok)
    fail(
      `${row.Calcul_ID}: Question invalide : ${validated.issues
        .map((entry) => `${entry.path} ${entry.message}`)
        .join('; ')}`,
    );
  const references = analyzeReferences(question);
  if (references.length > 0)
    unknownParameterReferences.push({
      calculId: row.Calcul_ID,
      unknownReferences: references,
      diagnostics: [],
    });
  const sourceTest = sourceTestsById.get(row.Calcul_ID);
  if (!sourceTest) fail(`${row.Calcul_ID}: tests source audités absents.`);
  sourceTestVectors.push({
    calculId: row.Calcul_ID,
    vectors: sourceTestResult(question, sourceTest),
  });
  return {
    question,
    provenance: {
      mode: 'extend',
      references: [sourceReference(row)],
    },
  };
});

if (unmappedRows.length > 0 || unknownParameterReferences.length > 0)
  fail(
    `Activation production bloquée : ${JSON.stringify({
      unmappedRows,
      unknownParameterReferences,
    })}`,
  );

const bundle = {
  schemaVersion: 1,
  bundleId: 'quiz-tsi-official-full-v1',
  generatedAt: GENERATED_AT,
  defaultProvenance: [
    {
      sourceLabel: 'Base complète Quiz TSI — 1765 générateurs validés',
      sourceReference: `SHA-256 ${createHash('sha256')
        .update(sourceBytes)
        .digest('hex')}`,
      sourceLocator: null,
    },
  ],
  questions,
};
const bundleJson = JSON.stringify(bundle);
const importDurationMs =
  Math.round((performance.now() - startedAt) * 100) / 100;
const report = {
  ...audited.report,
  unmappedRows,
  unsupportedRelations: audited.report.unsupportedRelations,
  unknownParameterReferences,
  mathSegmentsStructured: metrics.structured,
  mathSegmentsFallbackToText: metrics.fallback,
  fallbackCalculIds: [...metrics.fallbackIds].sort(),
  mathFallbacks: metrics.fields.filter((entry) => entry.fallback > 0),
  appendedParameterDeclarations,
  nonParameterizedGenerators: audited.parsed
    .filter((entry) => entry.parameterization === null)
    .map((entry) => entry.row.Calcul_ID),
  sourceTests: sourceTestVectors,
  generatedBundleBytes: Buffer.byteLength(bundleJson),
  sourceBytes: sourceBytes.byteLength,
};

for (const [path, value] of [
  [BUNDLE_OUTPUT, bundle],
  [PROGRAM_OUTPUT, program],
  [AUDIT_OUTPUT, report],
]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    await prettier.format(JSON.stringify(value), { parser: 'json' }),
  );
}

console.log(
  JSON.stringify(
    {
      sourceSha256: report.sourceSha256,
      sourceRows: report.total,
      convertedGenerators: questions.length,
      principal: report.principal,
      automatisme: report.automatisme,
      principalNotions: report.principalNotions,
      sourceTestVectors: sourceTestVectors.reduce(
        (total, entry) => total + entry.vectors.length,
        0,
      ),
      unsupportedRelations: report.unsupportedRelations,
      unmappedRows,
      unknownParameterReferences,
      mathSegmentsStructured: report.mathSegmentsStructured,
      mathSegmentsFallbackToText: report.mathSegmentsFallbackToText,
      generatorsWithLessThan10Variants:
        report.generatorsWithLessThan10Variants.length,
      nonParameterizedGenerators: report.nonParameterizedGenerators.length,
      generatedBundleBytes: report.generatedBundleBytes,
      sourceBytes: report.sourceBytes,
      importDurationMs,
      outputs: [BUNDLE_OUTPUT, PROGRAM_OUTPUT, AUDIT_OUTPUT],
    },
    null,
    2,
  ),
);
