import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import styles from './Whiteboard.module.css';

export function WhiteboardContainer() {
  return (
    <section className={styles.container} aria-labelledby="whiteboard-title">
      <div className={styles.futureQuestion}>
        <h1 id="whiteboard-title">Tableau blanc</h1>
        <p>La prochaine question apparaîtra ici.</p>
      </div>
      <WhiteboardCanvas />
      <WhiteboardToolbar />
    </section>
  );
}
