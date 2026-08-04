import { useEffect, useRef, useState } from 'react';
import type { Clock } from '@domain/repositories/RevisionStateRepositories';

export function ReflexTimer({
  clock,
}: {
  activationKey: string;
  clock: Clock;
}) {
  const deadline = useRef(clock.now() + 60_000);
  const [remaining, setRemaining] = useState(60);
  useEffect(() => {
    const handle = clock.setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((deadline.current - clock.now()) / 1000)),
        ),
      250,
    );
    return () => clock.clearInterval(handle);
  }, [clock]);
  return (
    <p aria-live={remaining === 0 ? 'polite' : 'off'}>
      {remaining > 0
        ? `${remaining} s restantes`
        : 'Temps dépassé — tu peux continuer.'}
    </p>
  );
}
