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
  role: UserRole;
  created_at: string;
}

export interface ClassRow {
  id: string;
  tenant_id: string;
  class_name: string;
  year: number;
  created_at: string;
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
  created_by: string;
  created_at: string;
}
