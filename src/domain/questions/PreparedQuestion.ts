import { deepFreezeOwned } from '../validation/SafeSnapshot';
import { generateParameterAssignment } from './ParameterizedQuestionGenerator';
import {
  instantiateQuestionVariant,
  type InstantiatedQuestion,
} from './QuestionInstantiation';
import type { ParameterPrimitive, Question } from './Question';

export interface PreparedQuestion {
  readonly questionId: string;
  readonly questionVersion: number;
  readonly seed: string;
  readonly parameterValues: Readonly<Record<string, ParameterPrimitive>>;
  readonly content: InstantiatedQuestion;
}
export type PreparedQuestionResult =
  | Readonly<{ kind: 'ready'; value: PreparedQuestion }>
  | Readonly<{
      kind: 'invalid-question' | 'impossible' | 'search-limit-exceeded';
      code: string;
      message: string;
    }>;

export function derivePreparedQuestionSeed(
  sessionSeed: string,
  question: Question,
  position: number,
): string {
  return `${sessionSeed}\u001f${question.id}\u001f${question.version}\u001f${position}`;
}

export function prepareQuestion(
  question: Question,
  sessionSeed: string,
  position: number,
): PreparedQuestionResult {
  if (sessionSeed.length === 0 || !Number.isInteger(position) || position < 0)
    return {
      kind: 'invalid-question',
      code: 'invalid-preparation',
      message: 'Configuration de préparation invalide.',
    };
  const seed = derivePreparedQuestionSeed(sessionSeed, question, position);
  const generated =
    question.parameterization === null
      ? { kind: 'ready' as const, variants: [Object.freeze({})] }
      : generateParameterAssignment(question.parameterization, seed);
  if (generated.kind !== 'ready')
    return {
      kind:
        generated.kind === 'search-limit-exceeded'
          ? 'search-limit-exceeded'
          : generated.kind === 'impossible'
            ? 'impossible'
            : 'invalid-question',
      code: `parameter-${generated.kind}`,
      message: 'Impossible de préparer une variante valide de cette question.',
    };
  const parameterValues = generated.variants[0];
  if (!parameterValues)
    return {
      kind: 'impossible',
      code: 'parameter-impossible',
      message: 'Impossible de préparer une variante valide de cette question.',
    };
  const content = instantiateQuestionVariant(question, parameterValues);
  if (!content.ok)
    return {
      kind: 'invalid-question',
      code: 'instantiation-failed',
      message: content.message,
    };
  return deepFreezeOwned({
    kind: 'ready',
    value: {
      questionId: question.id,
      questionVersion: question.version,
      seed,
      parameterValues,
      content: content.value,
    },
  });
}
