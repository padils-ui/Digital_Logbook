-- =============================================================================
-- Fasa D — Tetapan Pusat PAPN
-- 1. Lajur `phone` & `email` pada public.center_settings
-- 2. Baldi storan `center-assets` untuk kepala surat (public read)
-- 3. Dasar storan: baca awam, tulis hanya pentadbir dalam folder tenant sendiri
--
-- Semua arahan bersifat idempotent dan selamat dijalankan berulang kali.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Metadata pusat
-- -----------------------------------------------------------------------------
ALTER TABLE public.center_settings
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.center_settings
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.center_settings.phone IS 'Nombor telefon rasmi pusat PAPN.';
COMMENT ON COLUMN public.center_settings.email IS 'Alamat e-mel rasmi pusat PAPN.';

-- -----------------------------------------------------------------------------
-- 2. Baldi storan kepala surat
--    Had 2 MB dan hanya imej raster yang dibenarkan.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'center-assets',
  'center-assets',
  TRUE,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 3. Dasar RLS storan
--    Konvensyen laluan: {tenant_id}/letterhead-{timestamp}.{ext}
--    Oleh itu segmen pertama folder mesti sama dengan tenant pengguna.
-- -----------------------------------------------------------------------------

-- Baca: baldi awam, jadi imej boleh dimuatkan melalui URL awam.
DROP POLICY IF EXISTS "center_assets_public_read" ON storage.objects;
CREATE POLICY "center_assets_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'center-assets');

-- Muat naik: pentadbir sahaja, dalam folder tenant sendiri.
DROP POLICY IF EXISTS "center_assets_admin_insert" ON storage.objects;
CREATE POLICY "center_assets_admin_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'center-assets'
    AND (storage.foldername(name))[1] = public.get_auth_tenant_id()::text
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

-- Kemas kini (ganti fail): pentadbir sahaja, folder tenant sendiri.
DROP POLICY IF EXISTS "center_assets_admin_update" ON storage.objects;
CREATE POLICY "center_assets_admin_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'center-assets'
    AND (storage.foldername(name))[1] = public.get_auth_tenant_id()::text
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'center-assets'
    AND (storage.foldername(name))[1] = public.get_auth_tenant_id()::text
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );

-- Hapus: pentadbir sahaja, folder tenant sendiri.
DROP POLICY IF EXISTS "center_assets_admin_delete" ON storage.objects;
CREATE POLICY "center_assets_admin_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'center-assets'
    AND (storage.foldername(name))[1] = public.get_auth_tenant_id()::text
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin_papn', 'super_admin')
    )
  );
