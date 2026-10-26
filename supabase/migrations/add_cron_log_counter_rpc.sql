-- ============================================================
-- Kiraan atomik bagi cron_execution_logs
--
-- Pekerja Inngest (`process-student-assessment`) berjalan serentak untuk
-- setiap murid. Kemas kini `processed_students` / `failed_students` mesti
-- bersifat atomik supaya kiraan tidak hilang akibat perlumbaan.
--
-- Status 'FAILED' bersifat "sticky": sekali gagal, kekal FAILED walaupun
-- murid lain berjaya selepasnya.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_cron_execution_log(
  p_log_id UUID,
  p_processed INTEGER DEFAULT 0,
  p_failed INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.cron_execution_logs
     SET processed_students = processed_students + GREATEST(p_processed, 0),
         failed_students    = failed_students + GREATEST(p_failed, 0),
         status = CASE
                    WHEN status = 'FAILED' THEN 'FAILED'
                    WHEN p_status = 'FAILED' THEN 'FAILED'
                    ELSE COALESCE(p_status, status)
                  END,
         error_message = COALESCE(p_error, error_message)
   WHERE id = p_log_id;
$$;

-- Hanya service_role (pekerja latar belakang) boleh memanggil fungsi ini.
REVOKE ALL ON FUNCTION public.increment_cron_execution_log(UUID, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_cron_execution_log(UUID, INTEGER, INTEGER, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_cron_execution_log(UUID, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
