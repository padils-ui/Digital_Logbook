import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLE_COOKIE } from '@/middleware';
import { roleHome } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

const VALID_ROLES: UserRole[] = ['super_admin', 'admin_papn', 'teacher', 'parent'];

const PHONE_EMAIL_DOMAIN = 'papn.local';

function buildEmailCandidates(identifier: string): string[] {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes('@')) return [trimmed];
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return [];
  const set = new Set([`${digits}@${PHONE_EMAIL_DOMAIN}`]);
  if (digits.startsWith('0')) set.add(`6${digits}@${PHONE_EMAIL_DOMAIN}`);
  return Array.from(set);
}

export async function POST(request: NextRequest) {
  // Kumpulkan semua cookies yang Supabase ssr mahu tetapkan dalam satu array.
  // Cara ini memastikan cookies tidak hilang semasa kita bina NextResponse.json().
  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          // Simpan dalam array tempatan — akan diterapkan ke jsonResponse kemudian.
          cookiesToSet.forEach((c: { name: string; value: string; options?: CookieOptions }) => pendingCookies.push(c));
        },
      },
    }
  );

  let body: { identifier?: string; password?: string; role?: string; redirectTo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak sah.' }, { status: 400 });
  }

  const { identifier = '', password = '', role = '', redirectTo = '' } = body;

  if (!identifier || !password) {
    return NextResponse.json(
      { error: 'Sila masukkan e-mel/nombor telefon dan kata laluan.' },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'Sila pilih peranan anda.' }, { status: 400 });
  }

  const candidates = buildEmailCandidates(identifier);
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: 'Sila masukkan e-mel atau nombor telefon yang sah.' },
      { status: 400 }
    );
  }

  // --- Langkah 1: Pengesahan kelayakan Supabase Auth ---
  let userId: string | null = null;
  for (const email of candidates) {
    console.log('[api/auth/login] cuba e-mel:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log('[api/auth/login] auth error:', error.status, error.message);
    }
    if (!error && data.user) {
      userId = data.user.id;
      console.log('[api/auth/login] auth berjaya, user.id:', userId);
      break;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Log masuk gagal. Sila semak e-mel/telefon dan kata laluan.' },
      { status: 401 }
    );
  }

  // --- Langkah 2: Semak / auto-daftar profil dalam public.users ---
  const admin = createAdminClient();
  let actualRole: UserRole | null = null;

  try {
    const { data: existingProfile, error: fetchErr } = await admin
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (existingProfile) {
      const r = existingProfile.role as UserRole | undefined;
      actualRole = r && VALID_ROLES.includes(r) ? r : null;
      console.log('[api/auth/login] peranan dalam pangkalan data:', actualRole);
    } else {
      console.log('[api/auth/login] tiada profil, cuba auto-daftar…');

      const { data: tenants, error: tenantErr } = await admin
        .from('tenants')
        .select('id')
        .limit(2);

      if (tenantErr) throw tenantErr;

      if (!tenants || tenants.length === 0) {
        console.log('[api/auth/login] tiada tenant dalam pangkalan data');
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            error:
              'Tiada pusat (tenant) dalam sistem. Sila hubungi pentadbir untuk menambah pusat terlebih dahulu.',
          },
          { status: 403 }
        );
      }

      if (tenants.length > 1) {
        console.log('[api/auth/login] berbilang tenant, tidak boleh auto-daftar');
        await supabase.auth.signOut();
        return NextResponse.json(
          {
            error:
              'Akaun anda belum didaftarkan. Sila hubungi pentadbir PAPN untuk mendaftarkan profil anda dalam sistem.',
          },
          { status: 403 }
        );
      }

      const tenantId = tenants[0].id;
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const email = authUser?.user?.email ?? '';
      const fullName = email.split('@')[0] ?? 'Pengguna Baharu';

      const { error: insertErr } = await admin.from('users').insert({
        id: userId,
        tenant_id: tenantId,
        full_name: fullName,
        role: role as UserRole,
        phone_number: null,
      });

      if (insertErr) {
        console.error('[api/auth/login] gagal auto-daftar profil:', insertErr);
        await supabase.auth.signOut();
        return NextResponse.json(
          { error: 'Gagal mencipta profil. Sila hubungi pentadbir PAPN.' },
          { status: 500 }
        );
      }

      actualRole = role as UserRole;
      console.log('[api/auth/login] profil auto-didaftar:', { userId, tenantId, role: actualRole });
    }
  } catch (err) {
    console.error('[api/auth/login] fetchRole/auto-daftar gagal:', err);
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'Ralat semasa mengesahkan akaun. Sila cuba lagi.' },
      { status: 500 }
    );
  }

  if (!actualRole) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'Peranan akaun tidak sah. Sila hubungi pentadbir PAPN.' },
      { status: 403 }
    );
  }

  if (actualRole !== (role as UserRole)) {
    console.log('[api/auth/login] peranan tidak sepadan — pilih:', role, 'sebenar:', actualRole);
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: 'Peranan yang dipilih tidak sepadan dengan akaun anda.' },
      { status: 403 }
    );
  }

  // --- Langkah 3: Bina respons akhir dengan SEMUA cookies dalam satu operasi ---
  const destination =
    redirectTo && redirectTo.startsWith('/') ? redirectTo : roleHome(actualRole);

  console.log('[api/auth/login] log masuk berjaya, peranan:', actualRole, '→', destination);

  const jsonResponse = NextResponse.json({ redirectTo: destination });

  // Terapkan cookies Supabase auth (sb-*) yang dikumpul semasa signInWithPassword.
  for (const { name, value, options } of pendingCookies) {
    jsonResponse.cookies.set(name, value, options as CookieOptions);
  }

  // Terapkan cookie papn_role — httpOnly: false supaya JS boleh debug,
  // tapi middleware membaca dari request.cookies (tidak memerlukan JS access).
  jsonResponse.cookies.set(ROLE_COOKIE, actualRole, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  console.log(
    '[api/auth/login] cookies ditetapkan:',
    jsonResponse.cookies.getAll().map((c) => c.name)
  );

  return jsonResponse;
}
