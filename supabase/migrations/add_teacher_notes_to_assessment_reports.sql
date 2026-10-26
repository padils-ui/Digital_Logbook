-- ============================================================
-- Migrasi: Tambah lajur teacher_notes pada assessment_reports
-- ============================================================
-- Diperlukan oleh dashboard semakan Human-in-the-Loop: guru boleh
-- menambah catatan sendiri sebelum laporan diterbitkan.
-- Selamat dijalankan berulang kali (idempotent).
--
-- Jalankan dalam Supabase SQL Editor.

ALTER TABLE public.assessment_reports
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.assessment_reports.teacher_notes IS
  'Catatan tambahan guru semasa semakan manual sebelum laporan diterbitkan.';
