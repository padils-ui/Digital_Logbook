/**
 * Nama acara dan bentuk muatan yang dikongsi antara fungsi Inngest.
 */

/** Acara cron mingguan (boleh dicetuskan secara manual melalui API). */
export const WEEKLY_CRON_EVENT = 'app/pentaksiran.weekly-cron';

/** Acara fan-out bagi setiap murid. */
export const PROCESS_STUDENT_EVENT = 'app/pentaksiran.process-student';

/**
 * Muatan acara `app/pentaksiran.process-student`.
 *
 * `tenantId` WAJIB dibawa bersama setiap acara kerana pekerja latar belakang
 * menggunakan klien service role yang memintas RLS.
 */
export interface ProcessStudentEventData {
  /** ID baris `cron_execution_logs` bagi kitaran cron semasa. */
  logId: string;
  tenantId: string;
  studentId: string;
  year: number;
  weekNumber: number;
  /** Tarikh mula (YYYY-MM-DD), hari Isnin. */
  startDate: string;
  /** Tarikh akhir (YYYY-MM-DD), hari Jumaat. */
  endDate: string;
  /**
   * Tarikh cuti umum / penutupan pusat (YYYY-MM-DD) dalam tetingkap minggu.
   * Enjin pentaksiran melangkau tarikh ini seperti hari bukan persekolahan.
   */
  holidayDates: string[];
}
