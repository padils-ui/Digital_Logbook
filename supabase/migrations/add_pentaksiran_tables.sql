-- ============================================================
-- Migrasi: Laporan Pentaksiran Mingguan (Step 1 - Skema + RLS)
-- ============================================================
-- Jalankan dalam Supabase SQL Editor, atau gunakan Supabase MCP.
-- Selamat dijalankan berulang kali (idempotent).

-- ── 1. Helper: tenant_id pengguna yang sedang log masuk ─────
-- SECURITY DEFINER diperlukan supaya policy boleh membaca public.users
-- tanpa terperangkap RLS jadual itu sendiri.
-- search_path dikunci pada '' bagi menghalang serangan search_path
-- hijacking (fungsi SECURITY DEFINER tanpa search_path selamat adalah
-- satu kelemahan keselamatan yang serius).
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.tenant_id
  FROM public.users u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_tenant_id() FROM PUBLIC;
-- Supabase memberi GRANT lalai kepada anon/authenticated/service_role pada
-- setiap fungsi baharu dalam skema public; anon mesti ditarik balik secara
-- eksplisit supaya fungsi ini tidak terdedah melalui /rest/v1/rpc.
REVOKE ALL ON FUNCTION public.get_auth_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO authenticated, service_role;

-- ── 2. Jadual laporan pentaksiran ───────────────────────────
CREATE TABLE IF NOT EXISTS public.assessment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  year INT NOT NULL CHECK (year >= 2024),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  domain_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  suggestions_next_week JSONB NOT NULL DEFAULT '[]'::jsonb,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  pdf_drive_file_id TEXT,
  pdf_drive_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_weekly_report UNIQUE (tenant_id, student_id, week_number, year),
  CONSTRAINT assessment_reports_date_order CHECK (end_date >= start_date)
);

-- ── 3. Jadual log pelaksanaan cron ──────────────────────────
CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_name TEXT NOT NULL DEFAULT 'weekly_pentaksiran',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  processed_students INT NOT NULL DEFAULT 0,
  failed_students INT NOT NULL DEFAULT 0,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Indeks ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assessment_reports_tenant_student
  ON public.assessment_reports(tenant_id, student_id, year, week_number);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_status
  ON public.assessment_reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cron_logs_tenant
  ON public.cron_execution_logs(tenant_id, executed_at DESC);

-- ── 5. Integriti silang penyewa: student mesti milik tenant sama ──
-- FK (student_id) sahaja hanya menjamin student wujud, bukan bahawa ia
-- milik tenant yang sama. Indeks unik komposit + FK komposit menutup
-- jurang kebocoran data antara penyewa ini pada peringkat pangkalan data.
CREATE UNIQUE INDEX IF NOT EXISTS ux_students_id_tenant
  ON public.students(id, tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assessment_reports_student_tenant_fkey'
      AND conrelid = 'public.assessment_reports'::regclass
  ) THEN
    ALTER TABLE public.assessment_reports
      ADD CONSTRAINT assessment_reports_student_tenant_fkey
      FOREIGN KEY (student_id, tenant_id)
      REFERENCES public.students(id, tenant_id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- ── 6. RLS ──────────────────────────────────────────────────
ALTER TABLE public.assessment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;

-- Baca: semua ahli tenant (guru, admin, ibu bapa) bagi tenant sendiri.
DROP POLICY IF EXISTS "Tenant Users can view assessment reports" ON public.assessment_reports;
CREATE POLICY "Tenant Users can view assessment reports" ON public.assessment_reports
  FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

-- Tulis: hanya guru dan admin dalam tenant sendiri.
-- (Ibu bapa tidak boleh mencipta/mengubah laporan pentaksiran.)
DROP POLICY IF EXISTS "Teachers and admins can create assessment reports" ON public.assessment_reports;
CREATE POLICY "Teachers and admins can create assessment reports" ON public.assessment_reports
  FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('teacher', 'admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can update assessment reports" ON public.assessment_reports;
CREATE POLICY "Teachers and admins can update assessment reports" ON public.assessment_reports
  FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('teacher', 'admin_papn', 'super_admin')
    )
  )
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can delete assessment reports" ON public.assessment_reports;
CREATE POLICY "Admins can delete assessment reports" ON public.assessment_reports
  FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

-- Log cron: baca sahaja. Penulisan dilakukan oleh service_role (cron)
-- yang memintas RLS. Tiada policy INSERT/UPDATE/DELETE untuk pengguna biasa.
DROP POLICY IF EXISTS "Tenant Users can view cron logs" ON public.cron_execution_logs;
CREATE POLICY "Tenant Users can view cron logs" ON public.cron_execution_logs
  FOR SELECT USING (
    tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL
  );

-- ── 7. Trigger updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_assessment_reports_modtime ON public.assessment_reports;
CREATE TRIGGER update_assessment_reports_modtime
  BEFORE UPDATE ON public.assessment_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

COMMENT ON TABLE public.assessment_reports IS
  'Laporan pentaksiran mingguan per anak (DRAFT/PUBLISHED) dengan skor domain, ringkasan, cadangan dan red flag.';
COMMENT ON TABLE public.cron_execution_logs IS
  'Log pelaksanaan cron mingguan. tenant_id NULL bermaksud log global merentas penyewa.';
