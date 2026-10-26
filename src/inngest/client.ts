import { Inngest } from 'inngest';

/**
 * Klien Inngest global untuk aplikasi Digital Logbook PAPN.
 *
 * Mod operasi ditentukan secara automatik:
 * - `INNGEST_DEV=1` (atau URL Dev Server) → mod `dev`, tiada kunci diperlukan.
 * - `INNGEST_SIGNING_KEY` disediakan → mod `cloud` (pengeluaran).
 *
 * Tanpa salah satu di atas, SDK berada dalam mod `cloud` tanpa kunci tandatangan
 * dan setiap permintaan ke `/api/inngest` akan gagal dengan
 * `{"code":"internal_server_error"}` (HTTP 500).
 */
const isDevMode =
  process.env.INNGEST_DEV === '1' ||
  process.env.INNGEST_DEV === 'true' ||
  Boolean(process.env.INNGEST_DEV?.startsWith('http'));

export const inngest = new Inngest({
  id: 'digital-logbook-papn',
  ...(isDevMode ? { isDev: true } : {}),
});
