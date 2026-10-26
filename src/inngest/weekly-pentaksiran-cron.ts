import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from './client';
import {
  PROCESS_STUDENT_EVENT,
  WEEKLY_CRON_EVENT,
  type ProcessStudentEventData,
} from './events';

const JOB_NAME = 'weekly_pentaksiran';
const DAY_MS = 24 * 60 * 60 * 1000;
/** MYT = UTC+8 (tiada waktu simpanan). */
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

interface WeeklyWindow {
  year: number;
  weekNumber: number;
  /** Isnin, format YYYY-MM-DD. */
  startDate: string;
  /** Jumaat, format YYYY-MM-DD. */
  endDate: string;
}

interface StudentKey {
  id: string;
  tenant_id: string;
}

interface HolidayKey {
  tenant_id: string;
  /** Lajur DATE daripada `academic_calendar`, format YYYY-MM-DD. */
  date: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Nombor minggu ISO-8601 (1–53). */
function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  // Khamis dalam minggu yang sama menentukan tahun/minggu ISO.
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

/**
 * Kira tetingkap Isnin–Jumaat bagi minggu semasa mengikut waktu Malaysia.
 *
 * Cron berjalan pada Jumaat 18:00 MYT (10:00 UTC), jadi tarikh UTC masih
 * berada pada hari yang sama dengan MYT.
 */
function getCurrentWeeklyWindow(now: Date = new Date()): WeeklyWindow {
  const myt = new Date(now.getTime() + MYT_OFFSET_MS);
  const dayOfWeek = myt.getUTCDay(); // 0 = Ahad, 1 = Isnin
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(
    Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate() - daysSinceMonday)
  );
  const friday = new Date(monday.getTime() + 4 * DAY_MS);

  return {
    year: monday.getUTCFullYear(),
    weekNumber: getIsoWeekNumber(monday),
    startDate: toIsoDate(monday),
    endDate: toIsoDate(friday),
  };
}

/**
 * Fungsi induk (master cron) Pentaksiran Mingguan.
 *
 * Dicetuskan oleh dua pemicu:
 * 1. Cron Jumaat 18:00 MYT (`0 10 * * 5` UTC).
 * 2. Acara `app/pentaksiran.weekly-cron` — laluan manual yang dilindungi
 *    `CRON_SECRET` (lihat `src/app/api/cron/weekly-pentaksiran/route.ts`).
 *
 * Pemicu cron tidak melalui HTTP aplikasi, jadi "security gate" dilaksanakan
 * di laluan manual tersebut. Inngest sendiri mengesahkan setiap permintaan
 * menggunakan `INNGEST_SIGNING_KEY`.
 */
export const weeklyPentaksiranCron = inngest.createFunction(
  {
    id: 'weekly-pentaksiran-cron',
    name: 'Pentaksiran Mingguan — Cron',
    retries: 3,
    triggers: [{ cron: '0 10 * * 5' }, { event: WEEKLY_CRON_EVENT }],
  },
  async ({ step }) => {
    const window = getCurrentWeeklyWindow();

    const logId = await step.run('create-cron-log', async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('cron_execution_logs')
        .insert({ job_name: JOB_NAME, status: 'PENDING' })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Gagal mencipta rekod cron_execution_logs: ${error.message}`);
      }

      return data.id as string;
    });

    const students = await step.run('fetch-students', async () => {
      const admin = createAdminClient();
      // Nota: jadual `students` tidak mempunyai lajur `is_active`; semua murid
      // dianggap aktif. Setiap baris membawa `tenant_id` sendiri kerana klien
      // service role memintas RLS.
      const { data, error } = await admin
        .from('students')
        .select('id, tenant_id')
        .order('tenant_id')
        .order('id');

      if (error) {
        throw new Error(`Gagal membaca senarai murid: ${error.message}`);
      }

      return (data ?? []) as StudentKey[];
    });

    if (students.length === 0) {
      await step.run('mark-empty-success', async () => {
        const admin = createAdminClient();
        const { error } = await admin
          .from('cron_execution_logs')
          .update({ status: 'SUCCESS' })
          .eq('id', logId);

        if (error) {
          throw new Error(`Gagal mengemas kini cron_execution_logs: ${error.message}`);
        }

        return { updated: true };
      });

      return { logId, dispatched: 0, tenants: 0, window };
    }

    // Cuti umum / penutupan pusat dalam minggu ini — enjin pentaksiran
    // melangkau tarikh ini seperti hari bukan persekolahan.
    const holidays = await step.run('fetch-holidays', async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('academic_calendar')
        .select('tenant_id, date')
        .eq('is_holiday', true)
        .gte('date', window.startDate)
        .lte('date', window.endDate);

      if (error) {
        throw new Error(`Gagal membaca academic_calendar: ${error.message}`);
      }

      return (data ?? []) as HolidayKey[];
    });

    const holidaysByTenant = new Map<string, string[]>();
    for (const holiday of holidays) {
      const date = holiday.date.slice(0, 10);
      const bucket = holidaysByTenant.get(holiday.tenant_id);
      if (bucket) {
        bucket.push(date);
      } else {
        holidaysByTenant.set(holiday.tenant_id, [date]);
      }
    }

    // Kelompokkan mengikut tenant untuk log/audit sebelum fan-out.
    const grouped = new Map<string, StudentKey[]>();
    for (const student of students) {
      const bucket = grouped.get(student.tenant_id);
      if (bucket) {
        bucket.push(student);
      } else {
        grouped.set(student.tenant_id, [student]);
      }
    }

    const events = students.map((student) => ({
      name: PROCESS_STUDENT_EVENT,
      data: {
        logId,
        tenantId: student.tenant_id,
        studentId: student.id,
        year: window.year,
        weekNumber: window.weekNumber,
        startDate: window.startDate,
        endDate: window.endDate,
        holidayDates: holidaysByTenant.get(student.tenant_id) ?? [],
      } satisfies ProcessStudentEventData,
    }));

    await step.sendEvent('fan-out-students', events);

    // Heartbeat Cronitor — kegagalan ping tidak boleh menggagalkan kitaran.
    await step.run('cronitor-heartbeat', async () => {
      const cronitorUrl = process.env.CRONITOR_URL;
      if (!cronitorUrl) {
        return { pinged: false, reason: 'CRONITOR_URL tidak ditetapkan' };
      }

      try {
        const response = await fetch(cronitorUrl, { method: 'GET', cache: 'no-store' });
        return { pinged: response.ok, status: response.status };
      } catch (error) {
        return {
          pinged: false,
          reason: error instanceof Error ? error.message : 'Ralat rangkaian',
        };
      }
    });

    return {
      logId,
      dispatched: events.length,
      tenants: grouped.size,
      window,
    };
  }
);
