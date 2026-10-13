// @ts-nocheck
'use server';

import { createClient } from '@/lib/supabase/server';
import { generateDailyLogPdf } from '@/lib/pdf-generator';
import { updateDriveFile } from '@/lib/google-drive';
import { revalidatePath } from 'next/cache';

export async function submitParentComment(formData: FormData) {
  const supabase = await createClient();

  const logId = formData.get('logId') as string;
  const parentComment = formData.get('parentComment') as string;

  if (!logId || !parentComment?.trim()) {
    return { error: 'Ulasan tidak boleh kosong.' };
  }

  // 1. Fetch existing daily log record along with student details
  const { data: rawLog, error: fetchError } = await supabase
    .from('daily_logs')
    .select(`
      *,
      students (
        full_name,
        class_name
      )
    `)
    .eq('id', logId)
    .single();

  if (fetchError || !rawLog) {
    return { error: 'Log harian tidak dijumpai.' };
  }

  const log = rawLog;
  const student = Array.isArray(log.students) ? log.students[0] : log.students;
  const commentedAt = new Date().toISOString();

  // 2. Update Supabase record with parent feedback
  const { error: updateError } = await supabase
    .from('daily_logs')
    .update({
      parent_comment: parentComment.trim(),
      parent_commented_at: commentedAt,
      parent_reviewed: true,
    })
    .eq('id', logId);

  if (updateError) {
    return { error: 'Gagal menyimpan ulasan ke dalam pangkalan data.' };
  }

  // 3. Prepare data and re-render the single-page A4 PDF
  try {
    const pdfData = {
      center: {
        name: log.center_name || 'Pusat Anak Permata Negara (PAPN)',
      },
      studentName: student?.full_name || 'Anak',
      className: student?.class_name || '-',
      logDate: log.log_date,
      contentByCategory: log.content_by_category || log.content || {},
      teacherName: log.teacher_name || 'Pendidik',
      categoryPhotos: log.category_photos || {},
      parentComment: parentComment.trim(),
      parentCommentedAt: commentedAt,
    };

    const updatedPdfBuffer = await generateDailyLogPdf(pdfData);

    // 4. Overwrite existing PDF in Google Drive if file ID exists
    if (log.drive_file_id && typeof updateDriveFile === 'function') {
      await updateDriveFile(log.drive_file_id, updatedPdfBuffer);
    }
  } catch (pdfErr) {
    console.error('[Parent Action] Ralat semasa menjana/mengemas kini PDF:', pdfErr);
  }

  revalidatePath('/parent');
  return { success: true };
}