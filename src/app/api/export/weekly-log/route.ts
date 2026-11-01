/**
 * Muat turun Log Mingguan dalam bentuk PDF.
 *
 * GET /api/export/weekly-log?student_id=<uuid>&week_start=YYYY-MM-DD
 * GET /api/export/weekly-log?log_id=<uuid>   (tarikh minggu diambil daripada log)
 *
 * Kebenaran:
 *  - Ibu bapa  : anak mesti dipautkan dalam `parent_student_map` / `student_parents`.
 *  - Pendidik  : mesti mengajar kelas anak tersebut melalui `class_teachers`.
 *  - Pentadbir : mesti berada dalam penyewa (tenant) yang sama.
 *
 * Semua pertanyaan menggunakan klien pentadbir (service role) tetapi ditapis
 * secara eksplisit dengan `tenant_id` penyewa pengguna — pemisahan penyewa
 * tidak boleh bergantung pada RLS sahaja di laluan ini.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWeekWindow, normalizeWeekParam, mondayOf } from '@/lib/week-window';
import {
  generateWeeklyLogPdf,
  type WeeklyLogDayData,
  type WeeklyLogImage,
} from '@/lib/weekly-log-pdf';
import type { LogCategory } from '@/lib/log-categories';
import type { AppUser } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Peta enum Melayu dalam `daily_logs.category` kepada `LogCategory`. */
const DB_ENUM_TO_CATEGORY: Record<string, LogCategory> = {
  aktiviti_anak: 'child_activity',
  makanan: 'meals',
  tidur: 'sleep',
  kesihatan_ubat: 'health',
};

const AGGREGATE_CATEGORIES: LogCategory[] = [
  'child_activity',
  'meals',
  'sleep',
  'health',
];

interface StudentRecord {
  id: string;
  tenant_id: string;
  full_name: string;
  mykid_number: string | null;
  class_id: string | null;
}

interface LogRecord {
  id: string;
  category: string;
  content: Record<string, unknown> | null;
  log_date: string;
  created_at: string;
  parent_reviewed: boolean | null;
  parent_comment: string | null;
  parent_commented_at: string | null;
}

/** Gabungkan baris log sehari mengikut kategori (entri terbaharu mengatasi). */
function aggregateLogContent(
  rows: LogRecord[]
): Partial<Record<LogCategory, Record<string, unknown>>> {
  const aggregated: Partial<Record<LogCategory, Record<string, unknown>>> = {};
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const row of sorted) {
    const category =
      DB_ENUM_TO_CATEGORY[row.category] ??
      (AGGREGATE_CATEGORIES.includes(row.category as LogCategory)
        ? (row.category as LogCategory)
        : undefined);
    if (!category) continue;
    if (!row.content || typeof row.content !== 'object') continue;
    aggregated[category] = { ...(aggregated[category] ?? {}), ...row.content };
  }

  return aggregated;
}

/** Nama fail yang selamat untuk pengepala `Content-Disposition`. */
function safeFileName(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'Anak'
  );
}

/** Muat turun logo pusat daripada URL awam; gagal secara senyap. */
async function loadLogo(url: string | null | undefined): Promise<WeeklyLogImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const mimeType = contentType.startsWith('image/')
      ? contentType.split(';')[0]
      : url.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

    const buffer = new Uint8Array(await response.arrayBuffer());
    return { buffer, mimeType };
  } catch (error) {
    console.error('[weekly-log] Gagal memuat turun logo pusat:', error);
    return null;
  }
}

