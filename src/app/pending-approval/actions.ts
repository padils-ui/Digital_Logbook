'use server';

import { cookies } from 'next/headers';
import { getCurrentUser, roleHome } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { STATUS_COOKIE } from '@/middleware';
import type { UserApprovalStatus, UserRole } from '@/lib/types';

export interface ApprovalCheckState {
  /** Status terkini terus daripada pangkalan data. */
  status?: UserApprovalStatus;
  /** Laluan untuk diteruskan apabila akaun telah diluluskan. */
  redirectTo?: string;
  /** Mesej ralat jika semakan gagal. */
  error?: string;
}

/**
 * Menyemak semula status kelulusan akaun pengguna semasa dan menyegerakkan
 * cookie `papn_status` supaya middleware Edge membenarkan akses selepas
 * pentadbir meluluskan akaun.
 *
 * Semakan dibuat dengan klien service role kerana akaun `pending` tidak
 * mempunyai akses penyewa melalui RLS.
 */
export async function refreshApprovalStatus(): Promise<ApprovalCheckState> {
  const profile = await getCurrentUser();
  if (!profile) {
    return { error: 'Sesi anda telah tamat. Sila log masuk semula.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('status, role')
    .eq('id', profile.id)
    .maybeSingle();

  if (error) {
    return { error: 'Gagal menyemak status akaun. Sila cuba lagi.' };
  }

  const status = (data?.status as UserApprovalStatus) ?? 'pending';
  const role = (data?.role as UserRole) ?? profile.role;

  const cookieStore = cookies();
  cookieStore.set(STATUS_COOKIE, status, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  if (status === 'approved') {
    return { status, redirectTo: roleHome(role) };
  }

  return { status };
}
