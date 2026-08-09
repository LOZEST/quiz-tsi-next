import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import prettier from 'prettier';
import { calculateNumAnswer, parseExpectedAnswer } from './num-bank-audit.mjs';

const EXPECTED_HEADERS = [
  'Calcul_ID',
  'Notion_ID',
  'Code_chapitre',
  'Chapitre',
  'Niveau',
  'Famille_structurelle_precise',
  'Enonce_parametrique',
  'Parametres_JSON',
  'Contraintes_generation',
  'Reponse_generale',
  'Correction',
  'Methode_decisive',
  'Piege_cible',
  'Signature_structurelle',
  'Test1_Parametres_JSON',
  'Test1_Expression_initiale',
  'Test1_Reponse_generale',
  'Test1_Statut',
  'Test2_Parametres_JSON',
  'Test2_Expression_initiale',
  'Test2_Reponse_generale',
  'Test2_Statut',
  'Validation_mathematique',
];
const DIFFICULTY = {
  Fondamental: 'fundamental',
  Normal: 'standard',
  Piège: 'trap',
};
const FUNCTION_NAMES = {
  abs: 'abs',
  gcd: 'gcd',
  isSquare: 'is-square',
  squarefree: 'squarefree',
  hasPrimeFactorOtherThan2Or5: 'has-prime-factor-other-than-2-or-5',
};
const GENERATED_AT =
  process.env.QTSI_BANK_GENERATED_AT ?? '2026-08-07T00:00:00.000Z';
const outputPath = resolve(
  process.env.QTSI_BANK_OUTPUT ??
    'src/data/question-banks/num-production-v1.json',
);
const auditOutputPath = resolve(
  process.env.QTSI_BANK_AUDIT_OUTPUT ??
    'tests/fixtures/num-production-source-tests.json',
);
const PUBLICATION_EXCEPTIONS = new Map([
  [
    'NUM-F02-P04',
    {
      validationVariantCount: 9,
      reason: 'Domaine maître limité à a ∈ [2;10].',
    },
  ],
]);

