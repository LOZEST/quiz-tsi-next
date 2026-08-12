import { createHash } from 'node:crypto';
import { parseParameterSpecification } from './parse-parameters.mjs';
import { supportedRelationOperators } from './parse-relations.mjs';

const EXPECTED_KEYS = Object.freeze([
  'Calcul_ID',
  'Type_base',
  'Origine_validation',
  'Chapitre',
  'Notion_ID',
  'Notion',
  'Niveau',
  'Categorie',
  'Famille',
  'Enonce_parametrique',
  'Parametres_JSON',
  'Contraintes_generation',
  'Valeurs_interdites',
  'Reponse_generale',
  'Correction',
  'Signature_structurelle',
  'Source_structure',
  'Source_document',
  'Page_source',
  'Test1_Parametres_JSON',
  'Test1_Expression_initiale',
  'Test1_Reponse_attendue',
  'Test2_Parametres_JSON',
  'Test2_Expression_initiale',
  'Test2_Reponse_attendue',
  'Statut_validation',
]);

function fail(message) {
  throw new Error(message);
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

function domainValues(domain) {
  if (domain.kind === 'choice') return [...new Set(domain.values)];
  const excluded = new Set(domain.excludedValues);
  const values = [];
  for (
    let value = domain.minimum;
    value <= domain.maximum;
    value += domain.step
  )
    if (!excluded.has(value)) values.push(value);
  return values;
}

function numericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') fail('Conversion numérique invalide.');
  const normalized = value.replaceAll(' ', '');
  const rational = /^(-?\d+)(?:\/(-?\d+))?$/.exec(normalized);
  if (rational) return Number(rational[1]) / Number(rational[2] ?? '1');
  const angle = /^(-?)(?:(\d+))?π(?:\/(-?\d+))?$/.exec(normalized);
  if (angle)
    return (
      (Number(angle[2] ?? '1') * (angle[1] === '-' ? -1 : 1) * Math.PI) /
      Number(angle[3] ?? '1')
    );
  fail(`Valeur mathématique non numérique : ${value}.`);
}

function gcd(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function evaluateAuditAst(node, values) {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'variable':
      if (!Object.hasOwn(values, node.variableId))
        fail(`Variable absente : ${node.variableId}.`);
      return values[node.variableId];
    case 'unary': {
      const value = evaluateAuditAst(node.operand, values);
      return node.operator === 'absolute' ? Math.abs(value) : -value;
    }
    case 'binary': {
      const left = evaluateAuditAst(node.left, values);
      const right = evaluateAuditAst(node.right, values);
      return {
        add: () => left + right,
        subtract: () => left - right,
        multiply: () => left * right,
        divide: () => left / right,
        modulo: () => left % right,
        power: () => left ** right,
      }[node.operator]();
    }
    case 'comparison': {
      const left = evaluateAuditAst(node.left, values);
      const right = evaluateAuditAst(node.right, values);
      return {
        equal: () => typeof left === typeof right && left === right,
        'not-equal': () => typeof left !== typeof right || left !== right,
        'less-than': () => left < right,
        'less-than-or-equal': () => left <= right,
        'greater-than': () => left > right,
        'greater-than-or-equal': () => left >= right,
      }[node.operator]();
    }
    case 'logical':
      return node.operator === 'and'
        ? node.operands.every(
            (entry) => evaluateAuditAst(entry, values) === true,
          )
        : node.operands.some(
            (entry) => evaluateAuditAst(entry, values) === true,
          );
    case 'logical-not':
      return !evaluateAuditAst(node.operand, values);
    case 'math-function': {
      const args = node.arguments.map((entry) =>
        evaluateAuditAst(entry, values),
      );
      switch (node.function) {
        case 'abs':
          return Math.abs(args[0]);
        case 'sqrt':
          return Math.sqrt(args[0]);
        case 'min':
          return Math.min(...args);
        case 'max':
          return Math.max(...args);
        case 'round':
          return Math.round(args[0]);
        case 'floor':
          return Math.floor(args[0]);
        case 'ceil':
          return Math.ceil(args[0]);
        case 'gcd':
          return gcd(args[0], args[1]);
        case 'lcm':
          return args[0] * args[1] === 0
            ? 0
            : Math.abs(args[0] * args[1]) / gcd(args[0], args[1]);
        case 'sign':
          return Math.sign(args[0]);
        case 'cos':
          return Math.cos(args[0]);
        case 'binomial': {
          const [n, k] = args;
          let result = 1;
          for (let index = 1; index <= Math.min(k, n - k); index += 1)
            result = (result * (n - Math.min(k, n - k) + index)) / index;
          return result;
        }
        case 'is-integer':
          return Number.isSafeInteger(args[0]);
        case 'numeric-value':
          return numericValue(args[0]);
        case 'is-square':
          return (
            Number.isSafeInteger(args[0]) &&
            Number.isInteger(Math.sqrt(args[0]))
          );
        case 'squarefree':
          for (
            let factor = 2;
            factor * factor <= Math.abs(args[0]);
            factor += 1
          )
            if (args[0] % (factor * factor) === 0) return false;
          return true;
        case 'has-prime-factor-other-than-2-or-5': {
          let value = Math.abs(args[0]);
          while (value % 2 === 0) value /= 2;
          while (value % 5 === 0) value /= 5;
          return value !== 1;
        }
        default:
          fail(`Fonction d’audit inconnue : ${node.function}.`);
      }
      break;
    }
    default:
      fail(`Nœud d’audit inconnu : ${node.kind}.`);
  }
}

