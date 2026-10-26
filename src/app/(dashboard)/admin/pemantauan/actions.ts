'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/inngest/client';
import { PROCESS_STUDENT_EVENT, type ProcessStudentEventData } from '@/inngest/events';
import { getTodayIso, getWeekWindow, type WeekWindow } from '@/lib/week-window';
import type {
  AssessmentAuditRow,
  CronRunRow,
  LogDayStatus,
  LogMatrixClassGroup,
  LogMatrixStudentRow,
  MissingLogEntry,
} from '@/lib/types';

/** Nama tugas yang sama seperti cron mingguan supaya laporan kekal seragam. */
const JOB_NAME = 'weekly_pentaksiran';

/** Had murid bagi satu pencetus manual — melindungi enjin AI daripada limpahan. */
const MAX_STUDENTS_PER_RUN = 100;

export interface PemantauanStudentOption {
  id: string;
  full_name: string;
  class_name: string;
}

export interface PemantauanData {
  week: WeekWindow;
  /** Tarikh hari ini (waktu Malaysia) — asas status "belum tiba". */
  today: string;
  classGroups: LogMatrixClassGroup[];
  missing: MissingLogEntry[];
  audit: AssessmentAuditRow[];
  cronRuns: CronRunRow[];
  students: PemantauanStudentOption[];
  /** Nama pengguna bagi `actor_user_id` dalam jejak audit. */
  actorNames: Record<string, string>;
}

export type PemantauanLoadResult =
  | { ok: true; data: PemantauanData }
  | { ok: false; error: string };

export interface ManualAssessmentInput {
  studentIds: string[];
  /** Tarikh Isnin bagi minggu yang hendak diproses. */
  weekMonday: string;
}

export interface ManualAssessmentResult {
  ok: boolean;
  error?: string;
  /** Bilangan acara yang berjaya dihantar ke Inngest. */
  dispatched?: number;
}

/** Sahkan pengguna ialah pentadbir (admin_papn / super_admin). */
async function requireAdmin() {
  const profile = await getCurrentUser();
  if (!profile) {
    return { profile: null, error: 'Sesi tamat. Sila log masuk semula.' };
  }
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    return { profile: null, error: 'Anda tiada kebenaran untuk tindakan ini.' };
  }
  return { profile, error: null };
}

interface StudentRecord {
  id: string;
  full_name: string;
  nickname: string | null;
  class_id: string | null;
}

interface ClassRecord {
  id: string;
  class_name: string;
}

/** Normalisasi `log_date` (lajur DATE) kepada `YYYY-MM-DD`. */
function toDateKey(value: string): string {
  return value.slice(0, 10);
}

/**
 * Muat semua data dashboard pemantauan bagi satu minggu.
 *
 * Klien admin memintas RLS — setiap pertanyaan ditapis `tenant_id` secara
 * eksplisit dan `tenant_id` hanya diambil daripada sesi pengguna.
 */
