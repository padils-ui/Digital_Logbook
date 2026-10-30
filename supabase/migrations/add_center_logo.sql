-- ============================================================
-- Migrasi: Logo Pusat / Ikon Aplikasi (Tetapan PAPN)
-- ============================================================
-- Menambah lajur `logo_url` pada public.center_settings supaya logo
-- pusat boleh dipaparkan pada bar sisi dan pengepala aplikasi.
-- Selamat dijalankan berulang kali (idempotent).

ALTER TABLE public.center_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.center_settings.logo_url IS
  'URL awam imej logo pusat / ikon aplikasi dalam baldi center-assets.';

-- Baldi storan sudah diwujudkan dalam migrasi Fasa D. Blok ini memastikan
-- ia wujud walaupun migrasi tersebut belum dijalankan pada persekitaran ini.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'center-assets',
  'center-assets',
  TRUE,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
