'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { UserApprovalStatus, UserRole } from '@/lib/types';

export interface ApprovalActionResult {
  ok: boolean;
  error?: string;
}

/** Sahkan pengguna ialah pentadbir (admin_papn / super_admin). */
async function requireAdmin() {
  const profile = await getCurrentUser();
  if (!profile) {
    return { profile: null, error: 'Sesi tamat. Sila log masuk semula.' };
  }
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    return { profile: null, error: 'Anda tiada kebenaran untuk tindakan ini.' };
  }
  return { profile, error: null };
}

interface PendingTarget {
  id: string;
  role: UserRole;
  tenant_id: string;
  status: UserApprovalStatus;
}

/**
 * Ambil pendaftaran yang menunggu kelulusan.
 * Ditapis kepada tenant pentadbir — klien admin memintas RLS, jadi penapisan
 * `tenant_id` mesti dibuat secara eksplisit.
 */
async function fetchPendingTarget(
  userId: string,
  tenantId: string
): Promise<{ target: PendingTarget | null; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, role, tenant_id, status')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { target: null, error: `Gagal menyemak pendaftaran: ${error.message}` };
  }
  if (!data) {
    return { target: null, error: 'Pendaftaran tidak dijumpai dalam pusat anda.' };
  }

  return { target: data as PendingTarget };
}

/**
 * Luluskan pendaftaran akaun.
 * Bagi akaun Ibu Bapa, anak yang dipilih dipautkan ke `parent_student_map`
 * sebelum status ditukar kepada 'approved'.
 */
export async function approveRegistration(
  userId: string,
  studentIds: string[] = []
): Promise<ApprovalActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const { target, error: targetError } = await fetchPendingTarget(
    userId,
    profile.tenant_id
  );
  if (!target) return { ok: false, error: targetError };
  if (target.status !== 'pending') {
    return { ok: false, error: 'Pendaftaran ini telah pun diproses.' };
  }

  const admin = createAdminClient();
  const tenantId = profile.tenant_id;

  // Pautkan anak — hanya relevan untuk akaun Ibu Bapa.
  if (target.role === 'parent' && studentIds.length > 0) {
    const uniqueIds = Array.from(new Set(studentIds.filter(Boolean)));

    // Sahkan setiap anak milik tenant yang sama.
    const { data: validStudents, error: studentsError } = await admin
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id', uniqueIds);

    if (studentsError) {
      return { ok: false, error: `Gagal menyemak anak: ${studentsError.message}` };
    }

    const validIds = new Set(((validStudents ?? []) as { id: string }[]).map((s) => s.id));
    if (validIds.size !== uniqueIds.length) {
      return {
        ok: false,
        error: 'Sebahagian anak yang dipilih bukan milik pusat anda.',
      };
    }

    // Elak pautan berganda sedia ada.
    const { data: existingLinks, error: linksError } = await admin
      .from('parent_student_map')
      .select('student_id')
      .eq('tenant_id', tenantId)
      .eq('parent_id', userId)
      .in('student_id', uniqueIds);

    if (linksError) {
      return { ok: false, error: `Gagal menyemak pautan anak: ${linksError.message}` };
    }

    const linkedIds = new Set(
      ((existingLinks ?? []) as { student_id: string }[]).map((l) => l.student_id)
    );
    const rows = uniqueIds
      .filter((id) => !linkedIds.has(id))
      .map((studentId) => ({
        tenant_id: tenantId,
        parent_id: userId,
        student_id: studentId,
        relationship_type: null,
        is_primary: false,
      }));

    if (rows.length > 0) {
      const { error: insertError } = await admin
        .from('parent_student_map')
        .insert(rows);

      if (insertError) {
        return { ok: false, error: `Gagal memautkan anak: ${insertError.message}` };
      }
    }
  }

  const { error: updateError } = await admin
    .from('users')
    .update({ status: 'approved', is_active: true })
    .eq('id', userId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    return { ok: false, error: `Gagal meluluskan pendaftaran: ${updateError.message}` };
  }

  revalidatePath('/admin/approvals');
  revalidatePath('/admin/ibu-bapa');
  revalidatePath('/admin/pendidik');
  return { ok: true };
}

/** Tolak pendaftaran akaun. Akaun ditolak tidak boleh log masuk. */
export async function rejectRegistration(
  userId: string
): Promise<ApprovalActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { ok: false, error: error ?? 'Ralat kebenaran.' };

  const { target, error: targetError } = await fetchPendingTarget(
    userId,
    profile.tenant_id
  );
  if (!target) return { ok: false, error: targetError };
  if (target.status !== 'pending') {
    return { ok: false, error: 'Pendaftaran ini telah pun diproses.' };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from('users')
    .update({ status: 'rejected' })
    .eq('id', userId)
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return { ok: false, error: `Gagal menolak pendaftaran: ${updateError.message}` };
  }

  revalidatePath('/admin/approvals');
  return { ok: true };
}
