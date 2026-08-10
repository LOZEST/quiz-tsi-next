import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
export class UnavailableQuestionRemoteGateway implements QuestionRemoteGateway {
  push(): Promise<never> {
    return Promise.reject(new Error('Synchronisation indisponible.'));
  }
  pullRecent(): Promise<readonly never[]> {
    return Promise.resolve([]);
  }
}
