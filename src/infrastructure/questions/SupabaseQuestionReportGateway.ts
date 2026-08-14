import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isQuestionReportReason,
  isQuestionReportStatus,
  type QuestionReport,
  type QuestionReportStatus,
} from '@domain/questions/QuestionReport';
import type {
  QuestionReportGateway,
  QuestionReportSubmission,
} from '@domain/questions/QuestionReportGateway';

interface QuestionReportRow {
  id: string;
  question_id: string;
  question_version: number;
  reporter_id: string;
  reporter_email: string;
  reason: string;
  comment: string | null;
  status: string;
  created_at: string;
}

function mapQuestionReport(row: QuestionReportRow): QuestionReport {
  if (!isQuestionReportReason(row.reason)) {
    throw new Error('Le serveur a retourné un motif de signalement invalide.');
  }
  if (!isQuestionReportStatus(row.status)) {
    throw new Error('Le serveur a retourné un statut de signalement invalide.');
  }
  return {
    id: row.id,
    questionId: row.question_id,
    questionVersion: row.question_version,
    reporterId: row.reporter_id,
    reporterEmail: row.reporter_email,
    reason: row.reason,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class SupabaseQuestionReportGateway implements QuestionReportGateway {
  constructor(private readonly client: SupabaseClient) {}

  async submitReport(submission: QuestionReportSubmission): Promise<void> {
    const { error } = await this.client.rpc('create_question_report', {
      p_question_id: submission.questionId,
      p_question_version: submission.questionVersion,
      p_reason: submission.reason,
      p_comment: submission.comment,
    });
    if (error) throw new Error('Le signalement n’a pas pu être envoyé.');
  }

  async listReports(): Promise<readonly QuestionReport[]> {
    const response = await this.client.rpc('admin_list_question_reports');
    if (response.error)
      throw new Error('Les signalements n’ont pas pu être chargés.');
    const data = response.data as QuestionReportRow[] | null;
    return (data ?? []).map(mapQuestionReport);
  }

  async setReportStatus(
    reportId: string,
    status: QuestionReportStatus,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      'admin_set_question_report_status',
      { p_report_id: reportId, p_status: status },
    );
    if (error) throw new Error('Le statut du signalement n’a pas pu être modifié.');
  }
}
