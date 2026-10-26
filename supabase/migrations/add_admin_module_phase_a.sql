-- ============================================================
-- Migrasi: Modul Pentadbiran PAPN — Fasa A (Skema + RLS)
-- ============================================================
-- Jadual: parent_student_map, center_settings, academic_calendar.
-- Selamat dijalankan berulang kali (idempotent).
-- Jalankan dalam Supabase SQL Editor jika tidak dijalankan melalui skrip.

-- ── 0. Helper tenant pengguna ───────────────────────────────
-- SECURITY DEFINER + search_path dikunci bagi mengelak search_path hijacking.
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
REVOKE ALL ON FUNCTION public.get_auth_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO authenticated, service_role;

-- Trigger updated_at dikongsi (cipta jika belum wujud).
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

-- Indeks unik komposit — prasyarat FK silang penyewa.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_id_tenant
  ON public.users(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_students_id_tenant
  ON public.students(id, tenant_id);

-- ── 1. parent_student_map ───────────────────────────────────
-- Pemetaan ibu bapa / penjaga kepada anak dalam tenant yang sama.
CREATE TABLE IF NOT EXISTS public.parent_student_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'Ibu Bapa',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parent_student_map_unique UNIQUE (tenant_id, parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_student_map_tenant_parent
  ON public.parent_student_map(tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_map_tenant_student
  ON public.parent_student_map(tenant_id, student_id);

-- FK komposit: halang pemetaan merentas penyewa pada peringkat DB.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parent_student_map_parent_tenant_fkey'
      AND conrelid = 'public.parent_student_map'::regclass
  ) THEN
    ALTER TABLE public.parent_student_map
      ADD CONSTRAINT parent_student_map_parent_tenant_fkey
      FOREIGN KEY (parent_id, tenant_id)
      REFERENCES public.users(id, tenant_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parent_student_map_student_tenant_fkey'
      AND conrelid = 'public.parent_student_map'::regclass
  ) THEN
    ALTER TABLE public.parent_student_map
      ADD CONSTRAINT parent_student_map_student_tenant_fkey
      FOREIGN KEY (student_id, tenant_id)
      REFERENCES public.students(id, tenant_id)
      ON DELETE CASCADE;
  END IF;
END
$$;

-- Seorang anak hanya boleh mempunyai SATU ibu bapa utama.
CREATE UNIQUE INDEX IF NOT EXISTS ux_parent_student_map_primary
  ON public.parent_student_map(tenant_id, student_id)
  WHERE is_primary;

COMMENT ON TABLE public.parent_student_map IS
  'Pemetaan ibu bapa / penjaga kepada anak. is_primary menandakan penjaga utama.';

-- ── 2. center_settings ──────────────────────────────────────
-- Tetapan pusat (kepala surat, alamat, tahun akademik) — satu baris per tenant.
CREATE TABLE IF NOT EXISTS public.center_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  center_name TEXT NOT NULL,
  code TEXT,
  letterhead_url TEXT,
  address TEXT,
  academic_year TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.center_settings IS
  'Tetapan pusat PAPN: nama pusat, kod, kepala surat, alamat dan tahun akademik.';
COMMENT ON COLUMN public.center_settings.academic_year IS
  'Tahun akademik dalam bentuk teks (contoh: 2026 atau 2026/2027).';

-- ── 3. academic_calendar ────────────────────────────────────
-- Takwim akademik / cuti pusat.
CREATE TABLE IF NOT EXISTS public.academic_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  event_name TEXT NOT NULL,
  is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_calendar_unique UNIQUE (tenant_id, date, event_name)
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_tenant_date
  ON public.academic_calendar(tenant_id, date);

COMMENT ON TABLE public.academic_calendar IS
  'Takwim akademik pusat. is_holiday menandakan tarikh cuti (bukan hari persekolahan).';

-- ── 4. Trigger updated_at ───────────────────────────────────
DROP TRIGGER IF EXISTS update_parent_student_map_modtime ON public.parent_student_map;
CREATE TRIGGER update_parent_student_map_modtime
  BEFORE UPDATE ON public.parent_student_map
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_center_settings_modtime ON public.center_settings;
CREATE TRIGGER update_center_settings_modtime
  BEFORE UPDATE ON public.center_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS update_academic_calendar_modtime ON public.academic_calendar;
CREATE TRIGGER update_academic_calendar_modtime
  BEFORE UPDATE ON public.academic_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ── 5. RLS: parent_student_map ──────────────────────────────
ALTER TABLE public.parent_student_map ENABLE ROW LEVEL SECURITY;

-- Guru/admin nampak semua pemetaan tenant; ibu bapa hanya rekod sendiri.
DROP POLICY IF EXISTS "Tenant users can view parent student map" ON public.parent_student_map;
CREATE POLICY "Tenant users can view parent student map" ON public.parent_student_map
  FOR SELECT USING (
    tenant_id = public.get_auth_tenant_id()
    AND (
      parent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('teacher', 'admin_papn', 'super_admin')
      )
    )
  );

DROP POLICY IF EXISTS "Admins can create parent student map" ON public.parent_student_map;
CREATE POLICY "Admins can create parent student map" ON public.parent_student_map
  FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update parent student map" ON public.parent_student_map;
CREATE POLICY "Admins can update parent student map" ON public.parent_student_map
  FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  )
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can delete parent student map" ON public.parent_student_map;
CREATE POLICY "Admins can delete parent student map" ON public.parent_student_map
  FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

-- ── 6. RLS: center_settings ─────────────────────────────────
ALTER TABLE public.center_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view center settings" ON public.center_settings;
CREATE POLICY "Tenant users can view center settings" ON public.center_settings
  FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can create center settings" ON public.center_settings;
CREATE POLICY "Admins can create center settings" ON public.center_settings
  FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update center settings" ON public.center_settings;
CREATE POLICY "Admins can update center settings" ON public.center_settings
  FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  )
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can delete center settings" ON public.center_settings;
CREATE POLICY "Admins can delete center settings" ON public.center_settings
  FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

-- ── 7. RLS: academic_calendar ───────────────────────────────
ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view academic calendar" ON public.academic_calendar;
CREATE POLICY "Tenant users can view academic calendar" ON public.academic_calendar
  FOR SELECT USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can create academic calendar" ON public.academic_calendar;
CREATE POLICY "Admins can create academic calendar" ON public.academic_calendar
  FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update academic calendar" ON public.academic_calendar;
CREATE POLICY "Admins can update academic calendar" ON public.academic_calendar
  FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  )
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Admins can delete academic calendar" ON public.academic_calendar;
CREATE POLICY "Admins can delete academic calendar" ON public.academic_calendar
  FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );
