import type {
  DailyPlanStateRepository,
  WeakPointsStateRepository,
} from '@domain/repositories/RevisionStateRepositories';

export class UnavailableDailyPlanStateRepository implements DailyPlanStateRepository {
  getState() {
    return Promise.resolve({
      kind: 'unavailable' as const,
      message: 'La révision du jour est indisponible pour le moment.',
    });
  }
}

export class UnavailableWeakPointsStateRepository implements WeakPointsStateRepository {
  getState() {
    return Promise.resolve({
      kind: 'unavailable' as const,
      message: 'Les points faibles sont indisponibles pour le moment.',
    });
  }
}
