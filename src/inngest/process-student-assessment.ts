import { generateStudentWeeklyAssessment } from '@/lib/ai/pentaksiran-engine';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from './client';
import { PROCESS_STUDENT_EVENT, type ProcessStudentEventData } from './events';

type LogStatus = 'SUCCESS' | 'FAILED';

interface CounterPatch {
  processed?: number;
  failed?: number;
  status?: LogStatus;
  errorMessage?: string;
}

/**
 * Kemas kini kiraan `cron_execution_logs` secara atomik melalui fungsi SQL.
 * Lihat `supabase/migrations/add_cron_log_counter_rpc.sql`.
 */
async function updateCronCounters(logId: string, patch: CounterPatch): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc('increment_cron_execution_log', {
    p_log_id: logId,
    p_processed: patch.processed ?? 0,
    p_failed: patch.failed ?? 0,
    p_status: patch.status ?? null,
    p_error: patch.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`Gagal mengemas kini cron_execution_logs: ${error.message}`);
  }
}

/** Ambil muatan asal daripada acara `inngest/function.failed`. */
function readFailurePayload(event: { data?: unknown }): Partial<ProcessStudentEventData> {
  const data = event?.data as
    | { event?: { data?: Partial<ProcessStudentEventData> } }
    | undefined;
  return data?.event?.data ?? {};
}

/**
 * Pekerja fan-out bagi setiap murid.
 *
 * Retry: 5 percubaan dengan backoff eksponen (dikendalikan oleh Inngest).
 * Kegagalan kekal (selepas semua retry) direkodkan melalui `onFailure`.
 */
export const processStudentAssessment = inngest.createFunction(
  {
    id: 'process-student-assessment',
    name: 'Pentaksiran Mingguan — Murid',
    retries: 5,
    triggers: { event: PROCESS_STUDENT_EVENT },
    onFailure: async ({ event, error, step }) => {
      const payload = readFailurePayload(event);
      if (!payload.logId) return;

      await step.run('mark-failed', async () => {
        await updateCronCounters(payload.logId as string, {
          failed: 1,
          status: 'FAILED',
          errorMessage: `Murid ${payload.studentId ?? 'tidak diketahui'}: ${error.message}`.slice(
            0,
            1000
          ),
        });
        return { failed: true };
      });
    },
  },
  async ({ event, step }) => {
    const payload = event.data as unknown as ProcessStudentEventData;

    const result = await step.run('generate-assessment', async () =>
      generateStudentWeeklyAssessment({
        tenantId: payload.tenantId,
        studentId: payload.studentId,
        year: payload.year,
        weekNumber: payload.weekNumber,
        startDate: payload.startDate,
        endDate: payload.endDate,
        holidayDates: payload.holidayDates ?? [],
      })
    );

    await step.run('mark-processed', async () => {
      await updateCronCounters(payload.logId, { processed: 1, status: 'SUCCESS' });
      return { processed: true };
    });

    return {
      studentId: payload.studentId,
      reportId: result.reportId,
      logCount: result.logCount,
    };
  }
);
