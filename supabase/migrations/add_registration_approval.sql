-- ============================================================
-- Migrasi: Pendaftaran Sendiri Berkod + Baris Gilir Kelulusan
-- ============================================================
-- Perubahan:
--   1. users: lajur status kelulusan ('pending' | 'approved' | 'rejected')
--   2. Indeks (tenant_id, status) untuk baris gilir kelulusan pentadbir
--   3. get_auth_tenant_id() hanya memulangkan tenant bagi akaun 'approved'
-- Selamat dijalankan berulang kali (idempotent).
-- Jalankan dalam Supabase SQL Editor jika tidak dijalankan melalui skrip.

-- ── 1. Lajur status kelulusan ───────────────────────────────
-- DEFAULT 'approved' penting supaya akaun sedia ada (dan auto-daftar semasa
-- log masuk) tidak terkunci oleh pengawal kelulusan yang baharu.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

-- Kekangan CHECK ditambah secara berasingan supaya migrasi kekal idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_status_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END
$$;

COMMENT ON COLUMN public.users.status IS
  'Status kelulusan akaun: pending (menunggu semakan), approved (diluluskan), rejected (ditolak).';

-- ── 2. Indeks baris gilir kelulusan ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_tenant_status
  ON public.users(tenant_id, status);

-- ── 3. Sekatan berlapis di peringkat pangkalan data ─────────
-- Semua policy RLS penyewa bergantung pada public.get_auth_tenant_id().
-- Dengan memulangkan NULL bagi akaun 'pending' / 'rejected', akaun yang belum
-- diluluskan tidak dapat membaca data kelas, anak atau log walaupun mereka
-- memanggil Supabase secara terus daripada pelayar (memintas Server Action).
-- Profil sendiri masih boleh dibaca oleh pengguna melalui policy `users`
-- berasaskan id = auth.uid() dan melalui klien service role di pelayan.
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
    AND u.status = 'approved'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_auth_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO authenticated, service_role;
