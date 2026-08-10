import { validateQuestion, type Question } from './Question';
import { validateParameterizedQuestion } from './QuestionParameterValidation';

export type AuthoringIssue = Readonly<{ path: string; message: string }>;

export function validateQuestionForReview(
  question: Readonly<Question>,
): readonly AuthoringIssue[] {
  const structural = validateQuestion(question);
  if (!structural.ok) return structural.issues;
  if (
    !question.correction.some((step) =>
      step.content.some((segment) =>
        segment.kind === 'text'
          ? Boolean(segment.value.trim())
          : segment.kind === 'inline-math' || segment.kind === 'display-math',
      ),
    )
  )
    return [
      {
        path: 'question.correction',
        message: 'Une correction pédagogique est requise.',
      },
    ];
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
    : question;
  const semantic = validateParameterizedQuestion(
    candidate,
    `${question.id}:review`,
  );
  return semantic.kind === 'ready' &&
    (!question.parameterization || semantic.variants.length >= 10)
    ? []
    : semantic.errors.length
      ? semantic.errors
      : [
          {
            path: 'parameterization',
            message: 'Dix variantes valides sont requises.',
          },
        ];
}
