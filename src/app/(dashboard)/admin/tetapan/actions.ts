'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import type { CenterSettings } from '@/lib/types';

/** Baldi storan aset pusat (kepala surat & logo). */
const BUCKET = 'center-assets';
/** Had saiz fail imej (2 MB). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Peta MIME yang dibenarkan → sambungan fail. */
const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
/** Kod ralat PostgreSQL bagi pelanggaran kekangan unik. */
const UNIQUE_VIOLATION = '23505';

export interface CenterSettingsInput {
  center_name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  academic_year: string;
}

export interface CalendarEntryInput {
  /** Tarikh ISO `YYYY-MM-DD`. */
  date: string;
  event_name: string;
  is_holiday: boolean;
}

/**
 * Bentuk hasil piawai bagi semua tindakan pelayan Tetapan PAPN.
 * `success: true` membawa `data`; `success: false` membawa `error`.
 */
export interface SettingsActionResult<TData = null> {
  success: boolean;
  data?: TData;
  error?: string;
}

/** Muatan hasil muat naik imej ke baldi `center-assets`. */
export interface UploadedImage {
  /** URL awam imej yang baru dimuat naik. */
  url: string;
}

/** Rujukan ringkas kepada baris `center_settings` tenant semasa. */
interface SettingsRowRef {
  id: string;
  letterhead_url: string | null;
  logo_url: string | null;
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

/** Buang rentetan kosong menjadi null. */
function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

/** Sahkan tarikh ISO `YYYY-MM-DD` yang benar-benar wujud. */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

/** Ekstrak laluan objek daripada URL awam baldi `center-assets`. */
function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

/**
 * Pastikan baris `center_settings` wujud bagi tenant semasa.
 * Jika belum ada, baris lalai dicipta secara automatik supaya muat naik
 * imej tidak tersekat oleh pengawal UI. `center_name` ialah lajur NOT NULL,
 * jadi nama pusat diambil daripada jadual `tenants`.
 */
async function ensureSettingsRow(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string
): Promise<{ row: SettingsRowRef | null; error: string | null }> {
  const { data: existing, error: readError } = await admin
    .from('center_settings')
    .select('id, letterhead_url, logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (readError) {
    return { row: null, error: `Gagal membaca tetapan pusat: ${readError.message}` };
  }
  if (existing) {
    return { row: existing as SettingsRowRef, error: null };
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, app_name')
    .eq('id', tenantId)
    .maybeSingle();

  const tenantRow = tenant as { name?: string | null; app_name?: string | null } | null;
  const defaultName =
    emptyToNull(tenantRow?.app_name) ??
    emptyToNull(tenantRow?.name) ??
    'Pusat Anak PERMATA Negara';

  // `ignoreDuplicates` mengelakkan penulisan semula nama pusat jika baris
  // dicipta serentak oleh permintaan lain.
  const { error: provisionError } = await admin
    .from('center_settings')
    .upsert(
      { tenant_id: tenantId, center_name: defaultName },
      { onConflict: 'tenant_id', ignoreDuplicates: true }
    );

  if (provisionError) {
    return { row: null, error: `Gagal mencipta tetapan pusat: ${provisionError.message}` };
  }

  const { data: created, error: createdError } = await admin
    .from('center_settings')
    .select('id, letterhead_url, logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (createdError) {
    return { row: null, error: `Gagal membaca tetapan pusat: ${createdError.message}` };
  }
  if (!created) {
    return { row: null, error: 'Gagal mencipta tetapan pusat untuk tenant anda.' };
  }
  return { row: created as SettingsRowRef, error: null };
}

/** Simpan (atau kemas kini) metadata rasmi pusat bagi tenant semasa. */
export async function saveCenterSettings(
  input: CenterSettingsInput
): Promise<SettingsActionResult<CenterSettings>> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  const centerName = input.center_name.trim();
  if (!centerName) {
    return { success: false, error: 'Nama pusat wajib diisi.' };
  }

  const email = emptyToNull(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Format e-mel tidak sah.' };
  }

  const admin = createAdminClient();

  try {
    // `tenant_id` ialah kunci konflik: satu baris tetapan bagi setiap tenant.
    const { data, error: upsertError } = await admin
      .from('center_settings')
      .upsert(
        {
          tenant_id: profile.tenant_id,
          center_name: centerName,
          code: emptyToNull(input.code),
          address: emptyToNull(input.address),
          phone: emptyToNull(input.phone),
          email,
          academic_year: emptyToNull(input.academic_year),
        },
        { onConflict: 'tenant_id' }
      )
      .select(
        'id, tenant_id, center_name, code, address, phone, email, academic_year, letterhead_url, logo_url, updated_at'
      )
      .single();

    if (upsertError) {
      return {
        success: false,
        error: `Gagal menyimpan tetapan pusat: ${upsertError.message}`,
      };
    }
    if (!data) {
      return {
        success: false,
        error: 'Gagal menyimpan tetapan pusat: tiada data dikembalikan.',
      };
    }

    revalidatePath('/admin/tetapan');
    return { success: true, data: data as CenterSettings };
  } catch (unexpected) {
    return {
      success: false,
      error: `Gagal menyimpan tetapan pusat: ${
        unexpected instanceof Error ? unexpected.message : 'ralat tidak diketahui'
      }`,
    };
  }
}

/**
 * Muat naik imej kepala surat ke baldi `center-assets`.
 * Laluan sentiasa bermula dengan `tenant_id` supaya dasar storan dapat
 * mengasingkan fail antara tenant.
 */
export async function uploadLetterhead(
  formData: FormData
): Promise<SettingsActionResult<UploadedImage>> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Sila pilih fail imej kepala surat.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      success: false,
      error: 'Saiz imej melebihi 2 MB. Sila kecilkan fail terlebih dahulu.',
    };
  }

  const extension = ALLOWED_IMAGE_MIME[file.type];
  if (!extension) {
    return {
      success: false,
      error: 'Format imej tidak disokong. Gunakan PNG, JPEG atau WEBP.',
    };
  }

  const admin = createAdminClient();
  // Cipta baris tetapan lalai jika belum wujud — muat naik tidak disekat.
  const ensured = await ensureSettingsRow(admin, profile.tenant_id);
  if (!ensured.row) {
    return { success: false, error: ensured.error ?? 'Gagal menyediakan tetapan pusat.' };
  }
  const existing = ensured.row;

  const path = `${profile.tenant_id}/letterhead-${Date.now()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    return {
      success: false,
      error: `Gagal memuat naik kepala surat: ${uploadError.message}`,
    };
  }

  const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  const { error: updateError } = await admin
    .from('center_settings')
    .update({ letterhead_url: publicUrl })
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    // Jangan tinggalkan fail yatim jika pautan gagal disimpan.
    await admin.storage.from(BUCKET).remove([path]);
    return {
      success: false,
      error: `Gagal menyimpan pautan kepala surat: ${updateError.message}`,
    };
  }

  // Buang imej lama supaya baldi tidak membesar tanpa kawalan.
  const previousPath = storagePathFromUrl(existing.letterhead_url);
  if (previousPath && previousPath !== path) {
    await admin.storage.from(BUCKET).remove([previousPath]);
  }

  revalidatePath('/admin/tetapan');
  return { success: true, data: { url: publicUrl } };
}

/** Buang imej kepala surat daripada baldi dan kosongkan pautannya. */
export async function removeLetterhead(): Promise<SettingsActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  const admin = createAdminClient();
  const { data: existingData, error: readError } = await admin
    .from('center_settings')
    .select('id, letterhead_url')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle();

  if (readError) {
    return { success: false, error: `Gagal membaca tetapan pusat: ${readError.message}` };
  }

  const existing = existingData as SettingsRowRef | null;
  if (!existing) {
    return { success: true };
  }

  const path = storagePathFromUrl(existing.letterhead_url);
  if (path) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove([path]);
    if (removeError) {
      return {
        success: false,
        error: `Gagal membuang imej kepala surat: ${removeError.message}`,
      };
    }
  }

  const { error: updateError } = await admin
    .from('center_settings')
    .update({ letterhead_url: null })
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return { success: false, error: `Gagal mengemas kini tetapan pusat: ${updateError.message}` };
  }

  revalidatePath('/admin/tetapan');
  return { success: true };
}

/**
 * Muat naik logo pusat / ikon aplikasi ke baldi `center-assets`.
 * Laluan bermula dengan `tenant_id` supaya dasar storan mengasingkan tenant.
 */
export async function uploadLogo(
  formData: FormData
): Promise<SettingsActionResult<UploadedImage>> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Sila pilih fail imej logo pusat.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      success: false,
      error: 'Saiz imej melebihi 2 MB. Sila kecilkan fail terlebih dahulu.',
    };
  }

  const extension = ALLOWED_IMAGE_MIME[file.type];
  if (!extension) {
    return {
      success: false,
      error: 'Format imej tidak disokong. Gunakan PNG, JPEG atau WEBP.',
    };
  }

  const admin = createAdminClient();
  // Cipta baris tetapan lalai jika belum wujud — muat naik tidak disekat.
  const ensured = await ensureSettingsRow(admin, profile.tenant_id);
  if (!ensured.row) {
    return { success: false, error: ensured.error ?? 'Gagal menyediakan tetapan pusat.' };
  }
  const existing = ensured.row;

  const path = `${profile.tenant_id}/logo-${Date.now()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    return {
      success: false,
      error: `Gagal memuat naik logo: ${uploadError.message}`,
    };
  }

  const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  const { error: updateError } = await admin
    .from('center_settings')
    .update({ logo_url: publicUrl })
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    // Jangan tinggalkan fail yatim jika pautan gagal disimpan.
    await admin.storage.from(BUCKET).remove([path]);
    return {
      success: false,
      error: `Gagal menyimpan pautan logo: ${updateError.message}`,
    };
  }

  // Buang imej lama supaya baldi tidak membesar tanpa kawalan.
  const previousPath = storagePathFromUrl(existing.logo_url);
  if (previousPath && previousPath !== path) {
    await admin.storage.from(BUCKET).remove([previousPath]);
  }

  revalidatePath('/admin/tetapan');
  // Logo digunakan oleh bar sisi/pengepala — segarkan susun atur bersama.
  revalidatePath('/', 'layout');
  return { success: true, data: { url: publicUrl } };
}

