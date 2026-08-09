import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { instantiateQuestionVariant } from '@domain/questions/QuestionInstantiation';
import { QuestionContentRenderer } from '@features/questions/QuestionContentRenderer';
import { productionQuestionRepository } from '@infrastructure/session/ProductionRevisionServices';

describe('rendu mathématique NUM de production', () => {
  it('rend NUM-F01-F02 comme un quotient de produits avec b négatif', () => {
    const question = productionQuestionRepository.getLatestById('NUM-F01-F02');
    const instantiated = instantiateQuestionVariant(question, { a: 12, b: -5 });
    expect(instantiated.ok).toBe(true);
    if (!instantiated.ok) return;

    const { container } = render(
      <QuestionContentRenderer segments={instantiated.value.prompt} />,
    );

    const renderedFormula = [...container.querySelectorAll('[role="math"]')]
      .map((element) => element.textContent)
      .join(' ');
    expect(renderedFormula).toContain('12×(−5)');
    expect(renderedFormula).toContain('(−5)');
    expect(renderedFormula).not.toContain('12−5');
  });
});
