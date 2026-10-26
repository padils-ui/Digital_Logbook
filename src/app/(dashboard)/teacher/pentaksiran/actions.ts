'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { syncAssessmentReportPdf } from '@/lib/pentaksiran/pdf-sync';
import {
  PERMATA_DOMAINS,
  RedFlagSchema,
  type PermataDomain,
  type RedFlag,
} from '@/lib/validations/assessment';

/** Input daripada borang semakan guru. */
export interface PublishAssessmentInput {
  reportId: string;
  summary: string;
  teacherNotes: string;
}

/** Hasil operasi terbit laporan pentaksiran. */
export interface PublishAssessmentResult {
  ok: boolean;
  error?: string;
  pdfUrl?: string;
  fileName?: string;
}

/** Normalkan skor domain daripada JSONB kepada bentuk yang selamat. */
function normalizeDomainScores(
  raw: unknown
): Partial<Record<PermataDomain, number | null>> {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const scores: Partial<Record<PermataDomain, number | null>> = {};

  for (const domain of PERMATA_DOMAINS) {
    const value = source[domain];
    scores[domain] =
      typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  return scores;
}

/** Sahkan senarai bendera merah yang tersimpan dalam JSONB. */
function normalizeRedFlags(raw: unknown): RedFlag[] {
  const parsed = RedFlagSchema.array().safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

/** Sahkan senarai cadangan minggu hadapan. */
function normalizeSuggestions(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Sahkan dan terbitkan laporan pentaksiran:
 * 1. Jana PDF laporan dan muat naik ke Google Drive.
 * 2. Simpan ringkasan/catatan guru, status PUBLISHED dan pautan PDF.
 *
 * Keselamatan: tenant_id diambil daripada profil pengguna yang disahkan —
 * BUKAN daripada input klien. Laporan disahkan milik tenant yang sama.
 *
 * Jika penjanaan/muat naik PDF gagal, status laporan KEKAL DRAF supaya guru
 * boleh mencuba semula tanpa menerbitkan laporan tanpa lampiran.
 */
export async function publishAssessmentReport(
  input: PublishAssessmentInput
): Promise<PublishAssessmentResult> {
  const profile = await getCurrentUser();
  if (!profile) {
    return { ok: false, error: 'Sesi tamat. Sila log masuk semula.' };
  }
  if (
    profile.role !== 'teacher' &&
    profile.role !== 'admin_papn' &&
    profile.role !== 'super_admin'
  ) {
    return {
      ok: false,
      error: 'Anda tiada kebenaran untuk menerbitkan laporan pentaksiran.',
    };
  }

  const reportId = (input.reportId ?? '').trim();
  if (!reportId) {
    return { ok: false, error: 'ID laporan tidak sah.' };
  }

  const admin = createAdminClient();

  try {
    const { data: report, error: reportError } = await admin
      .from('assessment_reports')
      .select('*')
      .eq('id', reportId)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'DRAFT')
      .maybeSingle();

    if (reportError) throw new Error(reportError.message);
    if (!report) {
      return {
        ok: false,
        error: 'Laporan draf tidak dijumpai atau telah diterbitkan.',
      };
    }

    const [studentRes, tenantRes] = await Promise.all([
      admin
        .from('students')
        .select('full_name, class_id')
        .eq('id', report.student_id)
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle(),
      admin
        .from('tenants')
        .select('name, address')
        .eq('id', profile.tenant_id)
        .maybeSingle(),
    ]);

    const student = studentRes.data as
      | { full_name: string; class_id: string | null }
      | null;

    if (!student) {
      return {
        ok: false,
        error: 'Rekod anak tidak dijumpai bagi pusat ini.',
      };
    }

    let className = 'Tanpa Kelas';
    if (student.class_id) {
      const { data: classRow } = await admin
        .from('classes')
        .select('class_name')
        .eq('id', student.class_id)
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();
      if (classRow?.class_name) className = classRow.class_name as string;
    }

    const tenant = tenantRes.data as
      | { name: string; address: string | null }
      | null;

    const summary = (input.summary ?? '').trim();
    const teacherNotes = (input.teacherNotes ?? '').trim();

    let pdfResult;
    try {
      pdfResult = await syncAssessmentReportPdf({
        tenant: {
          name: tenant?.name ?? 'Pusat Anak PERMATA Negara',
          address: tenant?.address ?? null,
        },
        studentName: student.full_name,
        className,
        weekNumber: Number(report.week_number),
        year: Number(report.year),
        startDate: String(report.start_date),
        endDate: String(report.end_date),
        domainScores: normalizeDomainScores(report.domain_scores),
        summary,
        teacherNotes,
        suggestionsNextWeek: normalizeSuggestions(report.suggestions_next_week),
        redFlags: normalizeRedFlags(report.red_flags),
        teacherName: profile.full_name,
      });
    } catch (pdfError) {
      console.error(
        '[publishAssessmentReport] Gagal menjana/memuat naik PDF:',
        pdfError
      );
      return {
        ok: false,
        error:
          'PDF gagal dijana atau dimuat naik ke Google Drive. Status laporan kekal DRAF — sila cuba lagi.',
      };
    }

    const { error: updateError } = await admin
      .from('assessment_reports')
      .update({
        summary,
        teacher_notes: teacherNotes,
        status: 'PUBLISHED',
        pdf_drive_file_id: pdfResult.fileId,
        pdf_drive_url: pdfResult.url,
      })
      .eq('id', report.id)
      .eq('tenant_id', profile.tenant_id);

    if (updateError) throw new Error(updateError.message);

    revalidatePath('/teacher/pentaksiran');

    return {
      ok: true,
      pdfUrl: pdfResult.url,
      fileName: pdfResult.fileName,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Ralat tidak diketahui.';
    console.error('[publishAssessmentReport] Ralat tidak dikendalikan:', err);
    return { ok: false, error: message };
  }
}