export async function loadPemantauanData(weekMonday: string): Promise<PemantauanLoadResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const tenantId = profile.tenant_id;
  const week = getWeekWindow(weekMonday);
  const today = getTodayIso();

  const admin = createAdminClient();

  const [classesRes, studentsRes, logsRes, auditRes, cronRes, usersRes] = await Promise.all([
    admin.from('classes').select('id, class_name').eq('tenant_id', tenantId).order('class_name'),
    admin
      .from('students')
      .select('id, full_name, nickname, class_id')
      .eq('tenant_id', tenantId)
      .order('full_name'),
    admin
      .from('daily_logs')
      .select('student_id, log_date')
      .eq('tenant_id', tenantId)
      .gte('log_date', week.startDate)
      .lte('log_date', week.endDate),
    admin
      .from('assessment_audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(40),
    admin
      .from('cron_execution_logs')
      .select('id, tenant_id, job_name, status, processed_students, failed_students, error_message, executed_at')
      .eq('tenant_id', tenantId)
      .order('executed_at', { ascending: false })
      .limit(10),
    admin.from('users').select('id, full_name').eq('tenant_id', tenantId),
  ]);

  const queryError = classesRes.error ?? studentsRes.error ?? logsRes.error;
  if (queryError) {
    return { ok: false, error: `Gagal memuatkan data pemantauan: ${queryError.message}` };
  }

  const classes = (classesRes.data ?? []) as ClassRecord[];
  const students = (studentsRes.data ?? []) as StudentRecord[];
  const logs = (logsRes.data ?? []) as Array<{ student_id: string; log_date: string }>;

  // Set tarikh yang telah mempunyai sekurang-kurangnya satu log bagi setiap murid.
  const submittedByStudent = new Map<string, Set<string>>();
  logs.forEach((log) => {
    const set = submittedByStudent.get(log.student_id) ?? new Set<string>();
    set.add(toDateKey(log.log_date));
    submittedByStudent.set(log.student_id, set);
  });

  const rowByStudent = new Map<string, LogMatrixStudentRow>();
  const missing: MissingLogEntry[] = [];

  students.forEach((student) => {
    const submittedDates = submittedByStudent.get(student.id);
    const days: Record<string, LogDayStatus> = {};
    let submittedDays = 0;
    let elapsedDays = 0;
    const missingDates: string[] = [];

    week.days.forEach((date) => {
      const isElapsed = date <= today;
      if (isElapsed) elapsedDays += 1;

      if (submittedDates?.has(date)) {
        days[date] = 'submitted';
        submittedDays += 1;
        return;
      }

      days[date] = isElapsed ? 'missing' : 'upcoming';
      if (isElapsed) missingDates.push(date);
    });

    rowByStudent.set(student.id, {
      student_id: student.id,
      full_name: student.full_name,
      nickname: student.nickname,
      days,
      submitted_days: submittedDays,
    });

    if (missingDates.length > 0 && elapsedDays > 0) {
      const className =
        classes.find((c) => c.id === student.class_id)?.class_name ?? 'Tiada Kelas';
      missing.push({
        student_id: student.id,
        full_name: student.full_name,
        class_name: className,
        missing_dates: missingDates,
        submitted_days: submittedDays,
        total_days: week.days.length,
      });
    }
  });

  // Kumpulan kelas + kumpulan "Tiada Kelas" untuk murid tanpa kelas sah.
  const knownClassIds = new Set(classes.map((c) => c.id));
  const classGroups: LogMatrixClassGroup[] = classes.map((cls) => ({
    class_id: cls.id,
    class_name: cls.class_name,
    students: [],
  }));
  const groupByClassId = new Map<string, LogMatrixClassGroup>();
  classGroups.forEach((group) => {
    if (group.class_id) groupByClassId.set(group.class_id, group);
  });

  const unassigned: LogMatrixStudentRow[] = [];
  students.forEach((student) => {
    const row = rowByStudent.get(student.id);
    if (!row) return;
    const group = student.class_id ? groupByClassId.get(student.class_id) : undefined;
    if (group) {
      group.students.push(row);
    } else if (!student.class_id || !knownClassIds.has(student.class_id)) {
      unassigned.push(row);
    }
  });

  if (unassigned.length > 0) {
    classGroups.push({ class_id: null, class_name: 'Tiada Kelas', students: unassigned });
  }

  missing.sort(
    (a, b) =>
      a.submitted_days - b.submitted_days || a.full_name.localeCompare(b.full_name, 'ms')
  );

  const actorNames: Record<string, string> = {};
  ((usersRes.data ?? []) as Array<{ id: string; full_name: string }>).forEach((user) => {
    actorNames[user.id] = user.full_name;
  });

  return {
    ok: true,
    data: {
      week,
      today,
      classGroups,
      missing,
      audit: (auditRes.data ?? []) as AssessmentAuditRow[],
      cronRuns: (cronRes.data ?? []) as CronRunRow[],
      students: students.map((student) => ({
        id: student.id,
        full_name: student.full_name,
        class_name:
          classes.find((c) => c.id === student.class_id)?.class_name ?? 'Tiada Kelas',
      })),
      actorNames,
    },
  };
}

