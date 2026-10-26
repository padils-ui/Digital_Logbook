-- ============================================================
-- Migrasi: Modul Pentadbiran PAPN — Fasa C (Jejak Audit Pentaksiran)
-- ============================================================
-- Perubahan:
--   1. assessment_audit_logs: jejak audit setiap perubahan pada
--      assessment_reports (CREATED / UPDATED / PUBLISHED / UNPUBLISHED).
--   2. Trigger AFTER INSERT/UPDATE pada assessment_reports yang menulis
--      jejak tersebut secara automatik — laluan tulis sedia ada (UI guru,
--      enjin AI, pencetus manual) tidak perlu diubah.
-- Selamat dijalankan berulang kali (idempotent).
-- Jalankan dalam Supabase SQL Editor jika tidak dijalankan melalui skrip.

-- ── 1. Jadual jejak audit ───────────────────────────────────
-- report_id sengaja TIADA FK: jejak audit mesti kekal walaupun laporan
-- dipadam, kerana tujuannya merekod sejarah, bukan memelihara rujukan.
CREATE TABLE IF NOT EXISTS public.assessment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_number INT,
  year INT,
  action TEXT NOT NULL CHECK (
    action IN ('CREATED', 'UPDATED', 'PUBLISHED', 'UNPUBLISHED')
  ),
  from_status TEXT,
  to_status TEXT,
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  actor_user_id UUID,
  actor_role TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_audit_logs_tenant_created
  ON public.assessment_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_audit_logs_report
  ON public.assessment_audit_logs(report_id);

COMMENT ON TABLE public.assessment_audit_logs IS
  'Jejak audit perubahan laporan pentaksiran mingguan — diisi oleh trigger, bukan oleh aplikasi.';
COMMENT ON COLUMN public.assessment_audit_logs.actor_user_id IS
  'NULL apabila perubahan dibuat oleh sistem (enjin AI / service_role).';
COMMENT ON COLUMN public.assessment_audit_logs.metadata IS
  'Butiran tambahan, cth. nilai domain_scores sebelum/selepas (override skor manual).';

-- ── 2. Fungsi trigger ───────────────────────────────────────
-- SECURITY DEFINER supaya penulisan jejak tidak disekat RLS jadual audit
-- apabila guru mengemas kini laporan melalui klien ber-RLS.
CREATE OR REPLACE FUNCTION public.log_assessment_report_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action TEXT;
  v_changed TEXT[] := ARRAY[]::TEXT[];
  v_metadata JSONB := '{}'::jsonb;
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_from_status TEXT;
  v_to_status TEXT;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT u.role INTO v_role
    FROM public.users u
    WHERE u.id = v_actor
    LIMIT 1;
  ELSE
    v_role := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATED';
    v_to_status := NEW.status;
  ELSE
    v_from_status := OLD.status;
    v_to_status := NEW.status;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'PUBLISHED' THEN
        v_action := 'PUBLISHED';
      ELSIF NEW.status = 'DRAFT' THEN
        v_action := 'UNPUBLISHED';
      ELSE
        v_action := 'UPDATED';
      END IF;
      v_changed := pg_catalog.array_append(v_changed, 'status');
    ELSE
      v_action := 'UPDATED';
    END IF;

    IF NEW.domain_scores IS DISTINCT FROM OLD.domain_scores THEN
      v_changed := pg_catalog.array_append(v_changed, 'domain_scores');
      v_metadata := v_metadata || pg_catalog.jsonb_build_object(
        'domain_scores_before', OLD.domain_scores,
        'domain_scores_after', NEW.domain_scores
      );
    END IF;

    IF NEW.summary IS DISTINCT FROM OLD.summary THEN
      v_changed := pg_catalog.array_append(v_changed, 'summary');
    END IF;

    IF NEW.teacher_notes IS DISTINCT FROM OLD.teacher_notes THEN
      v_changed := pg_catalog.array_append(v_changed, 'teacher_notes');
    END IF;

    IF NEW.suggestions_next_week IS DISTINCT FROM OLD.suggestions_next_week THEN
      v_changed := pg_catalog.array_append(v_changed, 'suggestions_next_week');
    END IF;

    IF NEW.red_flags IS DISTINCT FROM OLD.red_flags THEN
      v_changed := pg_catalog.array_append(v_changed, 'red_flags');
    END IF;

    IF NEW.pdf_drive_file_id IS DISTINCT FROM OLD.pdf_drive_file_id THEN
      v_changed := pg_catalog.array_append(v_changed, 'pdf_drive_file_id');
    END IF;

    IF NEW.pdf_drive_url IS DISTINCT FROM OLD.pdf_drive_url THEN
      v_changed := pg_catalog.array_append(v_changed, 'pdf_drive_url');
    END IF;

    -- Tiada perubahan bermakna pada lajur yang diaudit — jangan cemari jejak.
    IF v_changed = ARRAY[]::TEXT[] THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.assessment_audit_logs (
    tenant_id,
    report_id,
    student_id,
    week_number,
    year,
    action,
    from_status,
    to_status,
    changed_fields,
    actor_user_id,
    actor_role,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.student_id,
    NEW.week_number,
    NEW.year,
    v_action,
    v_from_status,
    v_to_status,
    v_changed,
    v_actor,
    v_role,
    v_metadata
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_assessment_report_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_assessment_report_change() FROM anon;
REVOKE ALL ON FUNCTION public.log_assessment_report_change() FROM authenticated;

-- ── 3. Trigger pada assessment_reports ──────────────────────
DROP TRIGGER IF EXISTS log_assessment_report_change ON public.assessment_reports;
CREATE TRIGGER log_assessment_report_change
  AFTER INSERT OR UPDATE ON public.assessment_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.log_assessment_report_change();

-- ── 4. RLS: assessment_audit_logs ───────────────────────────
-- Hanya pentadbir PAPN boleh membaca jejak audit. Tiada polisi INSERT /
-- UPDATE / DELETE: penulisan berlaku melalui trigger SECURITY DEFINER
-- (dan service_role yang memintas RLS).
ALTER TABLE public.assessment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view tenant assessment audit logs"
  ON public.assessment_audit_logs;
CREATE POLICY "Admins can view tenant assessment audit logs"
  ON public.assessment_audit_logs
  FOR SELECT USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );
