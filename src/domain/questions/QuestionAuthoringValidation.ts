import { validateQuestion, type Question } from './Question';
import { validateParameterizedQuestion } from './QuestionParameterValidation';

export type AuthoringIssue = Readonly<{ path: string; message: string }>;

export type PreparedQuestionForReview = Readonly<{
  normalizedQuestion: Question;
  issues: readonly AuthoringIssue[];
  validationEvidence: Readonly<{ variantCount: number }>;
}>;

export function prepareQuestionForReview(
  question: Readonly<Question>,
): PreparedQuestionForReview {
  const structural = validateQuestion(question);
  if (!structural.ok)
    return {
      normalizedQuestion: question as Question,
      issues: structural.issues,
      validationEvidence: { variantCount: 0 },
    };
  if (
    !question.correction.some((step) =>
      step.content.some((segment) =>
        segment.kind === 'text'
          ? Boolean(segment.value.trim())
          : segment.kind === 'inline-math' || segment.kind === 'display-math',
      ),
    )
  )
    return {
      normalizedQuestion: structural.value,
      issues: [
        {
          path: 'question.correction',
          message: 'Une correction pédagogique est requise.',
        },
      ],
      validationEvidence: { variantCount: 0 },
    };
  const candidate: Question = question.parameterization
    ? {
        ...question,
        status: 'published',
        validated: true,
        parameterization: {
          ...question.parameterization,
          validationVariantCount: Math.max(
            10,
            question.parameterization.validationVariantCount,
          ),
        },
      }
    : { ...question, status: 'published', validated: true };
  const semantic = validateParameterizedQuestion(
    candidate,
    `${question.id}:review`,
  );
  const variantCount = semantic.kind === 'ready' ? semantic.variants.length : 0;
  const issues =
    semantic.kind === 'ready' &&
    (!question.parameterization || variantCount >= 10)
      ? []
      : semantic.errors.length
        ? semantic.errors
        : [
            {
              path: 'parameterization',
              message: 'Dix variantes valides sont requises.',
            },
          ];
  const normalizedQuestion = !issues.length
    ? {
        ...structural.value,
        status: 'published' as const,
        validated: true,
        ...(question.parameterization
          ? {
              parameterization: {
                ...structural.value.parameterization!,
                validationVariantCount: Math.max(10, variantCount),
              },
            }
          : {}),
      }
    : structural.value;
  return { normalizedQuestion, issues, validationEvidence: { variantCount } };
}

export const validateQuestionForReview = (question: Readonly<Question>) =>
  prepareQuestionForReview(question).issues;