function resolveDerived(parameterization, values) {
  const result = { ...values };
  for (const derived of parameterization.derivedVariables ?? [])
    result[derived.id] = evaluateAuditAst(derived.expression, result);
  return result;
}

function isValid(parameterization, values) {
  return parameterization.constraints.every(
    (constraint) => evaluateAuditAst(constraint, values) === true,
  );
}

export function validateSourceTest(row, testNumber, parameterization) {
  const prefix = `Test${testNumber}`;
  const rawParameters = row[`${prefix}_Parametres_JSON`];
  if (!rawParameters) {
    if (testNumber === 1) fail(`${row.Calcul_ID}: Test1 obligatoire absent.`);
    if (
      row[`${prefix}_Expression_initiale`] ||
      row[`${prefix}_Reponse_attendue`]
    )
      fail(`${row.Calcul_ID}: Test2 partiel.`);
    return null;
  }
  if (
    !row[`${prefix}_Expression_initiale`] ||
    !row[`${prefix}_Reponse_attendue`]
  )
    fail(`${row.Calcul_ID}: ${prefix} incomplet.`);
  let parameters;
  try {
    parameters = JSON.parse(rawParameters);
  } catch (error) {
    fail(
      `${row.Calcul_ID}: ${prefix}_Parametres_JSON invalide : ${error.message}`,
    );
  }
  if (parameterization === null) {
    if (Object.keys(parameters).length !== 0)
      fail(
        `${row.Calcul_ID}: ${prefix} fournit des paramètres à une question statique.`,
      );
    return { test: testNumber, parameters, resolvedParameters: parameters };
  }
  for (const variable of parameterization.variables) {
    if (!Object.hasOwn(parameters, variable.id))
      fail(`${row.Calcul_ID}: ${prefix} omet ${variable.id}.`);
    const values = domainValues(variable.domain);
    if (!values.some((entry) => Object.is(entry, parameters[variable.id])))
      fail(`${row.Calcul_ID}: ${prefix}.${variable.id} hors domaine.`);
  }
  const allowedIds = new Set([
    ...parameterization.variables.map((entry) => entry.id),
    ...(parameterization.derivedVariables ?? []).map((entry) => entry.id),
  ]);
  for (const id of Object.keys(parameters))
    if (!allowedIds.has(id))
      fail(`${row.Calcul_ID}: ${prefix} contient ${id} inconnu.`);
  const resolvedParameters = resolveDerived(parameterization, parameters);
  if (!isValid(parameterization, resolvedParameters))
    fail(`${row.Calcul_ID}: ${prefix} ne respecte pas les contraintes.`);
  return { test: testNumber, parameters, resolvedParameters };
}

