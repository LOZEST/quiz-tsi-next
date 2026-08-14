import type { QuestionReportGateway } from '@domain/questions/QuestionReportGateway';

export class UnavailableQuestionReportGateway implements QuestionReportGateway {
  private unavailable(): Error {
    return new Error('Le signalement des questions n’est pas configuré.');
  }
  submitReport(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  listReports(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
  setReportStatus(): Promise<never> {
    return Promise.reject(this.unavailable());
  }
}
