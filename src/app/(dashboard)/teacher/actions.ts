'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  findOrCreateFolder,
  getDriveClient,
  getOrCreateStudentDriveFolder,
  LOG_HARIAN_ROOT_FOLDER_NAME,
  LOG_HARIAN_SUBFOLDER_NAME,
  upsertFileToDrive,
} from '@/lib/google-drive';
import { generateDailyLogPdf } from '@/lib/pdf-generator';
import type { LogCategory } from '@/lib/log-categories';
import type { DailyLogInput, DailyLogRow } from '@/types/logbook';

/** ID folder root lalai jika tenant tidak mempunyai konfigurasi Drive. */
const DEFAULT_DRIVE_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID ??
  '1i3_B66uiHL9lEt1UX10-Bo1liU4zmmPG';

/** Nama bulan dalam Bahasa Melayu untuk laluan folder Drive. */
const MONTH_NAMES_MS = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
];

export interface CategoryEntry {
  category: LogCategory;
  content: Record<string, unknown>;
  /** Imej bagi kategori tertentu (data URL base64). */
  imageDataUrl?: string | null;
}

export interface SaveLogInput {
  studentIds: string[];
  logDate: string;
  /** Senarai entri bagi setiap tab yang diisi. */
  entries: CategoryEntry[];
}

export interface SaveLogResult {
  ok: boolean;
  /** Bendera kejayaan eksplisit untuk pengendalian ralat di klien. */
  success: boolean;
  saved?: number;
  error?: string;
  /** Pautan terus ke folder Google Drive anak (jika berjaya dimuat naik). */
  driveFolderUrl?: string;
}

/** Tukar data URL base64 kepada buffer + jenis MIME. */
function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new Error('Format imej tidak sah.');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

/** Kategori log yang sah untuk pengagregatan PDF. */
const AGGREGATE_CATEGORIES: LogCategory[] = [
  'child_activity',
  'meals',
  'sleep',
  'health',
];

/**
 * Peta nilai LogCategory (TypeScript) → nilai enum PostgreSQL `log_category`.
 * DB menyimpan nama Melayu (contoh: 'aktiviti_anak') manakala TS menggunakan
 * nama Inggeris (contoh: 'child_activity').
 */
const CATEGORY_TO_DB_ENUM: Record<LogCategory, string> = {
  child_activity: 'aktiviti_anak',
  meals: 'makanan',
  sleep: 'tidur',
  health: 'kesihatan_ubat',
};

/**
 * Peta songsang: nilai enum DB → LogCategory TypeScript.
 * Digunakan semasa membaca baris dari `daily_logs` untuk agregasi.
 *
 * Nota: `kehadiran_suhu` sengaja tidak dipetakan — tab Kehadiran / Suhu telah
 * dibuang daripada modul logbook, jadi baris sejarah kategori tersebut akan
 * dilangkau (lihat amaran dalam aggregateLogContent).
 */
const DB_ENUM_TO_CATEGORY: Record<string, LogCategory> = {
  aktiviti_anak: 'child_activity',
  makanan: 'meals',
  tidur: 'sleep',
  kesihatan_ubat: 'health',
};

/**
 * Gabungkan baris log bagi tarikh yang sama menjadi satu objek agregat
 * merangkumi kesemua 5 kategori.
 *
 * Catatan: `category` dalam baris DB adalah nilai enum Melayu (cth: 'aktiviti_anak').
 * Fungsi ini menerjemah ke kunci LogCategory TypeScript menggunakan DB_ENUM_TO_CATEGORY.
 */
function aggregateLogContent(
  rows: DailyLogRow[]
): Partial<Record<LogCategory, Record<string, unknown>>> {
  const aggregated: Partial<Record<LogCategory, Record<string, unknown>>> = {};

  // Susun baris mengikut masa cipta supaya entri terbaharu mengatasi entri lama bagi kategori yang sama.
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const row of sorted) {
    // Terima kedua-dua format: enum Melayu ('aktiviti_anak') dan Inggeris ('child_activity')
    const category: LogCategory | undefined =
      DB_ENUM_TO_CATEGORY[row.category] ??
      (AGGREGATE_CATEGORIES.includes(row.category as LogCategory)
        ? (row.category as LogCategory)
        : undefined);

    if (!category) {
      console.warn(`[PDF Aggregation] Kategori tidak dikenali: ${row.category}`);
      continue;
    }
    
    if (!row.content || typeof row.content !== 'object') {
      console.warn(`[PDF Aggregation] Kandungan tidak sah untuk kategori ${category}`);
      continue;
    }
    
    // Gabungkan kandungan kategori ini
    aggregated[category] = { ...(aggregated[category] ?? {}), ...row.content };
  }

  return aggregated;
}

