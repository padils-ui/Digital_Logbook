import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRole } from '@/lib/types';

/**
 * Laluan sementara untuk menaik taraf peranan pengguna yang sedang log masuk.
 *
 * AMARAN: Laluan ini hanya untuk pembangunan/ujian. Padam sebelum pengeluaran.
 *
 * POST /api/dev/make-admin
 * Body (pilihan): { "role": "admin_papn" | "super_admin" }
 */

const ALLOWED_ROLES: UserRole[] = ['admin_papn', 'super_admin'];

/** GET: naik taraf pengguna semasa kepada admin_papn secara automatik. */
export async function GET() {
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json(
      { error: 'Sesi tidak sah. Sila log masuk semula.' },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ role: 'admin_papn' })
    .eq('id', profile.id);

  if (error) {
    return NextResponse.json(
      { error: `Gagal mengemas kini peranan: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Promoted to admin_papn. Please log out and log in again.',
  });
}

export async function POST(request: Request) {
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json(
      { error: 'Sesi tidak sah. Sila log masuk semula.' },
      { status: 401 }
    );
  }

  let role: UserRole = 'admin_papn';
  try {
    const body = await request.json();
    if (body?.role && ALLOWED_ROLES.includes(body.role)) {
      role = body.role;
    }
  } catch {
    // Tiada body — guna lalai admin_papn.
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ role })
    .eq('id', profile.id);

  if (error) {
    return NextResponse.json(
      { error: `Gagal mengemas kini peranan: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    user_id: profile.id,
    full_name: profile.full_name,
    previous_role: profile.role,
    new_role: role,
    note: 'Log keluar dan log masuk semula supaya cookie papn_role dikemas kini.',
  });
}
