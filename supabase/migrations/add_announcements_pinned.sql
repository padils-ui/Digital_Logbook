-- ============================================================
-- Migrasi: Pengumuman Pusat (semat / pin pada Papan Pemuka)
-- ============================================================
-- Jadual public.announcements sudah wujud dalam skema asas. Migrasi ini
-- hanya menambah lajur `is_pinned` yang membolehkan pentadbir menyematkan
-- pengumuman supaya ia muncul pada widget Papan Pemuka.
-- Selamat dijalankan berulang kali (idempotent).

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.announcements.is_pinned IS
  'Benar jika pengumuman disematkan dan dipaparkan pada widget Papan Pemuka.';

-- Mempercepatkan pertanyaan widget: pengumuman tersemat terbaru dahulu.
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_pinned
  ON public.announcements (tenant_id, is_pinned, created_at DESC);

-- ------------------------------------------------------------------
-- Dasar RLS berasaskan tenant (kekal walaupun dasar asas belum wujud).
-- Penulisan dihadkan kepada pentadbir pusat; bacaan untuk semua pengguna
-- dalam tenant yang sama.
-- ------------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND policyname = 'Pengumuman: baca tenant sendiri'
  ) THEN
    CREATE POLICY "Pengumuman: baca tenant sendiri" ON public.announcements
      FOR SELECT USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND policyname = 'Pengumuman: pentadbir cipta'
  ) THEN
    CREATE POLICY "Pengumuman: pentadbir cipta" ON public.announcements
      FOR INSERT WITH CHECK (
        tenant_id = public.get_auth_tenant_id()
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('admin_papn', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND policyname = 'Pengumuman: pentadbir kemas kini'
  ) THEN
    CREATE POLICY "Pengumuman: pentadbir kemas kini" ON public.announcements
      FOR UPDATE USING (
        tenant_id = public.get_auth_tenant_id()
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('admin_papn', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'announcements'
      AND policyname = 'Pengumuman: pentadbir padam'
  ) THEN
    CREATE POLICY "Pengumuman: pentadbir padam" ON public.announcements
      FOR DELETE USING (
        tenant_id = public.get_auth_tenant_id()
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role IN ('admin_papn', 'super_admin')
        )
      );
  END IF;
END $$;
