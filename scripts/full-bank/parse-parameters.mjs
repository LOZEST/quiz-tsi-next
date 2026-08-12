import { parseRelations, parseSourceExpression } from './parse-relations.mjs';

export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([
  '1.1',
  '2.1',
  '3.0',
  '4.0',
  '5.0',
  'AUTOMATISME',
]);

function fail(calculId, message) {
  throw new Error(`${calculId}: ${message}`);
}

function choiceDomain(definition, calculId, parameterId) {
  const values =
    definition.enum ?? definition.allowed ?? definition.allowed_values;
  if (!Array.isArray(values) || values.length === 0)
    fail(calculId, `domaine enum vide ou invalide pour ${parameterId}`);
  if (
    values.some(
      (entry) =>
        !(
          typeof entry === 'string' ||
          typeof entry === 'boolean' ||
          (typeof entry === 'number' && Number.isFinite(entry))
        ),
    )
  )
    fail(calculId, `valeur enum non primitive pour ${parameterId}`);
  return { kind: 'choice', values };
}

function integerDomain(definition, calculId, parameterId) {
  if (
    !Number.isSafeInteger(definition.min) ||
    !Number.isSafeInteger(definition.max) ||
    !Number.isSafeInteger(definition.step) ||
    definition.step <= 0 ||
    !Array.isArray(definition.exclude ?? []) ||
    !(definition.exclude ?? []).every(Number.isSafeInteger)
  )
    fail(calculId, `domaine entier invalide pour ${parameterId}`);
  const excludedValues = [...(definition.exclude ?? [])];
  const parity = definition.parity ?? 'any';
  if (!['any', 'even', 'odd'].includes(parity))
    fail(calculId, `parité inconnue « ${parity} » pour ${parameterId}`);
  if (parity !== 'any') {
    for (
      let value = definition.min;
      value <= definition.max;
      value += definition.step
    ) {
      const expected = parity === 'odd' ? 1 : 0;
      if (Math.abs(value % 2) !== expected) excludedValues.push(value);
    }
  }
  return {
    kind: 'integer',
    minimum: definition.min,
    maximum: definition.max,
    step: definition.step,
    excludedValues: [...new Set(excludedValues)].sort(
      (left, right) => left - right,
    ),
  };
}

function domain(definition, calculId, parameterId) {
  if (
    !definition ||
    typeof definition !== 'object' ||
    Array.isArray(definition)
  )
    fail(calculId, `définition invalide pour ${parameterId}`);
  if (
    Array.isArray(definition.enum) ||
    Array.isArray(definition.allowed) ||
    Array.isArray(definition.allowed_values)
  )
    return choiceDomain(definition, calculId, parameterId);
  if (definition.type === 'integer')
    return integerDomain(definition, calculId, parameterId);
  fail(
    calculId,
    `type de domaine non pris en charge « ${definition.type} » pour ${parameterId}`,
  );
}

function derivedDefinitions(specification, calculId) {
  const collections = [
    specification.derived_parameters,
    specification.derived_values,
    specification.derived_variables,
  ].filter(Boolean);
  const result = [];
  const constraints = [];
  for (const collection of collections) {
    for (const [id, definition] of Object.entries(collection)) {
      const expression = definition.expression ?? definition.formula;
      if (typeof expression !== 'string' || expression.length === 0)
        fail(calculId, `expression dérivée absente pour ${id}`);
      result.push({
        id,
        label: definition.display === true ? id : (definition.role ?? id),
        expression: parseSourceExpression(
          expression,
          `${calculId}.derived.${id}`,
        ),
      });
      if (definition.constraint)
        constraints.push(
          parseSourceExpression(
            definition.constraint,
            `${calculId}.derived.${id}.constraint`,
          ),
        );
    }
  }
  return { definitions: result, constraints };
}

export function parseParameterSpecification(row) {
  let specification;
  try {
    specification = JSON.parse(row.Parametres_JSON);
  } catch (error) {
    fail(row.Calcul_ID, `Parametres_JSON invalide : ${error.message}`);
  }
  const schemaVersion = specification.schema_version ?? 'AUTOMATISME';
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion))
    fail(row.Calcul_ID, `schema_version inconnu « ${schemaVersion} »`);
  if (schemaVersion === 'AUTOMATISME' && row.Type_base !== 'AUTOMATISME')
    fail(row.Calcul_ID, 'schéma sans version réservé aux automatismes');
  const definitions =
    schemaVersion === 'AUTOMATISME' ? specification : specification.parameters;
  if (
    !definitions ||
    typeof definitions !== 'object' ||
    Array.isArray(definitions)
  )
    fail(row.Calcul_ID, 'objet parameters absent');
  const variables = Object.entries(definitions).map(([id, definition]) => ({
    id,
    label: definition.role ?? id,
    domain: domain(definition, row.Calcul_ID, id),
  }));
  const derived = derivedDefinitions(specification, row.Calcul_ID);
  if (variables.length === 0 && derived.definitions.length === 0)
    return {
      sourceSchemaVersion: schemaVersion,
      sourceSpecification: specification,
      parameterization: null,
    };
  return {
    sourceSchemaVersion: schemaVersion,
    sourceSpecification: specification,
    parameterization: {
      schemaVersion: 1,
      variables,
      ...(derived.definitions.length > 0
        ? { derivedVariables: derived.definitions }
        : {}),
      constraints: [
        ...parseRelations(specification, row.Calcul_ID),
        ...derived.constraints,
      ],
      validationVariantCount: 10,
    },
  };
}

export function parameterIds(parameterization) {
  if (parameterization === null) return [];
  return [
    ...parameterization.variables.map((entry) => entry.id),
    ...(parameterization.derivedVariables ?? []).map((entry) => entry.id),
  ];
}
