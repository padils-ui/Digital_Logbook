import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';

/**
 * Utiliti Google Drive untuk penyediaan folder tenant.
 *
 * AMARAN: Modul ini hanya untuk kod pelayan (server-only). Ia menggunakan
 * kredensial OAuth2 dan tidak boleh diimport ke dalam Client Component.
 */

/** Nama subfolder tetap di bawah folder root tenant. */
export const LOG_HARIAN_FOLDER_NAME = '01Log harian';

/** Nama folder peringkat pertama di bawah folder root (laluan log harian). */
export const LOG_HARIAN_ROOT_FOLDER_NAME = '01logharian';

/** Nama folder peringkat kedua di bawah folder root (laluan log harian). */
export const LOG_HARIAN_SUBFOLDER_NAME = '01 log harian';

/** Nama folder root bagi setiap tenant. */
export function tenantRootFolderName(tenantName: string): string {
  return `[${tenantName}]`;
}

/**
 * Bina klien Drive yang disahkan menggunakan OAuth2 (refresh token).
 *
 * Kredensial dibaca daripada pemboleh ubah persekitaran:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */
export function getDriveClient(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const missing = [
    !clientId && 'GOOGLE_CLIENT_ID',
    !clientSecret && 'GOOGLE_CLIENT_SECRET',
    !refreshToken && 'GOOGLE_REFRESH_TOKEN',
  ].filter((v): v is string => Boolean(v));

  if (missing.length > 0) {
    throw new Error(
      `Kredensial OAuth2 Google Drive tidak lengkap. Pemboleh ubah persekitaran yang hilang: ${missing.join(', ')}.`
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Cipta folder baharu dan pulangkan ID-nya.
 * Jika folder dengan nama sama sudah wujud dalam parent yang sama, gunakan
 * semula folder tersebut (elak pertindihan).
 */
export async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'");
  const queryParts = [
    `name = '${escapedName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ];
  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const existing = await drive.files.list({
    q: queryParts.join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1,
    supportsAllDrives: true,
    supportsTeamDrives: true,
    includeItemsFromAllDrives: true,
  });

  const found = existing.data.files?.[0]?.id;
  if (found) {
    console.log('[google-drive] Folder sedia ada digunakan semula:', {
      name,
      parentId: parentId ?? null,
      folderId: found,
    });
    return found;
  }

  console.log('[google-drive] Mencipta folder baharu:', {
    name,
    parentId: parentId ?? null,
  });

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
    supportsAllDrives: true,
    supportsTeamDrives: true,
  });

  const id = created.data.id;
  if (!id) {
    throw new Error(`Gagal mencipta folder Google Drive: ${name}`);
  }

  console.log('[google-drive] Folder baharu dicipta:', {
    name,
    parentId: parentId ?? null,
    folderId: id,
  });
  return id;
}

export interface ProvisionedTenantDrive {
  rootFolderId: string;
  logHarianFolderId: string;
}

/**
 * Sediakan struktur folder Drive untuk tenant baharu:
 *   [tenantName] / 01Log harian
 * dan kongsi folder root dengan emel sasaran sebagai penulis.
 */
export async function provisionTenantDriveFolders(
  tenantName: string,
  targetEmail: string
): Promise<ProvisionedTenantDrive> {
  const drive = getDriveClient();

  const rootFolderId = await findOrCreateFolder(
    drive,
    tenantRootFolderName(tenantName)
  );
  const logHarianFolderId = await findOrCreateFolder(
    drive,
    LOG_HARIAN_FOLDER_NAME,
    rootFolderId
  );

  // Kongsi folder root dengan emel sasaran (akses penulis).
  await drive.permissions.create({
    fileId: rootFolderId,
    sendNotificationEmail: false,
    supportsAllDrives: true,
    supportsTeamDrives: true,
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: targetEmail,
    },
  });

  return { rootFolderId, logHarianFolderId };
}

export interface StudentDriveFolderInput {
  tenantId: string;
  logHarianFolderId: string;
  year: number | string;
  monthName: string;
  className: string;
  studentName: string;
}

/**
 * Dapatkan (atau cipta) folder murid mengikut laluan:
 *   01Log harian -> [Year] -> [Month] -> [Class] -> [Student]
 * dan pulangkan ID folder murid.
 */
export async function getOrCreateStudentDriveFolder({
  logHarianFolderId,
  year,
  monthName,
  className,
  studentName,
}: StudentDriveFolderInput): Promise<string> {
  const drive = getDriveClient();

  const yearFolderId = await findOrCreateFolder(
    drive,
    String(year),
    logHarianFolderId
  );
  const monthFolderId = await findOrCreateFolder(drive, monthName, yearFolderId);
  const classFolderId = await findOrCreateFolder(
    drive,
    className,
    monthFolderId
  );
  const studentFolderId = await findOrCreateFolder(
    drive,
    studentName,
    classFolderId
  );

  return studentFolderId;
}

export interface UploadFileInput {
  /** ID folder sasaran dalam Google Drive. */
  folderId: string;
  /** Nama fail yang akan dipaparkan dalam Drive. */
  fileName: string;
  /** Jenis MIME fail (cth. image/jpeg, application/pdf). */
  mimeType: string;
  /** Kandungan fail sebagai buffer. */
  buffer: Buffer;
}

/**
 * Muat naik satu fail ke folder Drive yang ditentukan.
 * Pulangkan ID fail yang dicipta.
 */
export async function uploadFileToDrive({
  folderId,
  fileName,
  mimeType,
  buffer,
}: UploadFileInput): Promise<string> {
  const drive = getDriveClient();

  console.log('[google-drive] Memuat naik fail:', {
    fileName,
    mimeType,
    bytes: buffer.length,
    folderId,
  });

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
    supportsAllDrives: true,
    supportsTeamDrives: true,
  });

  const id = created.data.id;
  if (!id) {
    throw new Error(`Gagal memuat naik fail ke Google Drive: ${fileName}`);
  }

  console.log('[google-drive] Fail berjaya dimuat naik:', {
    fileName,
    fileId: id,
    folderId,
  });
  return id;
}

/** Bina pautan terus ke folder Google Drive. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Muat turun kandungan fail Drive sebagai buffer.
 * Pulangkan `null` jika fail tidak dijumpai atau muat turun gagal.
 */
export async function downloadFileFromDrive(
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    });
    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(response.data as ArrayBuffer);
    return {
      buffer,
      mimeType: meta.data.mimeType ?? 'image/jpeg',
    };
  } catch (error) {
    console.error('[google-drive] Gagal memuat turun fail:', { fileId, error });
    return null;
  }
}

/**
 * Muat naik fail ke folder Drive, menimpa fail sedia ada dengan nama yang sama.
 *
 * Jika fail dengan `fileName` yang sama sudah wujud dalam `folderId`, kandungannya
 * dikemas kini melalui `files.update` (elak pertindihan). Jika tidak, fail baharu
 * dicipta melalui `files.create`. Pulangkan ID fail.
 */
export async function upsertFileToDrive({
  folderId,
  fileName,
  mimeType,
  buffer,
}: UploadFileInput): Promise<string> {
  const drive = getDriveClient();

  const escapedName = fileName.replace(/'/g, "\\'");
  const existing = await drive.files.list({
    q: [
      `name = '${escapedName}'`,
      `'${folderId}' in parents`,
      'trashed = false',
    ].join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1,
    supportsAllDrives: true,
    supportsTeamDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;

  if (existingId) {
    console.log('[google-drive] Fail sedia ada ditimpa:', {
      fileName,
      fileId: existingId,
      folderId,
    });
    await drive.files.update({
      fileId: existingId,
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
      supportsTeamDrives: true,
    });
    return existingId;
  }

  console.log('[google-drive] Fail baharu dicipta:', {
    fileName,
    folderId,
    bytes: buffer.length,
  });
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
    supportsAllDrives: true,
    supportsTeamDrives: true,
  });

  const id = created.data.id;
  if (!id) {
    throw new Error(`Gagal memuat naik fail ke Google Drive: ${fileName}`);
  }
  return id;
}
