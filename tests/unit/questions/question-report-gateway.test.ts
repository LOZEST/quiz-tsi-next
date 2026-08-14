import { SupabaseQuestionReportGateway } from '@infrastructure/questions/SupabaseQuestionReportGateway';
import type { SupabaseClient } from '@supabase/supabase-js';

function fakeClient(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient;
}

describe('SupabaseQuestionReportGateway', () => {
  it('submits a report through the create_question_report RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const gateway = new SupabaseQuestionReportGateway(fakeClient(rpc));
    await gateway.submitReport({
      questionId: 'q1',
      questionVersion: 2,
      reason: 'math_rendering',
      comment: 'Formule cassée',
    });
    expect(rpc).toHaveBeenCalledWith('create_question_report', {
      p_question_id: 'q1',
      p_question_version: 2,
      p_reason: 'math_rendering',
      p_comment: 'Formule cassée',
    });
  });

  it('rejects when the submission RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: new Error('denied') });
    const gateway = new SupabaseQuestionReportGateway(fakeClient(rpc));
    await expect(
      gateway.submitReport({
        questionId: 'q1',
        questionVersion: 1,
        reason: 'other',
        comment: null,
      }),
    ).rejects.toThrow();
  });

  it('maps listed reports and rejects rows with an invalid reason or status', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          id: 'r1',
          question_id: 'q1',
          question_version: 1,
          reporter_id: 'u1',
          reporter_email: 'user@example.test',
          reason: 'hint_unclear',
          comment: null,
          status: 'open',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const gateway = new SupabaseQuestionReportGateway(fakeClient(rpc));
    const reports = await gateway.listReports();
    expect(reports).toEqual([
      {
        id: 'r1',
        questionId: 'q1',
        questionVersion: 1,
        reporterId: 'u1',
        reporterEmail: 'user@example.test',
        reason: 'hint_unclear',
        comment: null,
        status: 'open',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const invalidRpc = vi.fn().mockResolvedValue({
      error: null,
      data: [{ id: 'r2', reason: 'not-a-reason', status: 'open' }],
    });
    const invalidGateway = new SupabaseQuestionReportGateway(
      fakeClient(invalidRpc),
    );
    await expect(invalidGateway.listReports()).rejects.toThrow();
  });

  it('sets a report status through the admin RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const gateway = new SupabaseQuestionReportGateway(fakeClient(rpc));
    await gateway.setReportStatus('r1', 'resolved');
    expect(rpc).toHaveBeenCalledWith('admin_set_question_report_status', {
      p_report_id: 'r1',
      p_status: 'resolved',
    });
  });
});
