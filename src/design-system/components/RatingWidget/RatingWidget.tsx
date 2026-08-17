import {
  quizzRatingScores,
  type QuizzRatingScore,
} from '@domain/quizz/QuizzRating';
import styles from './RatingWidget.module.css';

interface RatingWidgetProps {
  value: QuizzRatingScore | null;
  onChange?: (score: QuizzRatingScore) => void;
  disabled?: boolean;
  label?: string;
}

export function RatingWidget({
  value,
  onChange,
  disabled = false,
  label = 'Note',
}: RatingWidgetProps) {
  return (
    <div
      className={styles.widget}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
    >
      {quizzRatingScores.map((score) => (
        <button
          key={score}
          type="button"
          role="radio"
          aria-checked={value === score}
          className={styles.star}
          data-filled={value !== null && score <= value}
          disabled={disabled || !onChange}
          onClick={() => onChange?.(score)}
        >
          <span aria-hidden="true">★</span>
          <span className={styles.srOnly}>{score} / 5</span>
        </button>
      ))}
    </div>
  );
}
