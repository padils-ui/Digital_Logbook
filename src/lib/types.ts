export type UserRole = 'super_admin' | 'admin_papn' | 'teacher' | 'parent';

export interface Tenant {
  id: string;
  name: string;
  code: string;
  address: string | null;
  custom_domain: string | null;
  app_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  tenant_id: string;
  full_name: string;
  phone_number: string | null;
  email: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

/** Baris pendidik untuk jadual Pengurusan Pendidik. */
export interface TeacherRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  /** Kelas yang dipertanggungjawabkan (id). */
  class_ids: string[];
}

/** Baris ibu bapa / penjaga untuk jadual Pengurusan Ibu Bapa. */
export interface ParentRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  /** Bilangan anak yang dipautkan. */
  linked_count: number;
  /** Benar jika penjaga utama bagi sekurang-kurangnya seorang anak. */
  is_primary: boolean;
}

/** Ringkasan anak untuk widget pautan ibu bapa. */
export interface StudentOption {
  id: string;
  full_name: string;
  nickname: string | null;
  mykid_number: string | null;
  class_id: string | null;
}

export interface ParentStudentMapRow {
  id: string;
  tenant_id: string;
  parent_id: string;
  student_id: string;
  relationship_type: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassTeacherRow {
  id: string;
  tenant_id: string;
  class_id: string;
  teacher_id: string;
  created_at: string;
}

export interface ClassRow {
  id: string;
  tenant_id: string;
  class_name: string;
  year: number;
  created_at: string;
}

/** Pilihan pendidik ringkas untuk pemilih tugasan kelas. */
export interface TeacherOption {
  id: string;
  full_name: string;
}

export interface Student {
  id: string;
  tenant_id: string;
  class_id: string | null;
  full_name: string;
  nickname: string | null;
  mykid_number: string | null;
  dob: string | null;
  gender: 'L' | 'P' | null;
  blood_type: string | null;
  photo_url: string | null;
  allergies: string[] | null;
  medical_conditions: string | null;
  special_notes: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  created_at: string;
}

export interface DailyLog {
  id: string;
  tenant_id: string;
  student_id: string;
  teacher_id: string;
  log_date: string;
  category: string;
  content: Record<string, unknown>;
  media_urls: string[] | null;
  created_at: string;
}

export interface IncidentReport {
  id: string;
  tenant_id: string;
  student_id: string;
  teacher_id: string;
  incident_time: string;
  description: string;
  action_taken: string | null;
  media_urls: string[] | null;
  acknowledged_by_parent: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  target_class_id: string | null;
  created_by: string | null;
  created_at: string;
  /** Benar jika pengumuman disematkan pada widget Papan Pemuka. */
  is_pinned: boolean;
}

/** Tindakan yang direkodkan oleh trigger `assessment_audit_logs`. */
export type AssessmentAction = 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'UNPUBLISHED';

/** Satu baris jejak audit laporan pentaksiran. */
export interface AssessmentAuditRow {
  id: string;
  tenant_id: string;
  report_id: string;
  student_id: string;
  week_number: number | null;
  year: number | null;
  action: AssessmentAction;
  from_status: string | null;
  to_status: string | null;
  changed_fields: string[];
  actor_user_id: string | null;
  /** `'system'` apabila perubahan dibuat oleh enjin AI / service_role. */
  actor_role: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Status log harian bagi satu murid pada satu tarikh. */
export type LogDayStatus = 'submitted' | 'missing' | 'upcoming';

/** Baris murid dalam matriks kepatuhan log mingguan. */
export interface LogMatrixStudentRow {
  student_id: string;
  full_name: string;
  nickname: string | null;
  /** Kunci = tarikh ISO `YYYY-MM-DD` Isnin–Jumaat. */
  days: Record<string, LogDayStatus>;
  /** Bilangan hari yang mempunyai sekurang-kurangnya satu log. */
  submitted_days: number;
}

/** Kumpulan murid mengikut kelas dalam matriks. */
export interface LogMatrixClassGroup {
  class_id: string | null;
  class_name: string;
  students: LogMatrixStudentRow[];
}

/** Murid yang belum melengkapkan log bagi minggu yang dipilih. */
export interface MissingLogEntry {
  student_id: string;
  full_name: string;
  class_name: string;
  /** Tarikh yang tiada log langsung. */
  missing_dates: string[];
  submitted_days: number;
  total_days: number;
}

/** Rekod pelaksanaan cron pentaksiran. */
export interface CronRunRow {
  id: string;
  tenant_id: string | null;
  job_name: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  processed_students: number;
  failed_students: number;
  error_message: string | null;
  executed_at: string;
}

/** Tetapan rasmi pusat PAPN bagi satu tenant. */
export interface CenterSettings {
  id: string;
  tenant_id: string;
  center_name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  academic_year: string | null;
  /** URL awam imej kepala surat dalam baldi `center-assets`. */
  letterhead_url: string | null;
  /** URL awam logo pusat / ikon aplikasi dalam baldi `center-assets`. */
  logo_url: string | null;
  updated_at: string;
}

/** Satu catatan takwim akademik (cuti umum / penutupan pusat). */
export interface AcademicCalendarRow {
  id: string;
  tenant_id: string;
  /** Tarikh ISO `YYYY-MM-DD`. */
  date: string;
  event_name: string;
  /** Benar jika hari ini bukan hari persekolahan. */
  is_holiday: boolean;
  created_at: string;
}

/** Prestasi kehadiran bagi satu kelas pada Papan Pemuka. */
export interface ClassAttendanceSummary {
  class_id: string;
  class_name: string;
  /** Jumlah anak berdaftar dalam kelas. */
  total_students: number;
  hadir: number;
  lewat: number;
  tidak_hadir: number;
  /** Peratus kehadiran (Hadir + Lewat) berbanding jumlah anak. */
  peratus: number;
  /** Bilangan log harian yang telah dihantar hari ini. */
  logs_today: number;
  /** Benar jika setiap anak dalam kelas mempunyai log hari ini. */
  log_lengkap: boolean;
}

/** Satu titik data trend kehadiran & log harian. */
export interface AttendanceTrendPoint {
  /** Tarikh ISO `YYYY-MM-DD`. */
  date: string;
  /** Label paksi ringkas, contoh `23 Okt`. */
  label: string;
  /** Peratus kehadiran (Hadir + Lewat) berbanding anak berdaftar. */
  peratus_kehadiran: number;
  /** Peratus log harian diterima berbanding anak berdaftar. */
  peratus_log: number;
}

/** Potongan carta donut (label + bilangan). */
export interface DistributionSlice {
  label: string;
  value: number;
}

/** Status kemaskini log harian bagi seorang pendidik. */
export interface TeacherLogStatusRow {
  teacher_id: string;
  teacher_name: string;
  /** Nama kelas yang dipertanggungjawabkan (dipisah koma). */
  class_names: string;
  /** Benar jika pendidik telah menghantar sekurang-kurangnya satu log hari ini. */
  lengkap: boolean;
}