/**
 * Tugas latar belakang untuk menyelaraskan foto dan PDF ke Google Drive.
 * Dijalankan secara tidak menyekat (non-blocking) untuk respons UI yang pantas.
 */
async function syncToDriveBackground(params: {
  tenantId: string;
  tenantName: string;
  teacherName: string;
  logDate: string;
  entries: CategoryEntry[];
  students: Array<{ id: string; full_name: string; class_id: string | null }>;
  classNames: Record<string, string>;
  logHarianFolderId: string;
}) {
  const {
    tenantId,
    tenantName,
    teacherName,
    logDate,
    entries,
    students,
    classNames,
    logHarianFolderId,
  } = params;

  const admin = createAdminClient();
  const logDateObj = new Date(logDate);
  const year = logDateObj.getFullYear();
  const monthName = MONTH_NAMES_MS[logDateObj.getMonth()] ?? 'Januari';
  const cleanDate = logDate.slice(0, 10);

  // Proses setiap anak secara selari
  await Promise.all(
    students.map(async (student) => {
      try {
        const className = student.class_id
          ? classNames[student.class_id] ?? 'Tanpa Kelas'
          : 'Tanpa Kelas';

        // 1. Selesaikan folder anak
        const studentFolderId = await getOrCreateStudentDriveFolder({
          tenantId,
          logHarianFolderId,
          year,
          monthName,
          className,
          studentName: student.full_name,
        });

        // A. Proses imej baru dari entri-entri yang dihantar (TANPA muat naik ke Drive).
        // Buffer imej dikumpul mengikut kategori untuk disematkan terus ke dalam
        // kad kategori masing-masing dalam PDF agregat.
        const categoryPhotos: Partial<
          Record<LogCategory, { buffer: Buffer; mimeType: string }>
        > = {};

        for (const entry of entries) {
          if (entry.imageDataUrl) {
            const { mimeType, buffer } = parseDataUrl(entry.imageDataUrl);
            categoryPhotos[entry.category] = { buffer, mimeType };
          }
        }

        // B. Ambil SEMUA log bagi anak dan tarikh ini untuk menjana PDF lengkap.
        const { data: allLogsRes } = await admin
          .from('daily_logs')
          .select('id, category, content, media_urls, created_at, parent_reviewed, parent_comment')
          .eq('tenant_id', tenantId)
          .eq('student_id', student.id)
          .eq('log_date', cleanDate);
        
        const allLogs = (allLogsRes ?? []) as DailyLogRow[];

        // C. Agregasi Semua Kategori & Jana PDF
        const aggregatedLog = aggregateLogContent(allLogs);

        // Ekstrak pengesahan & ulasan ibu bapa daripada mana-mana baris log hari ini.
        const parentReviewed = allLogs.some((row) => row.parent_reviewed === true);
        const parentComment =
          allLogs.find((row) => row.parent_comment && row.parent_comment.trim())?.parent_comment ?? null;

        // C.1 Ambil rekod kehadiran anak bagi tarikh ini (jika ada) untuk
        // dipaparkan pada kotak ringkasan pengepala PDF.
        const { data: attendanceRes } = await admin
          .from('attendance')
          .select('status, suhu_tiba, suhu_balik')
          .eq('tenant_id', tenantId)
          .eq('student_id', student.id)
          .eq('date', cleanDate)
          .maybeSingle();

        const attendance = attendanceRes as
          | { status: string | null; suhu_tiba: string | null; suhu_balik: string | null }
          | null;

        const pdfBuffer = await generateDailyLogPdf({
          center: { name: tenantName },
          studentName: student.full_name,
          className,
          logDate: cleanDate,
          contentByCategory: aggregatedLog,
          teacherName,
          categoryPhotos,
          parentReviewed,
          parentComment,
          statusKehadiran: attendance?.status ?? null,
          suhuTiba: attendance?.suhu_tiba ?? null,
          suhuBalik: attendance?.suhu_balik ?? null,
        });

        const pdfFileName = `Log_Harian_${student.full_name}_${cleanDate}.pdf`;
        const pdfId = await upsertFileToDrive({
          folderId: studentFolderId,
          fileName: pdfFileName,
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        });
        const pdfUrl = `https://drive.google.com/uc?id=${pdfId}`;

        // D. Kemaskini media_urls dalam Supabase untuk SEMUA baris anak ini pada tarikh ini.
        // HANYA pautan PDF disimpan — tiada pautan berasingan untuk fail foto individu.
        const studentMediaUrls: string[] = [pdfUrl];
        const studentLogIds = allLogs.map((l) => l.id).filter(Boolean);
        if (studentLogIds.length > 0) {
          await admin
            .from('daily_logs')
            .update({ media_urls: studentMediaUrls })
            .eq('tenant_id', tenantId)
            .in('id', studentLogIds);
        }
      } catch (err) {
        console.error(`[DriveSync] Gagal untuk anak ${student.full_name}:`, err);
      }
    })
  );
}

