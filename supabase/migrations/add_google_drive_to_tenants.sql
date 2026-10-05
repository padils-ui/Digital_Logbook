-- ============================================================
-- Migrasi: Google Drive + Pengurusan Kelas
-- ============================================================

-- ── 1. Lajur Google Drive pada jadual tenants ────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS google_drive_email        TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_folder_id    TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_subfolders   JSONB,
  ADD COLUMN IF NOT EXISTS google_drive_status       TEXT NOT NULL DEFAULT 'not_configured';

COMMENT ON COLUMN tenants.google_drive_email
  IS 'Emel Google akaun sasaran yang akan menerima akses folder Drive tenant.';
COMMENT ON COLUMN tenants.google_drive_folder_id
  IS 'ID folder root Google Drive yang dijana untuk tenant ini.';
COMMENT ON COLUMN tenants.google_drive_subfolders
  IS 'Peta ID subfolder: { "log_harian":"id" }';
COMMENT ON COLUMN tenants.google_drive_status
  IS 'Status penyediaan Google Drive: not_configured | pending_configuration | provisioned | error';

-- ── 2. Jadual classes ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_tenant_id ON classes(tenant_id);

-- ── 3. Pautan murid ke kelas ─────────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- ── 4. RLS untuk classes (pengasingan berbilang penyewa) ─────
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's classes" ON classes;
CREATE POLICY "Users can view their tenant's classes" ON classes
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can create classes in their tenant" ON classes;
CREATE POLICY "Admins can create classes in their tenant" ON classes
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid() AND role IN ('admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update their tenant's classes" ON classes;
CREATE POLICY "Admins can update their tenant's classes" ON classes
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid() AND role IN ('admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete their tenant's classes" ON classes;
CREATE POLICY "Admins can delete their tenant's classes" ON classes
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid() AND role IN ('admin_papn', 'super_admin')
    )
  );