/** Buang logo pusat daripada baldi dan kosongkan pautannya. */
export async function removeLogo(): Promise<SettingsActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  const admin = createAdminClient();
  const { data: existingData, error: readError } = await admin
    .from('center_settings')
    .select('id, logo_url')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle();

  if (readError) {
    return { success: false, error: `Gagal membaca tetapan pusat: ${readError.message}` };
  }

  const existing = existingData as SettingsRowRef | null;
  if (!existing) {
    return { success: true };
  }

  const path = storagePathFromUrl(existing.logo_url);
  if (path) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove([path]);
    if (removeError) {
      return { success: false, error: `Gagal membuang logo: ${removeError.message}` };
    }
  }

  const { error: updateError } = await admin
    .from('center_settings')
    .update({ logo_url: null })
    .eq('tenant_id', profile.tenant_id);

  if (updateError) {
    return { success: false, error: `Gagal mengemas kini tetapan pusat: ${updateError.message}` };
  }

  revalidatePath('/admin/tetapan');
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Tambah satu catatan takwim akademik bagi tenant semasa. */
export async function createCalendarEntry(
  input: CalendarEntryInput
): Promise<SettingsActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  if (!isValidIsoDate(input.date)) {
    return { success: false, error: 'Tarikh tidak sah.' };
  }

  const eventName = input.event_name.trim();
  if (!eventName) {
    return { success: false, error: 'Nama acara wajib diisi.' };
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from('academic_calendar').insert({
    tenant_id: profile.tenant_id,
    date: input.date,
    event_name: eventName,
    is_holiday: input.is_holiday,
  });

  if (insertError) {
    return {
      success: false,
      error:
        insertError.code === UNIQUE_VIOLATION
          ? 'Catatan bagi tarikh dan nama acara ini sudah wujud.'
          : `Gagal menyimpan catatan takwim: ${insertError.message}`,
    };
  }

  revalidatePath('/admin/tetapan');
  return { success: true };
}

