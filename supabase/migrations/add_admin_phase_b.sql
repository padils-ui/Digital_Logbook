-- ============================================================
-- Migrasi: Modul Pentadbiran PAPN — Fasa B (Pengurusan Pengguna)
-- ============================================================
-- Perubahan:
--   1. users: lajur email + is_active
--   2. class_teachers: pemetaan pendidik kepada kelas
-- Selamat dijalankan berulang kali (idempotent).
-- Jalankan dalam Supabase SQL Editor jika tidak dijalankan melalui skrip.

-- ── 1. Lajur baharu pada users ──────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_tenant_role
  ON public.users(tenant_id, role);

COMMENT ON COLUMN public.users.email IS
  'E-mel log masuk pendidik / ibu bapa — diselaraskan dengan auth.users.';
COMMENT ON COLUMN public.users.is_active IS
  'Status akaun. FALSE menghalang pengguna daripada log masuk.';

-- ── 2. Prasyarat FK komposit ────────────────────────────────
-- Indeks unik komposit diperlukan oleh FK (id, tenant_id).
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_id_tenant
  ON public.users(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_classes_id_tenant
  ON public.classes(id, tenant_id);

-- ── 3. class_teachers ───────────────────────────────────────
-- Pemetaan pendidik kepada kelas dalam tenant yang sama.
CREATE TABLE IF NOT EXISTS public.class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_teachers_unique UNIQUE (tenant_id, class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teachers_tenant_teacher
  ON public.class_teachers(tenant_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_tenant_class
  ON public.class_teachers(tenant_id, class_id);

-- FK komposit: halang pemetaan merentas penyewa pada peringkat DB.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'class_teachers_class_tenant_fkey'
      AND conrelid = 'public.class_teachers'::regclass
  ) THEN
    ALTER TABLE public.class_teachers
      ADD CONSTRAINT class_teachers_class_tenant_fkey
      FOREIGN KEY (class_id, tenant_id)
      REFERENCES public.classes(id, tenant_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'class_teachers_teacher_tenant_fkey'
      AND conrelid = 'public.class_teachers'::regclass
  ) THEN
    ALTER TABLE public.class_teachers
      ADD CONSTRAINT class_teachers_teacher_tenant_fkey
      FOREIGN KEY (teacher_id, tenant_id)
      REFERENCES public.users(id, tenant_id)
      ON DELETE CASCADE;
  END IF;
END
$$;

COMMENT ON TABLE public.class_teachers IS
  'Pemetaan pendidik kepada kelas yang dipertanggungjawabkan.';

-- ── 4. RLS: class_teachers ──────────────────────────────────
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

-- Pendidik nampak tugasan sendiri; admin nampak semua dalam tenant.
DROP POLICY IF EXISTS "Tenant users can view class teachers" ON public.class_teachers;
CREATE POLICY "Tenant users can view class teachers" ON public.class_teachers
  FOR SELECT USING (
    tenant_id = public.get_auth_tenant_id()
    AND (
      teacher_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('teacher', 'admin_papn', 'super_admin')
      )
    )
  );

DROP POLICY IF EXISTS "Admins can create class teachers" ON public.class_teachers;
CREATE POLICY "Admins can create class teachers" ON public.class_teachers
  FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update class teachers" ON public.class_teachers;
CREATE POLICY "Admins can update class teachers" ON public.class_teachers
  FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  )
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can delete class teachers" ON public.class_teachers;
CREATE POLICY "Admins can delete class teachers" ON public.class_teachers
  FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );
