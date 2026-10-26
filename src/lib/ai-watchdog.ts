/**
 * Sistem "watchdog" AI untuk pemantauan ralat runtime.
 *
 * AMARAN: Modul ini hanya untuk kod pelayan (server-only). Ia membaca
 * rahsia persekitaran (DEEPSEEK_API_KEY, TELEGRAM_BOT_TOKEN) dan tidak
 * boleh diimport ke dalam Client Component.
 *
 * Prinsip utama: kegagalan watchdog TIDAK BOLEH mematikan proses hos.
 * Semua panggilan rangkaian dibalut dan tidak pernah dilemparkan semula.
 */

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const TELEGRAM_ENDPOINT = 'https://api.telegram.org';

/** Had masa setiap panggilan rangkaian (ms) supaya watchdog tidak tergantung. */
const REQUEST_TIMEOUT_MS = 12_000;

/** Had panjang mesej Telegram yang dibenarkan oleh API. */
const TELEGRAM_MAX_LENGTH = 4096;

interface WatchdogSummary {
  rootCause: string;
  actionRequired: string;
}

/**
 * Panggil `fetch` dengan had masa menggunakan AbortController.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Larikan teks bebas daripada aksara khas Markdown Telegram supaya
 * `parse_mode: 'Markdown'` tidak menyebabkan ralat 400.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*`[\]])/g, '\\$1');
}

/**
 * Serialisasi konteks dengan selamat (elak ralat objek bulat/circular).
 */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val as object)) return '[Circular]';
          seen.add(val as object);
        }
        return val;
      },
      2
    );
  } catch {
    return '[Konteks tidak dapat diserialisasi]';
  }
}

/**
 * Ringkaskan ralat melalui DeepSeek kepada dua perkara sahaja:
 * punca utama (root cause) dan tindakan diperlukan (action required).
 *
 * Jika DeepSeek gagal, pulangkan ringkasan sandaran daripada mesej ralat.
 */
async function summarizeError(
  error: Error,
  context: Record<string, any>
): Promise<WatchdogSummary> {
  const fallback: WatchdogSummary = {
    rootCause: error.message || 'Ralat tanpa mesej.',
    actionRequired: 'Siasat log pelayan untuk butiran lanjut.',
  };

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('[ai-watchdog] DEEPSEEK_API_KEY tidak ditetapkan; ringkasan AI dilangkau.');
    return fallback;
  }

  try {
    const response = await fetchWithTimeout(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content:
              'Anda juruteknik sistem kanan. Analisis ralat aplikasi dan balas TEPAT dua baris ' +
              'senarai bertitik seperti berikut, tanpa teks lain:\n' +
              '- Root Cause: <punca utama dalam satu ayat>\n' +
              '- Action Required: <tindakan pembetulan dalam satu ayat>',
          },
          {
            role: 'user',
            content:
              `Mesej ralat: ${error.message}\n\n` +
              `Stack trace:\n${error.stack ?? '(tiada stack trace)'}\n\n` +
              `Konteks:\n${safeStringify(context)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[ai-watchdog] DeepSeek gagal:', response.status, response.statusText);
      return fallback;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return fallback;

    const rootCauseMatch = content.match(/Root Cause:\s*([^\n]+)/i);
    const actionMatch = content.match(/Action Required:\s*([^\n]+)/i);

    return {
      rootCause: rootCauseMatch?.[1]?.trim() || fallback.rootCause,
      actionRequired: actionMatch?.[1]?.trim() || fallback.actionRequired,
    };
  } catch (err) {
    console.error('[ai-watchdog] Ralat semasa memanggil DeepSeek:', err);
    return fallback;
  }
}

/**
 * Hantar amaran Markdown ke Telegram.
 * Kegagalan di sini hanya direkodkan ke konsol.
 */
async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const missing = [!token && 'TELEGRAM_BOT_TOKEN', !chatId && 'TELEGRAM_CHAT_ID'].filter(
    (v): v is string => Boolean(v)
  );

  if (missing.length > 0) {
    console.error(
      `[ai-watchdog] Amaran Telegram dilangkau. Pemboleh ubah persekitaran yang hilang: ${missing.join(', ')}.`
    );
    return;
  }

  try {
    const response = await fetchWithTimeout(`${TELEGRAM_ENDPOINT}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        text: message.slice(0, TELEGRAM_MAX_LENGTH),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[ai-watchdog] Telegram gagal:', response.status, body);
    }
  } catch (err) {
    console.error('[ai-watchdog] Ralat semasa menghantar amaran Telegram:', err);
  }
}

/**
 * Lapor ralat sistem kepada penyelia melalui DeepSeek + Telegram.
 *
 * @param error   Ralat yang berlaku.
 * @param context Maklumat tambahan (tenant, pengguna, tindakan, dsb.).
 */
export async function notifyWatchdog(
  error: Error,
  context: Record<string, any>
): Promise<void> {
  try {
    const summary = await summarizeError(error, context);

    const message = [
      '*Digital Logbook — Ralat Sistem*',
      '',
      `*Root Cause:* ${escapeMarkdown(summary.rootCause)}`,
      `*Action Required:* ${escapeMarkdown(summary.actionRequired)}`,
      '',
      `*Masa:* ${new Date().toISOString()}`,
      `*Konteks:*`,
      '```',
      safeStringify(context).slice(0, 1500),
      '```',
    ].join('\n');

    await sendTelegramAlert(message);
  } catch (err) {
    // Jangan sekali-kali melemparkan ralat kepada pemanggil.
    console.error('[ai-watchdog] Kegagalan dalaman watchdog:', err);
  }
}