export function analyzeVariantSpace(parameterization) {
  if (parameterization === null)
    return { totalCombinations: 1, validCombinations: 1, exhaustive: true };
  const domains = parameterization.variables.map((entry) =>
    domainValues(entry.domain),
  );
  const totalCombinations = domains.reduce(
    (total, values) => total * values.length,
    1,
  );
  if (totalCombinations > 100_000)
    return { totalCombinations, validCombinations: null, exhaustive: false };
  let validCombinations = 0;
  for (let ordinal = 0; ordinal < totalCombinations; ordinal += 1) {
    let cursor = ordinal;
    const values = {};
    for (let index = 0; index < domains.length; index += 1) {
      const domain = domains[index];
      values[parameterization.variables[index].id] =
        domain[cursor % domain.length];
      cursor = Math.floor(cursor / domain.length);
    }
    const resolved = resolveDerived(parameterization, values);
    if (isValid(parameterization, resolved)) validCombinations += 1;
  }
  return { totalCombinations, validCombinations, exhaustive: true };
}

function relationOperators(value, output) {
  if (Array.isArray(value)) {
    value.forEach((entry) => relationOperators(entry, output));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof value.op === 'string') output.add(value.op);
  for (const [key, entry] of Object.entries(value)) {
    if (
      [
        '!=',
        '=',
        '==',
        '<',
        '<=',
        '>',
        '>=',
        'and',
        '+',
        '-',
        '*',
        '/',
        'pow',
        'abs',
        'cos',
        'gcd',
        'binomial',
        'is_integer',
        'min',
        'max',
      ].includes(key)
    )
      output.add(key);
    relationOperators(entry, output);
  }
  if (value.mode === 'allowed_tuples') output.add('allowed_tuples');
  if (value.mode === 'all_combinations') output.add('all_combinations');
}