/** Kemas kini catatan takwim akademik milik tenant semasa. */
export async function updateCalendarEntry(
  id: string,
  input: CalendarEntryInput
): Promise<SettingsActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  if (!isValidIsoDate(input.date)) {
    return { success: false, error: 'Tarikh tidak sah.' };
  }

  const eventName = input.event_name.trim();
  if (!eventName) {
    return { success: false, error: 'Nama acara wajib diisi.' };
  }

  const admin = createAdminClient();
  const { data, error: updateError } = await admin
    .from('academic_calendar')
    .update({
      date: input.date,
      event_name: eventName,
      is_holiday: input.is_holiday,
    })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select('id');

  if (updateError) {
    return {
      success: false,
      error:
        updateError.code === UNIQUE_VIOLATION
          ? 'Catatan bagi tarikh dan nama acara ini sudah wujud.'
          : `Gagal mengemas kini catatan takwim: ${updateError.message}`,
    };
  }

  if (!data || data.length === 0) {
    return { success: false, error: 'Catatan takwim tidak dijumpai untuk pusat anda.' };
  }

  revalidatePath('/admin/tetapan');
  return { success: true };
}

/** Hapus catatan takwim akademik milik tenant semasa. */
export async function deleteCalendarEntry(id: string): Promise<SettingsActionResult> {
  const { profile, error } = await requireAdmin();
  if (!profile) return { success: false, error: error ?? 'Anda tiada kebenaran.' };

  const admin = createAdminClient();
  const { data, error: deleteError } = await admin
    .from('academic_calendar')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select('id');

  if (deleteError) {
    return { success: false, error: `Gagal memadam catatan takwim: ${deleteError.message}` };
  }

  if (!data || data.length === 0) {
    return { success: false, error: 'Catatan takwim tidak dijumpai untuk pusat anda.' };
  }

  revalidatePath('/admin/tetapan');
  return { success: true };
}
