import { useCallback, useEffect, useState } from 'react';
import type { Clock } from '@domain/repositories/RevisionStateRepositories';

export function ReflexTimer({
  activationKey,
  clock,
  deadline,
}: {
  activationKey: string;
  clock: Clock;
  deadline: number | null;
}) {
  const calculateRemaining = useCallback(
    () =>
      deadline === null
        ? 0
        : Math.max(0, Math.ceil((deadline - clock.now()) / 1000)),
    [clock, deadline],
  );
  const [remaining, setRemaining] = useState(calculateRemaining);
  useEffect(() => {
    const handle = clock.setInterval(
      () => setRemaining(calculateRemaining()),
      250,
    );
    return () => clock.clearInterval(handle);
  }, [activationKey, calculateRemaining, clock]);
  return (
    <p aria-live={remaining === 0 ? 'polite' : 'off'}>
      {remaining > 0
        ? `${remaining} s restantes`
        : 'Temps dépassé — tu peux continuer.'}
    </p>
  );
}