function fail(message) {
  throw new Error(message);
}
function literal(value) {
  return { kind: 'literal', value };
}
function tokenize(source) {
  const tokens = source
    .replaceAll(' mod ', '%')
    .match(
      /\s*(>=|<=|!=|[()+\-*/^%,]|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*)\s*/g,
    );
  if (
    !tokens ||
    tokens.join('').replaceAll(/\s/g, '') !==
      source.replaceAll(' mod ', '%').replaceAll(/\s/g, '')
  )
    fail(`Expression non prise en charge : ${source}`);
  return tokens.map((token) => token.trim());
}
function parseExpression(source) {
  if (typeof source === 'number' || typeof source === 'boolean')
    return literal(source);
  const tokens = tokenize(String(source));
  let cursor = 0;
  const binary = {
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '%': 'modulo',
    '^': 'power',
  };
  function primary() {
    const token = tokens[cursor++];
    if (token === '-')
      return { kind: 'unary', operator: 'negate', operand: primary() };
    if (token === '(') {
      const value = expression(0);
      if (tokens[cursor++] !== ')')
        fail(`Parenthèse fermante absente : ${source}`);
      return value;
    }
    if (/^\d/.test(token ?? '')) return literal(Number(token));
    if (/^[A-Za-z_]/.test(token ?? '')) {
      if (tokens[cursor] !== '(')
        return { kind: 'variable', variableId: token };
      cursor += 1;
      const args = [];
      if (tokens[cursor] !== ')')
        do {
          args.push(expression(0));
        } while (tokens[cursor] === ',' && ++cursor);
      if (tokens[cursor++] !== ')') fail(`Appel invalide : ${source}`);
      const fn = FUNCTION_NAMES[token];
      if (!fn) fail(`Fonction non prise en charge : ${token}`);
      return { kind: 'math-function', function: fn, arguments: args };
    }
    fail(`Expression invalide : ${source}`);
  }
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
  function expression(minimum) {
    let left = primary();
    while (binary[tokens[cursor]] && precedence[tokens[cursor]] >= minimum) {
      const operatorToken = tokens[cursor++];
      const priority = precedence[operatorToken];
      const right = expression(priority + (operatorToken === '^' ? 0 : 1));
      left = { kind: 'binary', operator: binary[operatorToken], left, right };
    }
    return left;
  }
  const result = expression(0);
  if (cursor !== tokens.length)
    fail(`Expression partiellement lue : ${source}`);
  return result;
}
function relationToAst(relation) {
  if (relation.op === 'and' || relation.op === 'or')
    return {
      kind: 'logical',
      operator: relation.op,
      operands: relation.args.map(relationToAst),
    };
  if (relation.op === 'not')
    return { kind: 'logical-not', operand: relationToAst(relation.arg) };
  if (relation.op === 'parity')
    return {
      kind: 'comparison',
      operator: 'equal',
      left: {
        kind: 'binary',
        operator: 'modulo',
        left: parseExpression(relation.left),
        right: literal(2),
      },
      right: literal(relation.right === 'odd' ? 1 : 0),
    };
  const comparisons = {
    '=': 'equal',
    '!=': 'not-equal',
    '<': 'less-than',
    '<=': 'less-than-or-equal',
    '>': 'greater-than',
    '>=': 'greater-than-or-equal',
  };
  const operator = comparisons[relation.op];
  if (!operator) fail(`Relation non prise en charge : ${relation.op}`);
  return {
    kind: 'comparison',
    operator,
    left: parseExpression(relation.left),
    right: parseExpression(relation.right),
  };
}
function evaluateAuditExpression(node, parameters) {
  if (node.kind === 'literal') return node.value;
  if (node.kind === 'variable') return parameters[node.variableId];
  if (node.kind === 'unary')
    return -evaluateAuditExpression(node.operand, parameters);
  if (node.kind === 'binary') {
    const left = evaluateAuditExpression(node.left, parameters);
    const right = evaluateAuditExpression(node.right, parameters);
    return {
      add: () => left + right,
      subtract: () => left - right,
      multiply: () => left * right,
      divide: () => left / right,
      modulo: () => ((left % right) + right) % right,
      power: () => left ** right,
    }[node.operator]();
  }
  if (node.kind === 'comparison') {
    const left = evaluateAuditExpression(node.left, parameters);
    const right = evaluateAuditExpression(node.right, parameters);
    return {
      equal: () => left === right,
      'not-equal': () => left !== right,
      'less-than': () => left < right,
      'less-than-or-equal': () => left <= right,
      'greater-than': () => left > right,
      'greater-than-or-equal': () => left >= right,
    }[node.operator]();
  }
  if (node.kind === 'logical')
    return node.operator === 'and'
      ? node.operands.every((entry) =>
          evaluateAuditExpression(entry, parameters),
        )
      : node.operands.some((entry) =>
          evaluateAuditExpression(entry, parameters),
        );
  if (node.kind === 'logical-not')
    return !evaluateAuditExpression(node.operand, parameters);
  if (node.kind === 'math-function') {
    const args = node.arguments.map((entry) =>
      evaluateAuditExpression(entry, parameters),
    );
    const gcd = (left, right) => {
      let a = Math.abs(left);
      let b = Math.abs(right);
      while (b !== 0) [a, b] = [b, a % b];
      return a;
    };
    const functions = {
      abs: Math.abs,
      gcd,
      'is-square': (value) => Number.isInteger(Math.sqrt(value)),
      squarefree: (value) => {
        for (let factor = 2; factor * factor <= value; factor += 1)
          if (value % (factor * factor) === 0) return false;
        return true;
      },
      'has-prime-factor-other-than-2-or-5': (value) => {
        let remainder = Math.abs(value);
        while (remainder % 2 === 0) remainder /= 2;
        while (remainder % 5 === 0) remainder /= 5;
        return remainder !== 1;
      },
    };
    return functions[node.function](...args);
  }
  fail(`Nœud d’audit non pris en charge : ${node.kind}`);
}
function domain(definition) {
  if (Array.isArray(definition.allowed))
    return { kind: 'choice', values: definition.allowed };
  if (definition.type !== 'integer')
    fail(`Type de domaine non pris en charge : ${definition.type}`);
  const excludedValues = [...(definition.exclude ?? [])];
  if (definition.parity === 'even' || definition.parity === 'odd') {
    for (
      let value = definition.min;
      value <= definition.max;
      value += definition.step
    )
      if (Math.abs(value % 2) !== (definition.parity === 'odd' ? 1 : 0))
        excludedValues.push(value);
  } else if (definition.parity !== 'any')
    fail(`Parité non prise en charge : ${definition.parity}`);
  return {
    kind: 'integer',
    minimum: definition.min,
    maximum: definition.max,
    step: definition.step,
    excludedValues: [...new Set(excludedValues)].sort((a, b) => a - b),
  };
}
const superscripts = new Set([
  '²',
  '³',
  '⁰',
  '¹',
  '⁴',
  '⁵',
  '⁶',
  '⁷',
  '⁸',
  '⁹',
]);
const explicitImplicitProducts = new Set(['ab', 'cd', 'dq', 'kd', 'mn']);
const mathPunctuation = new Set([
  '+',
  '−',
  '-',
  '*',
  '×',
  '·',
  '/',
  '^',
  '=',
  '≠',
  '<',
  '>',
  '≤',
  '≥',
  '(',
  ')',
  '[',
  ']',
  '|',
  '√',
  '%',
  '÷',
]);
const asciiLetter = (character) =>
  character !== undefined &&
  ((character >= 'A' && character <= 'Z') ||
    (character >= 'a' && character <= 'z'));
