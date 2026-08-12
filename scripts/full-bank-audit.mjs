import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditFullBank } from './full-bank/audit.mjs';

const sourcePath = resolve(
  process.argv[2] ?? 'data/source/Base_Complete_Quiz_TSI_1765_Generateurs.json',
);
const sourceBytes = await readFile(sourcePath);
let rows;
try {
  rows = JSON.parse(sourceBytes.toString('utf8'));
} catch (error) {
  throw new Error(`JSON global invalide : ${error.message}`);
}
const startedAt = performance.now();
const { report, sourceTests } = auditFullBank(rows, sourceBytes);
console.log(
  JSON.stringify(
    {
      sourceSha256: report.sourceSha256,
      total: report.total,
      principal: report.principal,
      automatisme: report.automatisme,
      uniqueIds: report.uniqueIds,
      uniqueSignatures: report.uniqueSignatures,
      principalNotions: report.principalNotions,
      invalidRows: report.invalidRows,
      unsupportedParameterSchemas: report.unsupportedParameterSchemas,
      sourceRelationOperators: report.sourceRelationOperators,
      unsupportedRelations: report.unsupportedRelations,
      generatorsWithLessThan10Variants:
        report.generatorsWithLessThan10Variants.length,
      sourceTestVectors: sourceTests.reduce(
        (total, entry) => total + entry.vectors.length,
        0,
      ),
      auditDurationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    },
    null,
    2,
  ),
);
