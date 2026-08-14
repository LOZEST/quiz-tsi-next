import type {
  QuestionReport,
  QuestionReportReason,
  QuestionReportStatus,
} from './QuestionReport';

export interface QuestionReportSubmission {
  readonly questionId: string;
  readonly questionVersion: number;
  readonly reason: QuestionReportReason;
  readonly comment: string | null;
}

export interface QuestionReportGateway {
  submitReport(submission: QuestionReportSubmission): Promise<void>;
  listReports(): Promise<readonly QuestionReport[]>;
  setReportStatus(
    reportId: string,
    status: QuestionReportStatus,
  ): Promise<void>;
}
