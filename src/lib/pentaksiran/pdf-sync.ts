import {
  driveFileUrl,
  findOrCreateFolder,
  getDriveClient,
  getOrCreateAssessmentReportFolder,
  tenantRootFolderName,
  upsertFileToDrive,
} from '@/lib/google-drive';
import {
  generateAssessmentReportPdf,
  type PapnCenterInfo,
} from '@/lib/pdf-generator';
import type { PermataDomain, RedFlag } from '@/lib/validations/assessment';

/**
 * Penyegerakan PDF laporan pentaksiran ke Google Drive.
 *
 * Laluan sasaran:
 *   [Nama Pusat] / Laporan_Pentaksiran / [Tahun] / [Kelas] / [Nama Anak] - Minggu [N].pdf
 *
 * Nombor minggu dimasukkan dalam nama fail supaya laporan minggu berbeza
 * tidak saling menimpa, sementara penerbitan semula minggu yang sama
 * mengemas kini fail sedia ada (idempotent).
 *
 * AMARAN: Modul ini hanya untuk kod pelayan (server-only).
 */

export interface AssessmentPdfSyncInput {
  /** Maklumat pusat PAPN untuk pengepala PDF. */
  tenant: PapnCenterInfo;
  studentName: string;
  className: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  domainScores: Partial<Record<PermataDomain, number | null>>;
  summary: string;
  teacherNotes?: string | null;
  suggestionsNextWeek: string[];
  redFlags: RedFlag[];
  teacherName: string;
}

export interface AssessmentPdfSyncResult {
  fileId: string;
  url: string;
  fileName: string;
}

/** Bina nama fail PDF yang selamat untuk Google Drive. */
export function buildAssessmentPdfFileName(
  studentName: string,
  weekNumber: number
): string {
  const safeName =
    studentName
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'Anak';
  return `${safeName} - Minggu ${weekNumber}.pdf`;
}

/**
 * Jana PDF laporan pentaksiran dan muat naik ke Drive.
 * Pulangkan ID fail, pautan paparan dan nama fail yang digunakan.
 */
export async function syncAssessmentReportPdf(
  input: AssessmentPdfSyncInput
): Promise<AssessmentPdfSyncResult> {
  const fileName = buildAssessmentPdfFileName(
    input.studentName,
    input.weekNumber
  );

  const buffer = await generateAssessmentReportPdf({
    center: input.tenant,
    studentName: input.studentName,
    className: input.className,
    weekNumber: input.weekNumber,
    year: input.year,
    startDate: input.startDate,
    endDate: input.endDate,
    domainScores: input.domainScores,
    summary: input.summary,
    teacherNotes: input.teacherNotes,
    suggestionsNextWeek: input.suggestionsNextWeek,
    redFlags: input.redFlags,
    teacherName: input.teacherName,
  });

  const drive = getDriveClient();
  const rootFolderId = await findOrCreateFolder(
    drive,
    tenantRootFolderName(input.tenant.name)
  );
  const classFolderId = await getOrCreateAssessmentReportFolder({
    rootFolderId,
    year: input.year,
    className: input.className,
  });

  const fileId = await upsertFileToDrive({
    folderId: classFolderId,
    fileName,
    mimeType: 'application/pdf',
    buffer,
  });

  return { fileId, url: driveFileUrl(fileId), fileName };
}