export function auditFullBank(rows, sourceBytes) {
  if (!Array.isArray(rows)) fail('La racine JSON doit être un tableau.');
  const ids = new Set();
  const signatures = new Set();
  const invalidRows = [];
  const unsupportedParameterSchemas = [];
  const sourceOperators = new Set();
  const countsByChapter = {};
  const countsByNotion = {};
  const countsByDifficulty = {};
  const countsByAutomationCategory = {};
  const principalNotions = new Map();
  const parsed = [];
  const sourceTests = [];
  const generatorsWithLessThan10Variants = [];
  let principal = 0;
  let automatisme = 0;
  for (const [index, row] of rows.entries()) {
    try {
      const keys = Object.keys(row).sort();
      if (JSON.stringify(keys) !== JSON.stringify([...EXPECTED_KEYS].sort()))
        fail(
          `${row.Calcul_ID ?? `ligne ${index + 1}`}: colonnes inconnues ou absentes.`,
        );
      if (!row.Calcul_ID || ids.has(row.Calcul_ID))
        fail(
          `${row.Calcul_ID || `ligne ${index + 1}`}: Calcul_ID vide ou dupliqué.`,
        );
      ids.add(row.Calcul_ID);
      if (
        !row.Signature_structurelle ||
        signatures.has(row.Signature_structurelle)
      )
        fail(`${row.Calcul_ID}: signature vide ou dupliquée.`);
      signatures.add(row.Signature_structurelle);
      if (row.Statut_validation !== 'VALIDE')
        fail(`${row.Calcul_ID}: Statut_validation différent de VALIDE.`);
      if (row.Type_base === 'PRINCIPAL') {
        principal += 1;
        if (!row.Chapitre || !row.Notion_ID || !row.Notion)
          fail(`${row.Calcul_ID}: classification principale incomplète.`);
        increment(countsByChapter, row.Chapitre);
        increment(countsByNotion, row.Notion_ID);
        const levels = principalNotions.get(row.Notion_ID) ?? {
          Fondamental: 0,
          Normal: 0,
          Piège: 0,
        };
        if (!Object.hasOwn(levels, row.Niveau))
          fail(`${row.Calcul_ID}: niveau principal inconnu.`);
        levels[row.Niveau] += 1;
        principalNotions.set(row.Notion_ID, levels);
      } else if (row.Type_base === 'AUTOMATISME') {
        automatisme += 1;
        if (!['AUTO-F', 'AUTO-N', 'AUTO-P'].includes(row.Niveau))
          fail(`${row.Calcul_ID}: niveau automatisme inconnu.`);
        increment(countsByAutomationCategory, row.Categorie);
      } else fail(`${row.Calcul_ID}: Type_base inconnu.`);
      increment(countsByDifficulty, row.Niveau);
      const converted = parseParameterSpecification(row);
      relationOperators(
        converted.sourceSpecification.relations,
        sourceOperators,
      );
      const test1 = validateSourceTest(row, 1, converted.parameterization);
      const test2 = validateSourceTest(row, 2, converted.parameterization);
      sourceTests.push({
        calculId: row.Calcul_ID,
        vectors: [test1, test2].filter(Boolean).map((entry) => ({
          test: entry.test,
          parameters: entry.parameters,
          resolvedParameters: entry.resolvedParameters,
          expressionInitiale: row[`Test${entry.test}_Expression_initiale`],
          reponseAttendue: row[`Test${entry.test}_Reponse_attendue`],
        })),
      });
      const variants = analyzeVariantSpace(converted.parameterization);
      if (
        variants.exhaustive &&
        variants.validCombinations !== null &&
        variants.validCombinations < 10
      )
        generatorsWithLessThan10Variants.push({
          calculId: row.Calcul_ID,
          ...variants,
        });
      parsed.push({ row, ...converted, variantSpace: variants });
    } catch (error) {
      invalidRows.push({
        index,
        calculId: row?.Calcul_ID ?? null,
        message: error.message,
      });
    }
  }
  const unsupportedRelations = [...sourceOperators]
    .filter((operator) => !supportedRelationOperators.includes(operator))
    .sort();
  const badNotions = [...principalNotions].filter(
    ([, levels]) =>
      levels.Fondamental !== 5 || levels.Normal !== 5 || levels.Piège !== 5,
  );
  if (
    rows.length !== 1765 ||
    principal !== 1230 ||
    automatisme !== 535 ||
    ids.size !== 1765 ||
    signatures.size !== 1765 ||
    principalNotions.size !== 82 ||
    badNotions.length > 0 ||
    invalidRows.length > 0 ||
    unsupportedRelations.length > 0
  )
    fail(
      `Audit bloquant échoué : ${JSON.stringify({
        total: rows.length,
        principal,
        automatisme,
        uniqueIds: ids.size,
        uniqueSignatures: signatures.size,
        principalNotions: principalNotions.size,
        badNotions,
        invalidRows,
        unsupportedRelations,
      })}`,
    );
  return {
    parsed,
    sourceTests,
    report: {
      sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
      total: rows.length,
      principal,
      automatisme,
      uniqueIds: ids.size,
      uniqueSignatures: signatures.size,
      principalNotions: principalNotions.size,
      invalidRows,
      unmappedRows: [],
      unsupportedParameterSchemas,
      sourceRelationOperators: [...sourceOperators].sort(),
      unsupportedRelations,
      unknownParameterReferences: [],
      mathFallbacks: [],
      countsByChapter,
      countsByNotion,
      countsByDifficulty,
      countsByAutomationCategory,
      generatorsWithLessThan10Variants,
    },
  };
}
