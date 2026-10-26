import { createAdminClient } from '@/lib/supabase/admin';
import { notifyWatchdog } from '@/lib/ai-watchdog';
import { AssessmentSchema, type AssessmentData } from '@/lib/validations/assessment';
import type { DailyLogRow } from '@/types/logbook';

/**
 * Enjin penjanaan Laporan Pentaksiran Mingguan (PERMATA).
 *
 * AMARAN: Modul ini hanya untuk kod pelayan (server-only). Ia menggunakan
 * klien service role (memintas RLS) dan kunci DeepSeek.
 *
 * Setiap pertanyaan pangkalan data WAJIB disekat dengan `tenant_id` kerana
 * klien service role tidak tertakluk kepada RLS.
 */

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

/** Had masa panggilan AI (ms). Penjanaan laporan lebih lama daripada watchdog. */
const REQUEST_TIMEOUT_MS = 60_000;

/** Selang log denyut nadi semasa menunggu DeepSeek (ms). */
const HEARTBEAT_INTERVAL_MS = 5_000;

const LOG_PREFIX = '[pentaksiran]';

/**
 * Log kemajuan berperingkat.
 *
 * Setiap peringkat dicetak serta-merta ke stdout pelayan supaya proses yang
 * berjalan lama (panggilan DeepSeek) kelihatan hidup dan titik kegagalan dapat
 * dikenal pasti daripada log terminal.
 */
function logProgress(
  stage: string,
  startedAt: number,
  detail?: Record<string, unknown>
): void {
  const suffix = detail ? ` ${JSON.stringify(detail)}` : '';
  console.log(`${LOG_PREFIX} ${stage} (+${Date.now() - startedAt}ms)${suffix}`);
}

/** Medan teks log yang relevan untuk pentaksiran. */
const LOG_TEXT_FIELDS = [
  'aktiviti_bebas',
  'penglibatan_bebas',
  'aktiviti_luar',
  'penglibatan_luar',
  'aktiviti_permata',
  'penglibatan_permata',
  'tingkah_laku',
  'kemalangan',
  'kecederaan',
  'kesihatan',
] as const;

const SYSTEM_PROMPT = [
  "You are an early childhood assessor under Malaysia's Kurikulum PERMATA.",
  'Analyze the weekly daily logs. For each domain score (0-100), you MUST cite evidence from the logs.',
  "If no logs exist for a domain, score it as null and state 'Tiada data minggu ini' in the summary.",
  '',
  'Balas HANYA dengan satu objek JSON yang sah, tanpa teks tambahan dan tanpa blok kod Markdown,',
  'mengikut bentuk tepat berikut:',
  '{',
  '  "domain_scores": {',
  '    "fizikal": <number 0-100 | null>,',
  '    "bahasa": <number 0-100 | null>,',
  '    "sahsiah": <number 0-100 | null>,',
  '    "awal_matematik": <number 0-100 | null>,',
  '    "deria": <number 0-100 | null>,',
  '    "kreativiti": <number 0-100 | null>',
  '  },',
  '  "summary": "<ringkasan perkembangan mingguan dalam Bahasa Melayu>",',
  '  "suggestions_next_week": ["<cadangan>", "..."],',
  '  "red_flags": [',
  '    { "severity": "LOW | MEDIUM | HIGH", "flag": "<pemerhatian>", "recommendation": "<tindakan>" }',
  '  ]',
  '}',
  'Jika tiada isu berisiko, pulangkan "red_flags": [].',
].join('\n');

export interface GenerateStudentWeeklyAssessmentParams {
  tenantId: string;
  studentId: string;
  year: number;
  weekNumber: number;
  /** Tarikh mula (YYYY-MM-DD), biasanya hari Isnin. */
  startDate: string;
  /** Tarikh akhir (YYYY-MM-DD), biasanya hari Jumaat. */
  endDate: string;
  /**
   * Tarikh cuti umum / penutupan pusat (YYYY-MM-DD). Log pada tarikh ini
   * dilangkau kerana pusat tidak beroperasi.
   */
  holidayDates?: string[];
}

export interface GenerateStudentWeeklyAssessmentResult {
  reportId: string;
  assessment: AssessmentData;
  logCount: number;
}

