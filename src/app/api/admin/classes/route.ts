import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

/** Sahkan pengguna ialah pentadbir. */
async function requireAdmin() {
  const profile = await getCurrentUser();
  if (!profile) {
    return { profile: null, res: NextResponse.json({ error: 'Sesi tamat.' }, { status: 401 }) };
  }
  if (profile.role !== 'admin_papn' && profile.role !== 'super_admin') {
    return { profile: null, res: NextResponse.json({ error: 'Tiada kebenaran.' }, { status: 403 }) };
  }
  return { profile, res: null };
}

/** GET — senarai kelas untuk tenant pengguna. */
export async function GET() {
  const { profile, res } = await requireAdmin();
  if (!profile) return res;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('classes')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('class_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ classes: data ?? [] });
}

/** POST — cipta kelas baharu. */
export async function POST(request: NextRequest) {
  const { profile, res } = await requireAdmin();
  if (!profile) return res;

  const body = (await request.json().catch(() => null)) as
    | { class_name?: string; year?: number }
    | null;

  const className = (body?.class_name ?? '').trim();
  const year = Number(body?.year);
  if (!className) {
    return NextResponse.json({ error: 'Nama kelas diperlukan.' }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 1 || year > 12) {
    return NextResponse.json(
      { error: 'Tahun (umur) mesti antara 1 hingga 12.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('classes')
    .insert({ tenant_id: profile.tenant_id, class_name: className, year })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ class: data }, { status: 201 });
}

/** PUT — kemas kini kelas sedia ada. */
export async function PUT(request: NextRequest) {
  const { profile, res } = await requireAdmin();
  if (!profile) return res;

  const body = (await request.json().catch(() => null)) as
    | { id?: string; class_name?: string; year?: number }
    | null;

  const id = body?.id;
  const className = (body?.class_name ?? '').trim();
  const year = Number(body?.year);
  if (!id) {
    return NextResponse.json({ error: 'ID kelas diperlukan.' }, { status: 400 });
  }
  if (!className) {
    return NextResponse.json({ error: 'Nama kelas diperlukan.' }, { status: 400 });
  }
  if (!Number.isInteger(year) || year < 1 || year > 12) {
    return NextResponse.json(
      { error: 'Tahun (umur) mesti antara 1 hingga 12.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('classes')
    .update({ class_name: className, year })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ class: data });
}

/** DELETE — padam kelas (dengan perlindungan murid ditugaskan). */
export async function DELETE(request: NextRequest) {
  const { profile, res } = await requireAdmin();
  if (!profile) return res;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID kelas diperlukan.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', id)
    .eq('tenant_id', profile.tenant_id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `Kelas ini masih mempunyai ${count} murid. Sila pindahkan murid terlebih dahulu.`,
      },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from('classes')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