/**
 * Simpan log harian untuk satu atau lebih anak (mod kelompok).
 *
 * Aliran:
 *  1. Sahkan sesi & anak milik tenant pendidik.
 *  2. Selesaikan folder Drive anak (getOrCreateStudentDriveFolder).
 *  3. Muat naik imej termampat + PDF log ke folder tersebut.
 *  4. Simpan rekod ke Supabase dengan pautan fail Drive.
 *
 * Keselamatan: tenant_id dan teacher_id diambil daripada profil pengguna
 * yang disahkan — BUKAN daripada input klien.
 */
export async function saveDailyLogs(
  input: SaveLogInput
): Promise<SaveLogResult> {
  try {
    const profile = await getCurrentUser();
    if (!profile) {
      return { ok: false, success: false, error: 'Sesi tamat. Sila log masuk semula.' };
    }

    if (!input.studentIds.length) {
      return {
        ok: false,
        success: false,
        error: 'Sila pilih sekurang-kurangnya seorang anak.',
      };
    }

    const admin = createAdminClient();

    // ── 1. Sahkan anak milik tenant ini ──────────────────────────
    const { data: validStudents, error: studentError } = await admin
      .from('students')
      .select('id, full_name, class_id')
      .eq('tenant_id', profile.tenant_id)
      .in('id', input.studentIds);

    if (studentError) {
      console.error('[saveDailyLogs] Ralat pengesahan anak:', studentError);
      return {
        ok: false,
        success: false,
        error: `Gagal mengesahkan anak: ${studentError.message}`,
      };
    }

    const students = validStudents ?? [];
    if (students.length === 0) {
      return {
        ok: false,
        success: false,
        error: 'Anak yang dipilih tidak dijumpai dalam pusat anda. Sila muat semula halaman.',
      };
    }

    // ── 2. Ambil konfigurasi Drive tenant ─────────────────────────
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('name, google_drive_folder_id, google_drive_subfolders')
      .eq('id', profile.tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.error(
        '[saveDailyLogs] Ralat mengambil metadata Drive tenant:',
        tenantError
      );
      return {
        ok: false,
        success: false,
        error: `Drive upload failed: ${tenantError.message}`,
      };
    }

    const subfolders = (tenant?.google_drive_subfolders ?? {}) as Record<
      string,
      string
    >;
    let rootFolderId = tenant?.google_drive_folder_id ?? null;
    let logHarianFolderId = subfolders.log_harian ?? null;

    // ── 2b. Pemulihan konfigurasi Drive yang hilang ───────────────
    // Jika tenant tiada konfigurasi Drive, gunakan folder root lalai dan
    // selesaikan/cipta laluan "01logharian -> 01 log harian" secara
    // dinamik, kemudian simpan semula ke pangkalan data supaya permintaan
    // akan datang tidak null.
    if (!rootFolderId || !logHarianFolderId) {
      console.warn(
        '[saveDailyLogs] Konfigurasi Drive tenant tidak lengkap — memulihkan...',
        { tenantId: profile.tenant_id, rootFolderId, logHarianFolderId }
      );

      try {
        const drive = getDriveClient();

        if (!rootFolderId) {
          rootFolderId = DEFAULT_DRIVE_ROOT_FOLDER_ID;
        }

        if (!logHarianFolderId) {
          const logHarianRootFolderId = await findOrCreateFolder(
            drive,
            LOG_HARIAN_ROOT_FOLDER_NAME,
            rootFolderId
          );
          logHarianFolderId = await findOrCreateFolder(
            drive,
            LOG_HARIAN_SUBFOLDER_NAME,
            logHarianRootFolderId
          );
        }

        const resolvedSubfolders = {
          ...subfolders,
          log_harian: logHarianFolderId,
        };

        const { error: updateError } = await admin
          .from('tenants')
          .update({
            google_drive_folder_id: rootFolderId,
            google_drive_subfolders: resolvedSubfolders,
          })
          .eq('id', profile.tenant_id);

        if (updateError) {
          console.error(
            '[saveDailyLogs] Gagal mengemas kini konfigurasi Drive tenant:',
            updateError
          );
        }
      } catch (driveError) {
        const message =
          driveError instanceof Error
            ? driveError.message
            : 'Ralat tidak diketahui.';
        console.error(
          '[saveDailyLogs] Ralat memulihkan konfigurasi Drive:',
          driveError
        );
        return {
          ok: false,
          success: false,
          error: `Drive upload failed: ${message}`,
        };
      }
    }

    if (!logHarianFolderId) {
      console.error(
        '[saveDailyLogs] Folder "01 log harian" masih tidak dapat diselesaikan.',
        { tenantId: profile.tenant_id, subfolders }
      );
      return {
        ok: false,
        success: false,
        error:
          'Drive upload failed: folder "01 log harian" tidak dapat diselesaikan.',
      };
    }

    // ── 3. Ambil Nama Kelas untuk Pemetaan Folder ─────────────────
    const classIds = students
      .map((s) => s.class_id)
      .filter((id): id is string => Boolean(id));
    const classNames: Record<string, string> = {};
    if (classIds.length) {
      const { data: classes } = await admin
        .from('classes')
        .select('id, class_name')
        .eq('tenant_id', profile.tenant_id)
        .in('id', classIds);
      (classes ?? []).forEach((c) => {
        classNames[c.id] = c.class_name;
      });
    }

    // ── 4. Simpan Rekod ke Supabase (Segera) ───────────────────────
    // Kami simpan tanpa media_urls dahulu untuk respons UI yang pantas.
    // media_urls akan dikemas kini oleh tugas latar belakang.
    // PENTING: `category` mesti diterjemah ke nilai enum PostgreSQL yang betul.
    const dbRows: DailyLogInput[] = [];
    for (const student of students) {
      for (const entry of input.entries) {
        dbRows.push({
          tenant_id: profile.tenant_id,
          student_id: student.id,
          teacher_id: profile.id,
          log_date: input.logDate.slice(0, 10),
          category: CATEGORY_TO_DB_ENUM[entry.category],
          content: entry.content,
          media_urls: [], // Kosong buat sementara
        });
      }
    }

    const { error: insertError } = await admin
      .from('daily_logs')
      .insert(dbRows);

    if (insertError) {
      console.error('[saveDailyLogs] Ralat sisipan:', insertError);
      return {
        ok: false,
        success: false,
        error: `Gagal menyimpan log: ${insertError.message}`,
      };
    }

    // ── 5. Pencetus Tugas Latar Belakang (Non-blocking) ────────────
    // Kami memulakan penyelarasan Drive tanpa menunggu (no await).
    syncToDriveBackground({
      tenantId: profile.tenant_id,
      tenantName: tenant?.name ?? 'Pusat Anak PERMATA Negara',
      teacherName: profile.full_name ?? 'Pendidik Bertugas',
      logDate: input.logDate,
      entries: input.entries,
      students: students.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        class_id: s.class_id,
      })),
      classNames,
      logHarianFolderId: logHarianFolderId!,
    }).catch((err) => {
      console.error('[saveDailyLogs] Ralat dalam tugas latar belakang:', err);
    });

    revalidatePath('/teacher');

    return {
      ok: true,
      success: true,
      saved: dbRows.length,
      // Pautan folder tidak tersedia serta-merta, klien boleh memaparkan
      // mesej bahawa fail sedang diselaraskan di latar belakang jika perlu.
    };
  } catch (err) {
    // Tangkap SEMUA ralat (kredensial hilang, ralat Drive API, ralat Supabase)
    // supaya server action tidak melontar pengecualian yang tidak dikendalikan.
    const message =
      err instanceof Error ? err.message : 'Ralat tidak diketahui.';
    console.error('[saveDailyLogs] Ralat tidak dikendalikan:', err);
    return { ok: false, success: false, error: message };
  }
}
