import { z } from 'zod';

/**
 * Skema pengesahan runtime bagi output AI (DeepSeek) untuk
 * Laporan Pentaksiran PERMATA.
 *
 * AMARAN: Output model bahasa besar tidak boleh dipercayai. Setiap respons
 * mesti dihantar melalui `AssessmentSchema.parse()` sebelum disimpan ke
 * pangkalan data atau dipaparkan kepada pengguna.
 */

/** Enam domain PERMATA yang dinilai. */
export const PERMATA_DOMAINS = [
  'fizikal',
  'bahasa',
  'sahsiah',
  'awal_matematik',
  'deria',
  'kreativiti',
] as const;

export type PermataDomain = (typeof PERMATA_DOMAINS)[number];

/**
 * Skor bagi setiap domain PERMATA.
 * Nilai sah: 0–100, atau `null` jika domain tidak dapat dinilai.
 */
export const DomainScoresSchema = z.object({
  fizikal: z.number().min(0).max(100).nullable(),
  bahasa: z.number().min(0).max(100).nullable(),
  sahsiah: z.number().min(0).max(100).nullable(),
  awal_matematik: z.number().min(0).max(100).nullable(),
  deria: z.number().min(0).max(100).nullable(),
  kreativiti: z.number().min(0).max(100).nullable(),
});

/** Tahap keterukan bagi bendera merah (red flag). */
export const RedFlagSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

/** Satu pemerhatian berisiko beserta cadangan tindakan. */
export const RedFlagSchema = z.object({
  severity: RedFlagSeveritySchema,
  flag: z.string().min(1),
  recommendation: z.string().min(1),
});

/** Struktur penuh respons Pentaksiran yang sah. */
export const AssessmentSchema = z.object({
  domain_scores: DomainScoresSchema,
  summary: z.string(),
  suggestions_next_week: z.array(z.string()),
  red_flags: z.array(RedFlagSchema),
});

export type DomainScores = z.infer<typeof DomainScoresSchema>;
export type RedFlagSeverity = z.infer<typeof RedFlagSeveritySchema>;
export type RedFlag = z.infer<typeof RedFlagSchema>;
export type AssessmentData = z.infer<typeof AssessmentSchema>;
