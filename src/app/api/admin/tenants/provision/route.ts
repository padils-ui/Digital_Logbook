import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  provisionTenantDriveFolders,
  LOG_HARIAN_FOLDER_NAME,
} from '@/lib/google-drive';

export const runtime = 'nodejs';

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

interface ProvisionBody {
  name?: string;
  admin_email?: string;
  google_drive_email?: string;
  voucher_code?: string;
  student_limit?: number;
}

/** Kod baucar khas yang memintas pengesahan gerbang pembayaran. */
const BYPASS_VOUCHER_CODE = 'PAPN100';

interface VoucherValidation {
  valid: boolean;
  /** Diskaun dalam peratus (0–100). */
  discountPercent: number;
  /** Benar jika gerbang pembayaran dipintas sepenuhnya. */
  bypassPayment: boolean;
  error?: string;
}

/**
 * Sahkan kod baucar.
 *
 * 1. 'PAPN100' sentiasa sah — memintas gerbang pembayaran, diskaun 100%.
 * 2. Selain itu, semak jadual `vouchers` (jika wujud) untuk kod yang sah.
 */
async function validateVoucher(
  admin: ReturnType<typeof createAdminClient>,
  code: string
): Promise<VoucherValidation> {
  if (!code) {
    return { valid: false, discountPercent: 0, bypassPayment: false, error: 'Kod baucar diperlukan.' };
  }

  // Baucar khas: pintas gerbang pembayaran.
  if (code.toUpperCase() === BYPASS_VOUCHER_CODE) {
    return { valid: true, discountPercent: 100, bypassPayment: true };
  }

  // Semak jadual `vouchers` untuk kod berdaftar.
  const { data, error } = await admin
    .from('vouchers')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    return { valid: false, discountPercent: 0, bypassPayment: false, error: 'Kod baucar tidak sah.' };
  }
  if (!data) {
    return { valid: false, discountPercent: 0, bypassPayment: false, error: 'Kod baucar tidak sah.' };
  }

  const voucher = data as Record<string, unknown>;

  // Tolak baucar yang tidak aktif atau telah tamat tempoh.
  if (voucher.is_active === false) {
    return { valid: false, discountPercent: 0, bypassPayment: false, error: 'Baucar ini tidak lagi aktif.' };
  }
  const expiresAt = voucher.expires_at;
  if (typeof expiresAt === 'string' && new Date(expiresAt).getTime() < Date.now()) {
    return { valid: false, discountPercent: 0, bypassPayment: false, error: 'Baucar ini telah tamat tempoh.' };
  }

  const discount = Number(voucher.discount_percent ?? voucher.discount ?? 0);
  return {
    valid: true,
    discountPercent: Number.isFinite(discount) ? discount : 0,
    bypassPayment: false,
  };
}

/**
 * POST — sediakan tenant baharu: cipta folder Google Drive, kongsi dengan
 * emel sasaran, dan simpan rekod tenant dalam Supabase.
 */
export async function POST(request: NextRequest) {
  const { profile, res } = await requireAdmin();
  if (!profile) return res;

  const body = (await request.json().catch(() => null)) as ProvisionBody | null;

  const name = (body?.name ?? '').trim();
  const adminEmail = (body?.admin_email ?? '').trim();
  const googleDriveEmail = (body?.google_drive_email ?? '').trim();
  const voucherCode = (body?.voucher_code ?? '').trim();
  const studentLimit = Number(body?.student_limit);

  if (!name) {
    return NextResponse.json({ error: 'Nama pusat diperlukan.' }, { status: 400 });
  }
  if (!adminEmail) {
    return NextResponse.json({ error: 'Emel pentadbir diperlukan.' }, { status: 400 });
  }
  if (!googleDriveEmail) {
    return NextResponse.json(
      { error: 'Emel Google Drive diperlukan.' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(studentLimit) || studentLimit < 1) {
    return NextResponse.json(
      { error: 'Had anak mesti nombor bulat positif.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1. Sahkan baucar (jika ada). Baucar PAPN100 memintas gerbang pembayaran.
  const voucher = await validateVoucher(admin, voucherCode);
  if (voucherCode && !voucher.valid) {
    return NextResponse.json(
      { error: voucher.error ?? 'Kod baucar tidak sah.' },
      { status: 400 }
    );
  }

  // 2. Sediakan folder Google Drive untuk tenant.
  let rootFolderId: string;
  let logHarianFolderId: string;
  try {
    const provisioned = await provisionTenantDriveFolders(name, googleDriveEmail);
    rootFolderId = provisioned.rootFolderId;
    logHarianFolderId = provisioned.logHarianFolderId;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ralat tidak diketahui.';
    return NextResponse.json(
      { error: `Gagal menyediakan Google Drive: ${message}` },
      { status: 502 }
    );
  }

  // 3. Simpan rekod tenant dalam Supabase.
  const { data, error } = await admin
    .from('tenants')
    .insert({
      name,
      code: voucherCode || null,
      google_drive_email: googleDriveEmail,
      google_drive_folder_id: rootFolderId,
      google_drive_subfolders: { log_harian: logHarianFolderId },
      google_drive_status: 'provisioned',
      status: 'active',
      student_limit: studentLimit,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      tenant: data,
      google_drive_folder_id: rootFolderId,
      google_drive_subfolders: { [LOG_HARIAN_FOLDER_NAME]: logHarianFolderId },
      voucher: {
        code: voucherCode || null,
        discount_percent: voucher.discountPercent,
        bypass_payment: voucher.bypassPayment,
      },
    },
    { status: 201 }
  );
}