/**
 * Cetuskan saluran paip pentaksiran Inngest secara manual bagi murid terpilih.
 *
 * `cron_execution_logs` perlu dicipta dahulu kerana setiap acara murid membawa
 * `logId` untuk kemas kini kiraan melalui RPC `increment_cron_execution_log`.
 */
export async function runManualAssessment(
  input: ManualAssessmentInput
): Promise<ManualAssessmentResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const studentIds = Array.from(
    new Set(input.studentIds.filter((id) => typeof id === 'string' && id.trim().length > 0))
  );
  if (studentIds.length === 0) {
    return { ok: false, error: 'Sila pilih sekurang-kurangnya seorang murid.' };
  }
  if (studentIds.length > MAX_STUDENTS_PER_RUN) {
    return {
      ok: false,
      error: `Maksimum ${MAX_STUDENTS_PER_RUN} murid bagi satu pencetus manual.`,
    };
  }

  const tenantId = profile.tenant_id;
  const week = getWeekWindow(input.weekMonday);
  const admin = createAdminClient();

  // Sahkan setiap murid benar-benar milik penyewa ini sebelum menghantar acara.
  const { data: studentRows, error: studentsError } = await admin
    .from('students')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', studentIds);

  if (studentsError) {
    return { ok: false, error: `Gagal mengesahkan murid: ${studentsError.message}` };
  }

  const verifiedIds = new Set(
    ((studentRows ?? []) as Array<{ id: string }>).map((row) => row.id)
  );
  const validIds = studentIds.filter((id) => verifiedIds.has(id));
  if (validIds.length === 0) {
    return { ok: false, error: 'Murid yang dipilih tidak sah untuk pusat ini.' };
  }

  // Cuti umum / penutupan pusat bagi minggu ini — dihantar bersama acara supaya
  // enjin pentaksiran melangkau hari bukan persekolahan.
  const { data: holidayRows, error: holidayError } = await admin
    .from('academic_calendar')
    .select('date')
    .eq('tenant_id', tenantId)
    .eq('is_holiday', true)
    .gte('date', week.startDate)
    .lte('date', week.endDate);

  if (holidayError) {
    return { ok: false, error: `Gagal membaca takwim akademik: ${holidayError.message}` };
  }

  const holidayDates = ((holidayRows ?? []) as Array<{ date: string }>).map((row) =>
    toDateKey(row.date)
  );

  const { data: logRow, error: logError } = await admin
    .from('cron_execution_logs')
    .insert({ tenant_id: tenantId, job_name: JOB_NAME, status: 'PENDING' })
    .select('id')
    .single();

  if (logError || !logRow) {
    return {
      ok: false,
      error: `Gagal mencipta rekod pelaksanaan: ${logError?.message ?? 'tiada respons'}`,
    };
  }

  const logId = (logRow as { id: string }).id;

  const events = validIds.map((studentId) => ({
    name: PROCESS_STUDENT_EVENT,
    data: {
      logId,
      tenantId,
      studentId,
      year: week.year,
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      holidayDates,
    } satisfies ProcessStudentEventData,
  }));

  try {
    await inngest.send(events);
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : 'Ralat tidak diketahui.';
    await admin
      .from('cron_execution_logs')
      .update({
        status: 'FAILED',
        failed_students: validIds.length,
        error_message: `Gagal menghantar acara Inngest: ${message}`.slice(0, 1000),
      })
      .eq('id', logId)
      .eq('tenant_id', tenantId);

    return { ok: false, error: `Gagal menghantar acara ke enjin pentaksiran: ${message}` };
  }

  revalidatePath('/admin/pemantauan');
  return { ok: true, dispatched: validIds.length };
}
