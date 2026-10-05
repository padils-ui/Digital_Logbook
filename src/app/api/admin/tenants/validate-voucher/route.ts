import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

/** Kod baucar khas yang memintas pengesahan gerbang pembayaran. */
const BYPASS_VOUCHER_CODE = 'PAPN100';

/** Sahkan pengguna ialah pentadbir (admin_papn / super_admin). */
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

/**
 * POST — sahkan kod baucar tanpa menyediakan tenant.
 * Digunakan oleh butang "Guna Baucar" pada borang pendaftaran.
 */
export async function POST(request: NextRequest) {
  const { profile, res } = await requireAdmin();
  if (!profile) return res;

  const body = (await request.json().catch(() => null)) as
    | { voucher_code?: string }
    | null;
  const code = (body?.voucher_code ?? '').trim();

  if (!code) {
    return NextResponse.json(
      { valid: false, error: 'Sila masukkan kod baucar.' },
      { status: 400 }
    );
  }

  // Baucar khas: sah, pintas gerbang pembayaran, diskaun 100%.
  if (code.toUpperCase() === BYPASS_VOUCHER_CODE) {
    return NextResponse.json({
      valid: true,
      code,
      discount_percent: 100,
      bypass_payment: true,
    });
  }

  // Semak jadual `vouchers` untuk kod berdaftar.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vouchers')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { valid: false, error: 'Kod baucar tidak sah.' },
      { status: 404 }
    );
  }

  const voucher = data as Record<string, unknown>;

  if (voucher.is_active === false) {
    return NextResponse.json(
      { valid: false, error: 'Baucar ini tidak lagi aktif.' },
      { status: 400 }
    );
  }
  const expiresAt = voucher.expires_at;
  if (typeof expiresAt === 'string' && new Date(expiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      { valid: false, error: 'Baucar ini telah tamat tempoh.' },
      { status: 400 }
    );
  }

  const discount = Number(voucher.discount_percent ?? voucher.discount ?? 0);
  return NextResponse.json({
    valid: true,
    code,
    discount_percent: Number.isFinite(discount) ? discount : 0,
    bypass_payment: false,
  });
}