const digit = (character) =>
  character !== undefined && character >= '0' && character <= '9';

function splitKnownIdentifiers(token, identifiers) {
  const output = [];
  let cursor = 0;
  const sorted = [...identifiers].sort(
    (left, right) => right.length - left.length,
  );
  while (cursor < token.length) {
    const identifier = sorted.find((entry) => token.startsWith(entry, cursor));
    if (!identifier) return null;
    output.push(identifier);
    cursor += identifier.length;
  }
  return output;
}

export function compileStructuredSource(sourceValue, identifierValues) {
  const source = String(sourceValue)
    .replace('{N}', '2^a*3^b*5^c')
    .replace('{2,3,5,9}', '{2, 3, 5, 9}');
  const identifiers = new Set(identifierValues);
  let output = '';
  let cursor = 0;
  let equation = false;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '=') equation = true;
    if (
      equation &&
      (character === '.' || character === ';' || character === ':')
    )
      equation = false;
    if (!asciiLetter(character)) {
      output += character;
      cursor += 1;
      continue;
    }
    const start = cursor;
    while (asciiLetter(source[cursor])) cursor += 1;
    const token = source.slice(start, cursor);
    const parts = splitKnownIdentifiers(token, identifiers);
    const before = source[start - 1];
    const after = source[cursor];
    const mathematical =
      parts !== null &&
      (equation ||
        explicitImplicitProducts.has(token) ||
        mathPunctuation.has(before) ||
        mathPunctuation.has(after) ||
        superscripts.has(before) ||
        superscripts.has(after) ||
        digit(before) ||
        digit(after));
    output += mathematical
      ? `${parts.map((entry) => `@${entry}`).join('')}${digit(after) ? '*' : ''}`
      : token;
  }
  return output;
}
function sourceLocator(row, id, notion) {
  return `Feuille NUM, ligne ${row}, Calcul_ID ${id}, Notion_ID ${notion}`;
}

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) fail('Usage : npm run bank:import:num -- <classeur.xlsx>');
const sourceBytes = await readFile(sourcePath);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const xml = (entry) =>
  execFileSync('unzip', ['-p', sourcePath, entry], {
    encoding: 'utf8',
    maxBuffer: 20_000_000,
  });
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  isArray: (name) => ['sheet', 'Relationship', 'si', 'row', 'c'].includes(name),
});
const workbookXml = parser.parse(xml('xl/workbook.xml'));
const relationships = parser.parse(xml('xl/_rels/workbook.xml.rels'));
const numSheet = workbookXml.workbook.sheets.sheet.find(
  (entry) => entry.name === 'NUM',
);
if (!numSheet) fail('Feuille NUM absente.');
const relationship = relationships.Relationships.Relationship.find(
  (entry) => entry.Id === numSheet.id,
);
if (!relationship) fail('Relation de feuille NUM absente.');
const sharedXml = parser.parse(xml('xl/sharedStrings.xml'));
const shared = (sharedXml.sst.si ?? []).map((entry) => {
  if (typeof entry.t === 'string') return entry.t;
  if (entry.t && typeof entry.t['#text'] === 'string') return entry.t['#text'];
  const runs = Array.isArray(entry.r) ? entry.r : entry.r ? [entry.r] : [];
  return runs
    .map((run) =>
      typeof run.t === 'string' ? run.t : (run.t?.['#text'] ?? ''),
    )
    .join('');
});
const sheetPath = `xl/${relationship.Target.replace(/^\//, '').replace(/^xl\//, '')}`;
const worksheet = parser.parse(xml(sheetPath));
const matrix = worksheet.worksheet.sheetData.row.map((row) => {
  const values = [];
  for (const cell of row.c ?? []) {
    const column =
      cell.r
        .match(/^[A-Z]+/)[0]
        .split('')
        .reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    values[column] =
      cell.t === 's'
        ? shared[Number(cell.v)]
        : cell.t === 'inlineStr'
          ? (cell.is?.t ?? '')
          : (cell.v ?? '');
  }
  return { rowNumber: Number(row.r), values };
});
const header = matrix.find(({ values }) => values[0] === 'Calcul_ID');
if (!header) fail('En-têtes NUM absents.');
const headers = header.values.map(String);
for (const name of EXPECTED_HEADERS)
  if (!headers.includes(name)) fail(`Colonne obligatoire absente : ${name}`);
