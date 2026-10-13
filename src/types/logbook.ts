/**
 * Definisi jenis untuk modul Log Harian (`daily_logs`).
 *
 * Setiap baris `daily_logs` mewakili SATU kategori bagi seorang anak pada satu
 * tarikh. Di samping lajur JSONB `content` sedia ada, jadual turut menyokong
 * lajur kluster tambahan (Aktiviti dan Tingkah Laku / Kesihatan).
 */

/** Kluster jenis aktiviti yang direkodkan dalam log harian. */
export type AktivitiCluster = 'bebas' | 'luar' | 'permata';

/** Lajur bagi kluster Aktiviti (bebas / luar / PERMATA). */
export interface AktivitiClusterFields {
  aktiviti_bebas?: string | null;
  penglibatan_bebas?: string | null;
  foto_bebas?: string | null;
  aktiviti_luar?: string | null;
  penglibatan_luar?: string | null;
  foto_luar?: string | null;
  aktiviti_permata?: string | null;
  penglibatan_permata?: string | null;
  foto_permata?: string | null;
}

/** Lajur bagi kluster Tingkah Laku / Kesihatan. */
export interface TingkahLakuKesihatanFields {
  tingkah_laku?: string | null;
  kemalangan?: string | null;
  kecederaan?: string | null;
  kesihatan?: string | null;
}

/** Satu baris penuh daripada jadual `daily_logs`. */
export interface DailyLogRow extends AktivitiClusterFields, TingkahLakuKesihatanFields {
  id: string;
  tenant_id: string;
  student_id: string;
  teacher_id: string;
  log_date: string;
  category: string;
  content: Record<string, unknown> | null;
  media_urls: string[] | null;
  created_at: string;
  parent_reviewed?: boolean | null;
  parent_comment?: string | null;
  parent_commented_at?: string | null;
}

/** Input untuk menyisipkan baris baharu ke `daily_logs`. */
export interface DailyLogInput extends AktivitiClusterFields, TingkahLakuKesihatanFields {
  tenant_id: string;
  student_id: string;
  teacher_id: string;
  log_date: string;
  category: string;
  content?: Record<string, unknown> | null;
  media_urls?: string[] | null;
  parent_reviewed?: boolean;
  parent_comment?: string | null;
  parent_commented_at?: string | null;
}
