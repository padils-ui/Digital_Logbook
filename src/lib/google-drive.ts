import { google, type drive_v3 } from 'googleapis';

/**
 * Utiliti Google Drive untuk penyediaan folder tenant.
 *
 * AMARAN: Modul ini hanya untuk kod pelayan (server-only). Ia menggunakan
 * kredensial akaun perkhidmatan (service account) dan tidak boleh diimport
 * ke dalam Client Component.
 */

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

/** Nama subfolder tetap di bawah folder root tenant. */
export const LOG_HARIAN_FOLDER_NAME = '01Log harian';

/** Nama folder root bagi setiap tenant. */
export function tenantRootFolderName(tenantName: string): string {
  return `[${tenantName}]`;
}

/**
 * Bina klien Drive yang disahkan menggunakan kredensial akaun perkhidmatan
 * daripada pemboleh ubah persekitaran.
 */
function getDriveClient(): drive_v3.Drive {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Kunci persendirian disimpan dengan `\n` literal dalam ENV — tukar semula.
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY diperlukan untuk Google Drive.'
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_SCOPES,
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Cipta folder baharu dan pulangkan ID-nya.
 * Jika folder dengan nama sama sudah wujud dalam parent yang sama, gunakan
 * semula folder tersebut (elak pertindihan).
 */
async function findOrCreateFolder(
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
  });

  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });

  const id = created.data.id;
  if (!id) {
    throw new Error(`Gagal mencipta folder Google Drive: ${name}`);
  }
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