const rows = matrix
  .filter(
    ({ rowNumber, values }) =>
      rowNumber > header.rowNumber && String(values[0] ?? '').trim(),
  )
  .map(({ rowNumber, values }) => ({
    rowNumber,
    value: Object.fromEntries(
      headers.map((name, offset) => [name, String(values[offset] ?? '')]),
    ),
  }));
const ids = new Set(rows.map(({ value }) => value.Calcul_ID));
const notions = new Set(rows.map(({ value }) => value.Notion_ID));
const signatures = new Set(
  rows.map(({ value }) => value.Signature_structurelle),
);
const counts = Object.fromEntries(
  Object.keys(DIFFICULTY).map((level) => [
    level,
    rows.filter(({ value }) => value.Niveau === level).length,
  ]),
);
const perNotion = Object.fromEntries(
  [...notions].map((notionId) => [
    notionId,
    {
      total: rows.filter(({ value }) => value.Notion_ID === notionId).length,
      Fondamental: rows.filter(
        ({ value }) =>
          value.Notion_ID === notionId && value.Niveau === 'Fondamental',
      ).length,
      Normal: rows.filter(
        ({ value }) =>
          value.Notion_ID === notionId && value.Niveau === 'Normal',
      ).length,
      Piège: rows.filter(
        ({ value }) => value.Notion_ID === notionId && value.Niveau === 'Piège',
      ).length,
    },
  ]),
);
if (
  rows.length !== 60 ||
  ids.size !== 60 ||
  notions.size !== 4 ||
  signatures.size !== 60 ||
  counts.Fondamental !== 20 ||
  counts.Normal !== 20 ||
  counts['Piège'] !== 20 ||
  Object.values(perNotion).some(
    (entry) =>
      entry.total !== 15 ||
      entry.Fondamental !== 5 ||
      entry.Normal !== 5 ||
      entry.Piège !== 5,
  )
)
  fail(
    `Contrôle bloquant NUM échoué : ${JSON.stringify({ rows: rows.length, ids: ids.size, notions: notions.size, signatures: signatures.size, counts, perNotion })}`,
  );