/** Semak pautan ibu bapa — kesatuan `parent_student_map` dan `student_parents`. */
async function parentCanAccess(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  parentId: string,
  studentId: string
): Promise<boolean> {
  const [mapRes, legacyRes] = await Promise.all([
    admin
      .from('parent_student_map')
      .select('student_id')
      .eq('tenant_id', tenantId)
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .limit(1),
    admin
      .from('student_parents')
      .select('student_id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .limit(1),
  ]);

  return (mapRes.data ?? []).length > 0 || (legacyRes.data ?? []).length > 0;
}

/** Semak tugasan pendidik terhadap kelas anak. */
async function teacherCanAccess(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  teacherId: string,
  classId: string | null
): Promise<boolean> {
  if (!classId) return false;

  const { data } = await admin
    .from('class_teachers')
    .select('class_id')
    .eq('tenant_id', tenantId)
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .limit(1);

  return (data ?? []).length > 0;
}

async function authorizeStudent(
  admin: ReturnType<typeof createAdminClient>,
  profile: AppUser,
  student: StudentRecord
): Promise<boolean> {
  if (student.tenant_id !== profile.tenant_id) return false;

  switch (profile.role) {
    case 'super_admin':
    case 'admin_papn':
      return true;
    case 'teacher':
      return teacherCanAccess(admin, profile.tenant_id, profile.id, student.class_id);
    case 'parent':
      return parentCanAccess(admin, profile.tenant_id, profile.id, student.id);
    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  /* ── 1. Pengesahan sesi & status akaun ─────────────────────────────── */
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json({ error: 'Sesi tamat. Sila log masuk semula.' }, { status: 401 });
  }
  if (profile.status !== 'approved') {
    return NextResponse.json(
      { error: 'Akaun anda belum diluluskan oleh pentadbir pusat.' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const params = request.nextUrl.searchParams;
  const studentIdParam = params.get('student_id');
  const logIdParam = params.get('log_id');

  if (!studentIdParam && !logIdParam) {
    return NextResponse.json(
      { error: 'Parameter student_id atau log_id diperlukan.' },
      { status: 400 }
    );
  }

  /* ── 2. Tentukan anak & minggu laporan ─────────────────────────────── */
  let studentId = studentIdParam ?? '';
  let weekStart = normalizeWeekParam(
    params.get('week_start') ?? params.get('week') ?? undefined
  );

  if (!studentId && logIdParam) {
    const { data: anchorLog } = await admin
      .from('daily_logs')
      .select('student_id, log_date')
      .eq('tenant_id', profile.tenant_id)
      .eq('id', logIdParam)
      .maybeSingle();

    if (!anchorLog) {
      return NextResponse.json({ error: 'Log harian tidak dijumpai.' }, { status: 404 });
    }

    studentId = (anchorLog as { student_id: string }).student_id;
    weekStart = mondayOf((anchorLog as { log_date: string }).log_date);
  }

  const { data: studentData } = await admin
    .from('students')
    .select('id, tenant_id, full_name, mykid_number, class_id')
    .eq('tenant_id', profile.tenant_id)
    .eq('id', studentId)
    .maybeSingle();

  const student = studentData as StudentRecord | null;
  if (!student) {
    return NextResponse.json({ error: 'Rekod anak tidak dijumpai.' }, { status: 404 });
  }

  const allowed = await authorizeStudent(admin, profile, student);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Anda tiada kebenaran untuk memuat turun laporan anak ini.' },
      { status: 403 }
    );
  }

  const window = getWeekWindow(weekStart);

  /* ── 3. Maklumat pusat & logo ──────────────────────────────────────── */
  const [settingsRes, tenantRes] = await Promise.all([
    admin
      .from('center_settings')
      .select('center_name, logo_url')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle(),
    admin.from('tenants').select('name').eq('id', profile.tenant_id).maybeSingle(),
  ]);

  const settings = settingsRes.data as
    | { center_name: string | null; logo_url: string | null }
    | null;
  const tenant = tenantRes.data as { name: string | null } | null;

  const centerName =
    settings?.center_name?.trim() || tenant?.name?.trim() || 'Pusat Anak PERMATA Negara';
  const logo = await loadLogo(settings?.logo_url ?? null);

  /* ── 4. Log harian sepanjang minggu ────────────────────────────────── */
  const { data: logData } = await admin
    .from('daily_logs')
    .select(
      'id, category, content, log_date, created_at, parent_reviewed, parent_comment, parent_commented_at'
    )
    .eq('tenant_id', profile.tenant_id)
    .eq('student_id', student.id)
    .gte('log_date', window.startDate)
    .lte('log_date', window.endDate)
    .order('created_at', { ascending: true });

  const logs = (logData ?? []) as LogRecord[];
  const logsByDate = new Map<string, LogRecord[]>();
  for (const row of logs) {
    const bucket = logsByDate.get(row.log_date);
    if (bucket) bucket.push(row);
    else logsByDate.set(row.log_date, [row]);
  }

  const days: WeeklyLogDayData[] = window.days.map((date) => {
    const rows = logsByDate.get(date) ?? [];
    const reviewedRow = rows.find((row) => row.parent_reviewed);
    const commentRow = [...rows]
      .filter((row) => row.parent_comment?.trim())
      .sort(
        (a, b) =>
          new Date(b.parent_commented_at ?? b.created_at).getTime() -
          new Date(a.parent_commented_at ?? a.created_at).getTime()
      )[0];

    return {
      date,
      contentByCategory: aggregateLogContent(rows),
      parentReviewed: Boolean(reviewedRow),
      parentComment: commentRow?.parent_comment ?? null,
      parentCommentedAt: commentRow?.parent_commented_at ?? null,
    };
  });

  /* ── 5. Jana PDF ───────────────────────────────────────────────────── */
  try {
    const pdf = await generateWeeklyLogPdf({
      center: { name: centerName, branch: centerName, logo },
      studentName: student.full_name,
      mykidNumber: student.mykid_number,
      weekStart: window.startDate,
      weekEnd: window.endDate,
      days,
      generatedAt: new Date().toISOString(),
    });

    const fileName = `Log_Mingguan_${safeFileName(student.full_name)}_${window.startDate}.pdf`;

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[weekly-log] Ralat semasa menjana PDF:', error);
    return NextResponse.json({ error: 'Gagal menjana dokumen PDF.' }, { status: 500 });
  }
}
