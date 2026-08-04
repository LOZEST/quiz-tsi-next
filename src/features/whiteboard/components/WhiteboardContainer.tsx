import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import styles from './Whiteboard.module.css';
import { useRevisionExperience } from '@features/session/RevisionExperienceProvider';
import { QuestionCard } from '@features/questions/QuestionCard';
import { QuestionChangeDialog } from '@features/session/QuestionChangeDialog';

export function WhiteboardContainer() {
  const experience = useRevisionExperience();
  return (
    <section className={styles.container} aria-labelledby="whiteboard-title">
      {experience.state.kind === 'ready' ? (
        <QuestionCard
          prepared={experience.state.prepared}
          question={experience.state.question}
          onNext={() => experience.nextQuestion()}
        />
      ) : (
        <div className={styles.futureQuestion} role="status" aria-live="polite">
          <h1 id="whiteboard-title">Tableau blanc</h1>
          <p>
            {experience.state.kind === 'no-bank' ||
            experience.state.kind === 'no-program' ||
            experience.state.kind === 'no-match' ||
            experience.state.kind === 'error'
              ? experience.state.message
              : experience.state.kind === 'loading'
                ? 'Chargement…'
                : 'Ouvre le menu pour choisir un parcours.'}
          </p>
        </div>
      )}
      <WhiteboardCanvas />
      <WhiteboardToolbar />
      <QuestionChangeDialog />
    </section>
  );
}