let recalculatedTests = 0;
const auditVectors = [];
const questions = rows.map(({ rowNumber, value }) => {
  const specification = JSON.parse(value.Parametres_JSON);
  const constraintAsts = specification.relations.map(relationToAst);
  const variableIds = Object.keys(specification.parameters);
  const publicationException = PUBLICATION_EXCEPTIONS.get(value.Calcul_ID);
  for (const test of [1, 2]) {
    const parameters = JSON.parse(value[`Test${test}_Parametres_JSON`]);
    if (
      !value[`Test${test}_Expression_initiale`] ||
      !value[`Test${test}_Reponse_generale`]
    )
      fail(`Test ${test} incomplet pour ${value.Calcul_ID}`);
    for (const [id, definition] of Object.entries(specification.parameters)) {
      const parameter = parameters[id];
      const allowed = definition.allowed;
      if (
        typeof parameter !== 'number' ||
        !Number.isInteger(parameter) ||
        parameter < definition.min ||
        parameter > definition.max ||
        (parameter - definition.min) % definition.step !== 0 ||
        definition.exclude.includes(parameter) ||
        (Array.isArray(allowed) && !allowed.includes(parameter))
      )
        fail(`${value.Calcul_ID} test ${test} : paramètre ${id} hors domaine.`);
    }
    if (
      constraintAsts.some(
        (constraint) => !evaluateAuditExpression(constraint, parameters),
      )
    )
      fail(`${value.Calcul_ID} test ${test} : contrainte non respectée.`);
    const expected = parseExpectedAnswer(value[`Test${test}_Reponse_generale`]);
    const recalculated = calculateNumAnswer(value.Calcul_ID, parameters);
    if (JSON.stringify(recalculated) !== JSON.stringify(expected))
      fail(
        `${value.Calcul_ID} test ${test} : attendu ${JSON.stringify(expected)}, recalculé ${JSON.stringify(recalculated)}.`,
      );
    auditVectors.push({
      calculId: value.Calcul_ID,
      test,
      parameters,
      expected,
    });
    recalculatedTests += 1;
  }
  const parameterization = {
    schemaVersion: 1,
    variables: Object.entries(specification.parameters).map(
      ([id, definition]) => ({
        id,
        label: definition.role || id,
        domain: domain(definition),
      }),
    ),
    constraints: constraintAsts,
    validationVariantCount: publicationException?.validationVariantCount ?? 10,
  };
  return {
    question: {
      id: value.Calcul_ID,
      version: 1,
      source: 'static',
      ownerId: null,
      status: 'published',
      provenance: null,
      partId: 'numbers',
      chapterId: 'numbers-arithmetic',
      notionId: value.Notion_ID,
      type: 'calculation',
      difficulty: DIFFICULTY[value.Niveau],
      parameterization,
      prompt: [
        {
          kind: 'text',
          value: compileStructuredSource(
            value.Enonce_parametrique,
            variableIds,
          ),
        },
      ],
      hint: value.Methode_decisive
        ? [
            {
              kind: 'text',
              value: compileStructuredSource(
                value.Methode_decisive,
                variableIds,
              ),
            },
          ]
        : [],
      correction: [
        {
          id: `${value.Calcul_ID}-correction`,
          title: null,
          content: [
            {
              kind: 'text',
              value: compileStructuredSource(value.Correction, variableIds),
            },
          ],
        },
      ],
      tags: [
        'NUM',
        value.Notion_ID,
        value.Famille_structurelle_precise,
        value.Signature_structurelle,
        ...(publicationException ? ['finite-official-domain'] : []),
      ],
      validated: true,
      createdAt: GENERATED_AT,
      updatedAt: GENERATED_AT,
    },
    provenance: {
      mode: 'extend',
      references: [
        {
          sourceLabel: 'Base maître Quiz TSI — NUM validé',
          sourceReference: value.Calcul_ID,
          sourceLocator: sourceLocator(
            rowNumber,
            value.Calcul_ID,
            value.Notion_ID,
          ),
        },
      ],
    },
  };
});
for (const { question } of questions) {
  const visibleSource = [
    ...question.prompt,
    ...question.hint,
    ...question.correction.flatMap((step) => step.content),
  ]
    .map((segment) => segment.value ?? segment.math?.source ?? '')
    .join(' ');
  for (const { id } of question.parameterization.variables)
    if (!visibleSource.includes(`@${id}`))
      fail(`${question.id} : paramètre @${id} absent du contenu visible.`);
  if (visibleSource.includes('@a une écriture'))
    fail(`${question.id} : le verbe français « a » a été paramétré.`);
}
const bundle = {
  schemaVersion: 1,
  bundleId: 'quiz-tsi-official-num-v1',
  generatedAt: GENERATED_AT,
  defaultProvenance: [
    {
      sourceLabel: 'Base maître Quiz TSI — NUM validé',
      sourceReference: `SHA-256 ${sourceSha256}`,
      sourceLocator: 'Feuille NUM',
    },
  ],
  questions,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  await prettier.format(JSON.stringify(bundle), { parser: 'json' }),
);
await mkdir(dirname(auditOutputPath), { recursive: true });
await writeFile(
  auditOutputPath,
  await prettier.format(JSON.stringify(auditVectors), { parser: 'json' }),
);
console.log(
  JSON.stringify(
    {
      sourceSha256,
      rows: rows.length,
      notions: notions.size,
      counts,
      perNotion,
      signatures: signatures.size,
      recalculatedTests,
      publicationExceptions: Object.fromEntries(PUBLICATION_EXCEPTIONS),
      output: outputPath,
      auditOutput: auditOutputPath,
      bytes: Buffer.byteLength(JSON.stringify(bundle)),
    },
    null,
    2,
  ),
);
