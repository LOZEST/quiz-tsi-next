import type { QuestionRemoteGateway } from '@domain/repositories/QuestionRemoteGateway';
export class UnavailableQuestionRemoteGateway implements QuestionRemoteGateway {
  push(): Promise<never> {
    return Promise.reject(new Error('Synchronisation indisponible.'));
  }
  pullRecent() {
    return Promise.resolve({
      questions: [],
      courses: [],
      chapters: [],
      notions: [],
      rejectedRows: [],
    });
  }
}
