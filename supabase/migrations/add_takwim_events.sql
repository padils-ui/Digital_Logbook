-- ============================================================
-- Migrasi: Takwim & Acara PAPN + Keutamaan Pengumuman
-- ============================================================
-- Jalankan fail ini secara manual dalam Supabase Dashboard →
-- SQL Editor (pangkah "Run"). Selamat dijalankan berulang kali
-- (idempotent) — tiada arahan CLI diperlukan.
--
-- Perubahan:
--   1. Jadual baharu `public.takwim_events` untuk takwim pusat.
--   2. Lajur baharu `announcements.priority` (urgent / general).
--   3. Lajur baharu `announcements.category` (tag kategori bebas).
-- ============================================================

-- ── 0. Prasyarat (fungsi dikongsi) ──────────────────────────
-- Fungsi ini biasanya sudah dicipta oleh
-- `add_admin_module_phase_a.sql`. Dicipta semula secara defensif
-- supaya migrasi ini boleh dijalankan secara berdikari.
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

-- ── 1. Jadual takwim_events ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.takwim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'lain',
  is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT takwim_events_event_type_check
    CHECK (event_type IN ('mesyuarat', 'cuti', 'aktiviti', 'lain'))
);

COMMENT ON TABLE public.takwim_events IS
  'Takwim & acara pusat PAPN (mesyuarat, cuti, aktiviti, lain-lain).';
COMMENT ON COLUMN public.takwim_events.event_date IS
  'Tarikh acara (ISO YYYY-MM-DD).';
COMMENT ON COLUMN public.takwim_events.event_type IS
  'Jenis acara: mesyuarat | cuti | aktiviti | lain.';
COMMENT ON COLUMN public.takwim_events.is_holiday IS
  'Benar jika acara menutup operasi pusat (cuti).';

-- Indeks pertanyaan papan pemuka: acara akan datang mengikut tarikh.
CREATE INDEX IF NOT EXISTS idx_takwim_events_tenant_date
  ON public.takwim_events (tenant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_takwim_events_tenant_type
  ON public.takwim_events (tenant_id, event_type);

-- Trigger updated_at.
DROP TRIGGER IF EXISTS update_takwim_events_modtime ON public.takwim_events;
CREATE TRIGGER update_takwim_events_modtime
  BEFORE UPDATE ON public.takwim_events
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ── 2. RLS takwim_events ────────────────────────────────────
ALTER TABLE public.takwim_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'takwim_events'
      AND policyname = 'Takwim: baca tenant sendiri'
  ) THEN
    CREATE POLICY "Takwim: baca tenant sendiri" ON public.takwim_events
      FOR SELECT USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'takwim_events'
      AND policyname = 'Takwim: pentadbir cipta'
  ) THEN
    CREATE POLICY "Takwim: pentadbir cipta" ON public.takwim_events
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
      AND tablename = 'takwim_events'
      AND policyname = 'Takwim: pentadbir kemas kini'
  ) THEN
    CREATE POLICY "Takwim: pentadbir kemas kini" ON public.takwim_events
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
      AND tablename = 'takwim_events'
      AND policyname = 'Takwim: pentadbir padam'
  ) THEN
    CREATE POLICY "Takwim: pentadbir padam" ON public.takwim_events
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

-- ── 3. Lajur baharu pada announcements ──────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.announcements.priority IS
  'Keutamaan pengumuman: urgent (sepanduk merah) atau general (sepanduk biru).';
COMMENT ON COLUMN public.announcements.category IS
  'Tag kategori bebas, contoh Keselamatan atau Acara.';

-- Kekangan CHECK ditambah secara idempotent (ADD CONSTRAINT tiada IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'announcements_priority_check'
      AND conrelid = 'public.announcements'::regclass
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_priority_check
      CHECK (priority IN ('urgent', 'general'));
  END IF;
END $$;

-- Pengumuman sedia ada yang disemat dianggap urgent.
UPDATE public.announcements
SET priority = 'urgent'
WHERE is_pinned IS TRUE
  AND priority = 'general';
