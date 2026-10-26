import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { processStudentAssessment } from '@/inngest/process-student-assessment';
import { weeklyPentaksiranCron } from '@/inngest/weekly-pentaksiran-cron';

/**
 * Titik masuk Inngest untuk aplikasi Digital Logbook PAPN.
 *
 * Inngest mengesahkan setiap permintaan menggunakan `INNGEST_SIGNING_KEY`.
 * Dalam pembangunan setempat, jalankan `npx inngest-cli@latest dev` supaya
 * Inngest Dev Server menemui laluan ini secara automatik.
 */

/**
 * Had masa pelaksanaan laluan.
 *
 * Inngest melaksanakan langkah (`step.run`) melalui permintaan HTTP berpanjangan
 * ke laluan ini. Tanpanya, pemanggilan DeepSeek yang mengambil masa >30s boleh
 * diputuskan sebelum SDK sempat menyahut.
 */
export const maxDuration = 60;

/** Respons introspeksi mesti sentiasa dijana semula (membaca env semasa). */
export const dynamic = 'force-dynamic';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [weeklyPentaksiranCron, processStudentAssessment],
});
