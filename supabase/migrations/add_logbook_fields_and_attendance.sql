-- ============================================================
-- Migrasi: Medan Kluster Log Harian + Jadual Kehadiran
-- ============================================================
-- Jalankan skrip ini dalam Supabase SQL Editor.
-- Selamat dijalankan berulang kali (idempotent) menggunakan IF NOT EXISTS.

-- ── 1. Lajur kluster Aktiviti pada jadual daily_logs ─────────
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS aktiviti_bebas       TEXT,
  ADD COLUMN IF NOT EXISTS penglibatan_bebas    TEXT,
  ADD COLUMN IF NOT EXISTS foto_bebas           TEXT,
  ADD COLUMN IF NOT EXISTS aktiviti_luar        TEXT,
  ADD COLUMN IF NOT EXISTS penglibatan_luar     TEXT,
  ADD COLUMN IF NOT EXISTS foto_luar            TEXT,
  ADD COLUMN IF NOT EXISTS aktiviti_permata     TEXT,
  ADD COLUMN IF NOT EXISTS penglibatan_permata  TEXT,
  ADD COLUMN IF NOT EXISTS foto_permata         TEXT;

COMMENT ON COLUMN daily_logs.aktiviti_bebas      IS 'Aktiviti bebas (kluster Aktiviti: Bebas).';
COMMENT ON COLUMN daily_logs.penglibatan_bebas   IS 'Tahap penglibatan anak bagi aktiviti bebas.';
COMMENT ON COLUMN daily_logs.foto_bebas          IS 'URL/pautan foto bagi aktiviti bebas.';
COMMENT ON COLUMN daily_logs.aktiviti_luar       IS 'Aktiviti luar (kluster Aktiviti: Luar).';
COMMENT ON COLUMN daily_logs.penglibatan_luar    IS 'Tahap penglibatan anak bagi aktiviti luar.';
COMMENT ON COLUMN daily_logs.foto_luar           IS 'URL/pautan foto bagi aktiviti luar.';
COMMENT ON COLUMN daily_logs.aktiviti_permata    IS 'Aktiviti program PERMATA (kluster Aktiviti: PERMATA).';
COMMENT ON COLUMN daily_logs.penglibatan_permata IS 'Tahap penglibatan anak bagi aktiviti PERMATA.';
COMMENT ON COLUMN daily_logs.foto_permata        IS 'URL/pautan foto bagi aktiviti PERMATA.';

-- ── 2. Lajur kluster Tingkah Laku / Kesihatan ────────────────
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS tingkah_laku  TEXT,
  ADD COLUMN IF NOT EXISTS kemalangan    TEXT,
  ADD COLUMN IF NOT EXISTS kecederaan    TEXT,
  ADD COLUMN IF NOT EXISTS kesihatan     TEXT;

COMMENT ON COLUMN daily_logs.tingkah_laku IS 'Catatan tingkah laku anak sepanjang hari.';
COMMENT ON COLUMN daily_logs.kemalangan   IS 'Catatan kemalangan (jika ada) yang berlaku.';
COMMENT ON COLUMN daily_logs.kecederaan   IS 'Catatan kecederaan (jika ada) dan rawatan diberikan.';
COMMENT ON COLUMN daily_logs.kesihatan    IS 'Catatan kesihatan am / ubat yang diberi.';

-- ── 3. Jadual attendance (model kehadiran berasingan) ────────
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Hadir',
  suhu_tiba   TEXT,
  suhu_balik  TEXT,
  catatan     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  attendance            IS 'Rekod kehadiran harian anak (berasingan daripada daily_logs).';
COMMENT ON COLUMN attendance.status     IS 'Status kehadiran: Hadir | Tidak Hadir | Lewat.';
COMMENT ON COLUMN attendance.suhu_tiba  IS 'Suhu badan anak semasa tiba (contoh: 36.5).';
COMMENT ON COLUMN attendance.suhu_balik IS 'Suhu badan anak semasa pulang (contoh: 36.7).';
COMMENT ON COLUMN attendance.catatan    IS 'Catatan tambahan berkaitan kehadiran.';

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_id  ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date);

-- Indeks unik diperlukan oleh operasi upsert (onConflict: tenant_id, student_id, date).
CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_tenant_student_date
  ON attendance(tenant_id, student_id, date);

-- ── 4. RLS untuk attendance (pengasingan berbilang penyewa) ──
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's attendance" ON attendance;
CREATE POLICY "Users can view their tenant's attendance" ON attendance
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers and admins can create attendance" ON attendance;
CREATE POLICY "Teachers and admins can create attendance" ON attendance
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid() AND role IN ('teacher', 'admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can update their tenant's attendance" ON attendance;
CREATE POLICY "Teachers and admins can update their tenant's attendance" ON attendance
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid() AND role IN ('teacher', 'admin_papn', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete their tenant's attendance" ON attendance;
CREATE POLICY "Admins can delete their tenant's attendance" ON attendance
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid() AND role IN ('admin_papn', 'super_admin')
    )
  );