/** Semak sama ada tarikh ISO jatuh pada hari bekerja (Isnin–Jumaat). */
function isWeekday(isoDate: string): boolean {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Hari persekolahan = hari bekerja DAN bukan cuti umum / penutupan pusat.
 * Tarikh cuti datang daripada `academic_calendar.is_holiday`.
 */
function isSchoolDay(isoDate: string, holidays: ReadonlySet<string>): boolean {
  return isWeekday(isoDate) && !holidays.has(isoDate.slice(0, 10));
}

/** Ringkaskan satu baris log kepada teks padat untuk prompt. */
function formatLogForPrompt(log: DailyLogRow): string {
  const parts: string[] = [`${log.log_date} | ${log.category}`];

  for (const field of LOG_TEXT_FIELDS) {
    const value = log[field];
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${field}: ${value.trim()}`);
    }
  }

  if (log.content && Object.keys(log.content).length > 0) {
    parts.push(`content: ${JSON.stringify(log.content).slice(0, 600)}`);
  }

  return parts.join(' | ');
}

/** Panggil DeepSeek dengan had masa dan log denyut nadi. */
async function callDeepSeek(userPrompt: string, startedAt: number): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY tidak ditetapkan. Penjanaan pentaksiran tidak boleh diteruskan.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Denyut nadi setiap 5s — membuktikan sambungan masih hidup semasa menunggu.
  const heartbeat = setInterval(() => {
    logProgress('ai_request:menunggu', startedAt);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    logProgress('ai_request:hantar', startedAt, { promptChars: userPrompt.length });

    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`DeepSeek gagal (${response.status}): ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('DeepSeek memulangkan respons kosong.');
    }

    logProgress('ai_request:selesai', startedAt, { responseChars: content.length });
    return content;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`DeepSeek tidak menyahut dalam ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timer);
  }
}

/** Buang blok kod Markdown jika model menambahnya. */
function stripCodeFence(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * Janaan laporan pentaksiran mingguan bagi seorang anak.
 *
 * Aliran: query log → prompt DeepSeek → sahkan dengan zod → upsert DRAFT.
 * Sebarang kegagalan dilaporkan melalui `notifyWatchdog` dan dilemparkan
 * semula supaya pemanggil (cron) boleh merekod kegagalan tersebut.
 */
export async function generateStudentWeeklyAssessment({
  tenantId,
  studentId,
  year,
  weekNumber,
  startDate,
  endDate,
  holidayDates,
}: GenerateStudentWeeklyAssessmentParams): Promise<GenerateStudentWeeklyAssessmentResult> {
  let stage = 'init';
  let logCount = 0;
  const startedAt = Date.now();

  logProgress('mula', startedAt, { tenantId, studentId, year, weekNumber, startDate, endDate });

  try {
    if (endDate < startDate) {
      throw new Error(`Tarikh akhir (${endDate}) lebih awal daripada tarikh mula (${startDate}).`);
    }

    const supabase = createAdminClient();

    // ── 1. Ambil log harian minggu berkenaan (Isnin–Jumaat) ──
    stage = 'query_logs';
    logProgress('query_logs', startedAt);
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: true });

    if (error) {
      throw new Error(`Gagal membaca daily_logs: ${error.message}`);
    }

    const holidays = new Set((holidayDates ?? []).map((date) => date.slice(0, 10)));
    const logs = ((data ?? []) as DailyLogRow[]).filter((log) =>
      isSchoolDay(log.log_date, holidays)
    );
    logCount = logs.length;
    logProgress('logs_loaded', startedAt, {
      rows: data?.length ?? 0,
      schoolDays: logCount,
      holidays: holidays.size,
    });

    const logSection = logs.length
      ? logs.map((log) => `- ${formatLogForPrompt(log)}`).join('\n')
      : 'TIADA LOG HARIAN bagi minggu ini. Semua domain hendaklah null.';

    const userPrompt = [
      `Minggu: ${weekNumber}, Tahun: ${year}`,
      `Tarikh: ${startDate} hingga ${endDate}`,
      `Bilangan log: ${logs.length}`,
      '',
      'Log harian:',
      logSection,
      '',
      'Nilaikan enam domain PERMATA berdasarkan bukti di atas.',
    ].join('\n');

    // ── 2. Janaan AI ────────────────────────────────────────
    stage = 'ai_request';
    logProgress('ai_request', startedAt);
    const raw = await callDeepSeek(userPrompt, startedAt);

    // ── 3. Pengesahan runtime (zod) ─────────────────────────
    stage = 'validate_response';
    logProgress('validate_response', startedAt);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripCodeFence(raw));
    } catch {
      throw new Error(`Respons DeepSeek bukan JSON yang sah: ${raw.slice(0, 300)}`);
    }

    const assessment = AssessmentSchema.parse(parsedJson);
    logProgress('response_valid', startedAt);

    // ── 4. Upsert draf laporan ──────────────────────────────
    stage = 'upsert_report';
    logProgress('upsert_report', startedAt);
    const { data: saved, error: upsertError } = await supabase
      .from('assessment_reports')
      .upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          week_number: weekNumber,
          year,
          start_date: startDate,
          end_date: endDate,
          domain_scores: assessment.domain_scores,
          summary: assessment.summary,
          suggestions_next_week: assessment.suggestions_next_week,
          red_flags: assessment.red_flags,
          status: 'DRAFT',
        },
        { onConflict: 'tenant_id,student_id,week_number,year' }
      )
      .select('id')
      .single();

    if (upsertError || !saved?.id) {
      throw new Error(
        `Gagal menyimpan laporan pentaksiran: ${upsertError?.message ?? 'tiada ID dikembalikan'}`
      );
    }

    logProgress('selesai', startedAt, { reportId: saved.id, logCount });
    return { reportId: saved.id as string, assessment, logCount };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `${LOG_PREFIX} gagal stage=${stage} (+${Date.now() - startedAt}ms): ${err.message}`
    );
    await notifyWatchdog(err, {
      stage,
      tenantId,
      studentId,
      year,
      weekNumber,
      startDate,
      endDate,
      logCount,
    });
    throw err;
  }
}
