import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Kunci tab yang disokong oleh penghalaan pintar berbilang tab.
 * Setiap kunci memetakan kepada satu kategori log dalam LOG_CATEGORIES.
 */
const TAB_KEYS = [
  'pembelajaran',
  'aktiviti_luar',
  'makanan',
  'tidur',
  'kehadiran_suhu',
  'kesihatan_ubat',
  'makluman_harian',
] as const;

type TabKey = (typeof TAB_KEYS)[number];

/** Peta tabKey → nilai kategori dalam LOG_CATEGORIES. */
const TAB_TO_CATEGORY: Record<TabKey, string> = {
  pembelajaran: 'learning',
  aktiviti_luar: 'outdoor',
  makanan: 'meals',
  tidur: 'sleep',
  kehadiran_suhu: 'attendance',
  kesihatan_ubat: 'health',
  makluman_harian: 'parent_message',
};

/** Medan yang sah bagi setiap tab (mengikut definisi borang). */
const TAB_FIELDS: Record<TabKey, string[]> = {
  pembelajaran: ['activity', 'participation', 'notes'],
  aktiviti_luar: ['activity', 'duration', 'notes'],
  makanan: ['meal', 'appetite', 'notes'],
  tidur: ['duration', 'quality', 'notes'],
  kehadiran_suhu: ['status', 'temperature', 'notes'],
  kesihatan_ubat: ['condition', 'medicine', 'notes'],
  makluman_harian: ['message', 'action_status'],
};

/** Skema satu tab — semua medan opsional (nullable). */
function tabSchema(fields: string[]) {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    properties[field] =
      field === 'duration' || field === 'temperature'
        ? { type: Type.NUMBER, nullable: true }
        : { type: Type.STRING, nullable: true };
  }
  return { type: Type.OBJECT, properties, nullable: true };
}

/** Skema JSON berbilang tab yang dijangka daripada Gemini. */
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    data_by_tab: {
      type: Type.OBJECT,
      description:
        'Peta tabKey → medan yang disebut. Hanya isi tab yang disebut secara eksplisit; tab lain biarkan null.',
      properties: Object.fromEntries(
        TAB_KEYS.map((key) => [key, tabSchema(TAB_FIELDS[key])])
      ),
    },
    student_names: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Nama murid yang disebut dalam rakaman.',
    },
    summary_bm: {
      type: Type.STRING,
      description: 'Ringkasan ringkas dalam Bahasa Melayu untuk pengesahan guru.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Keyakinan 0-1 terhadap penghalaan tab.',
    },
  },
  required: ['data_by_tab', 'summary_bm'],
};

const SYSTEM_PROMPT = `Anda ialah pembantu pentadbiran untuk Pusat Anak PERMATA Negara (PAPN) di Malaysia.
Tugas anda: tukar pertuturan guru dalam Bahasa Melayu kepada data log harian berstruktur,
DIHALAKAN ke tab yang betul (penghalaan pintar berbilang tab).

Tab yang tersedia (gunakan kunci ini dalam data_by_tab):
- pembelajaran: aktiviti pembelajaran, topik belajar (cth: mengenal huruf, menggunting, melukis, mewarna, menyanyi)
- aktiviti_luar: permainan luar, sukan, aktiviti fizikal (cth: padang, taman, bermain air, bola)
- makanan: selera makan, jenis hidangan, nota makanan (cth: makan, minum, suap, kenyang, susu)
- tidur: tempoh tidur, kualiti tidur (cth: tidur, lelap, rehat)
- kehadiran_suhu: suhu badan, nota kehadiran (cth: suhu, 37.5, demam, hadir, tidak hadir)
- kesihatan_ubat: masalah kesihatan, ubat yang diberi (cth: batuk, selesema, sakit, ubat)
- makluman_harian: nota ibu bapa, baju gantian, lampin (cth: ibu bapa minta, bawa lampin)

Peraturan:
1. Gunakan Bahasa Melayu baku (istilah KPM). JANGAN gunakan istilah Indonesia.
   Contoh: "Muat Naik" bukan "Unggah", "Guru Besar" bukan "Pengetua".
2. PECAH pertuturan kepada beberapa tab jika ia menyebut pelbagai perkara.
   Contoh: "Aiman makan habis, kemudian tidur satu jam" →
   { "makanan": { "appetite": "Makan habis", "notes": "Makan habis" },
     "tidur": { "duration": 1, "quality": "Tidur lena" } }
3. HANYA isi tab yang disebut secara eksplisit. Tab yang tidak disebut MESTI null.
   JANGAN reka data. JANGAN ulang teks yang sama dalam semua tab.
4. Suhu badan dalam Celsius. "tiga puluh enam lima" = 36.5.
5. Tempoh tidur dalam jam. "satu jam" = 1.
6. Jika guru menyebut beberapa murid, senaraikan nama dalam student_names.
7. summary_bm mesti ringkas dan mudah difahami guru untuk pengesahan.

PEMBERSIHAN NILAI (SANGAT PENTING):
8. BUANG nama murid daripada SEMUA nilai medan. Nama murid hanya diletakkan
   dalam student_names, TIDAK dalam medan.
   Contoh: "Khairul Zikri", "Zikri", "Aiman" → dibuang sepenuhnya.
9. BUANG penanda masa/tarikh: "hari ini", "pada hari ini", "pada pagi ini",
   "petang tadi", "tadi".
10. BUANG penanda kategori dan kata transisi di awal/akhir nilai:
    "pembelajaran", "aktiviti luar", "aktiviti luar ialah", "makanan pula ialah",
    "ialah", "adalah", "pula", "kemudian", "dan", "seterusnya", "selanjutnya".
11. Nilai MESTI ringkas dan mengandungi HANYA tindakan/butiran sebenar.
    Contoh BETUL:
      - pembelajaran.activity: "Aktiviti menggunting"
      - aktiviti_luar.activity: "Bermain air di kolam"
      - makanan.notes: "Makan dengan habis"
    Contoh SALAH (jangan hasilkan begini):
      - "pembelajaran khairul zikri hari ini ialah aktiviti menggunting"
      - "ialah bermain air di kolam zikri makan dengan habis"
12. JANGAN campurkan kandungan antara tab. Teks aktiviti luar TIDAK boleh masuk
    ke makanan. Teks pembelajaran TIDAK boleh masuk ke aktiviti luar.
    Setiap tab hanya menerima butiran yang berkaitan dengannya sahaja.
13. Mulakan nilai dengan huruf besar dan jangan tinggalkan perkataan
    penggantung seperti "ialah", "adalah", "pula" di hujung nilai.`;

interface VoiceLogRequest {
  /** Teks transkripsi daripada Web Speech API. */
  transcript?: string;
  /** Audio base64 (fallback untuk pelayar tanpa Web Speech API). */
  audioBase64?: string;
  mimeType?: string;
}

/**
 * Model mengikut keutamaan. Gemini kadangkala memulangkan 503 (permintaan
 * tinggi) secara sementara, jadi kita cuba model seterusnya.
 * Gunakan model stabil: 2.0-flash → 1.5-flash → 1.5-flash-8b (paling kecil).
 */
const MODEL_CHAIN = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

/** Bilangan percubaan semula bagi setiap model sebelum beralih ke seterusnya. */
const RETRIES_PER_MODEL = 2;

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('overloaded') ||
    message.includes('high demand')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Menjana kandungan dengan percubaan semula dan rantaian model sandaran.
 * Mengendalikan 503 sementara daripada Gemini.
 */
async function generateWithRetry(
  ai: GoogleGenAI,
  parts: Record<string, unknown>[]
) {
  let lastError: unknown = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < RETRIES_PER_MODEL; attempt += 1) {
      try {
        return await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        });
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) throw error;
        // Backoff eksponen: 800ms, 1600ms.
        await sleep(800 * 2 ** attempt);
      }
    }
  }

  throw lastError ?? new Error('Semua model Gemini tidak tersedia.');
}

/** Penanda masa/tarikh yang perlu dibuang daripada nilai. */
const TIME_FILLERS = [
  'pada hari ini',
  'pada pagi ini',
  'pada petang ini',
  'hari ini',
  'pagi ini',
  'petang ini',
  'petang tadi',
  'pagi tadi',
  'tadi',
];

/** Kata transisi/kategori yang perlu dibuang di awal atau akhir nilai. */
const TRANSITION_WORDS = [
  'aktiviti luar ialah',
  'aktiviti luar adalah',
  'makanan pula ialah',
  'makanan ialah',
  'pembelajaran ialah',
  'tidur ialah',
  'suhu ialah',
  'aktiviti luar',
  'pembelajaran',
  'makanan',
  'tidur',
  'suhu',
  'ialah',
  'adalah',
  'pula',
  'kemudian',
  'seterusnya',
  'selanjutnya',
  'selepas itu',
  'selepas',
  'dan',
];

/** Buang aksen/huruf besar untuk padanan nama. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Huruf besar pada aksara pertama. */
function capitalise(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Bersihkan satu cebisan teks: buang nama murid, penanda masa, penanda
 * kategori dan kata transisi di awal/akhir. Memulangkan teks ringkas.
 */
function cleanSnippet(raw: string, studentNames: string[]): string {
  let out = ` ${raw} `;

  // Buang nama murid (padanan tidak sensitif huruf besar/kecil).
  for (const name of studentNames) {
    const n = name.trim();
    if (!n) continue;
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  }

  // Buang penanda masa/tarikh.
  for (const filler of TIME_FILLERS) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  }

  out = out.replace(/\s+/g, ' ').trim();

  // Buang kata transisi/kategori berulang di awal dan akhir.
  let changed = true;
  while (changed) {
    changed = false;
    const lower = out.toLowerCase();
    for (const word of TRANSITION_WORDS) {
      if (lower.startsWith(`${word} `)) {
        out = out.slice(word.length).trim();
        changed = true;
        break;
      }
      if (lower.endsWith(` ${word}`)) {
        out = out.slice(0, out.length - word.length).trim();
        changed = true;
        break;
      }
    }
  }

  // Buang tanda baca penggantung di hujung.
  out = out.replace(/[\s,;:.]+$/g, '').trim();
  return capitalise(out);
}

/**
 * Penghurai sandaran berasaskan kata kunci berbilang tab — digunakan apabila
 * Gemini sibuk (503). Memecah pertuturan mengikut kata transisi dan
 * mengagihkan setiap cebisan ke tab yang betul, kemudian membersihkan
 * nama murid, penanda masa dan penanda kategori daripada nilai.
 */
function keywordFallbackParse(
  text: string,
  knownStudentNames: string[] = []
): {
  dataByTab: Partial<Record<TabKey, Record<string, unknown>>>;
  studentNames: string[];
} {
  // Pecah pertuturan mengikut kata transisi / pemisah.
  const segments = text
    .split(
      /\s*(?:,|;|\.|\bdan\b|\bkemudian\b|\bseterusnya\b|\bselanjutnya\b|\bpula\b|\bselepas itu\b|\bselepas\b)\s*/i
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const dataByTab: Partial<Record<TabKey, Record<string, unknown>>> = {};

  /** Tambah cebisan ke tab tanpa menimpa nota sedia ada. */
  function push(tab: TabKey, fields: Record<string, unknown>) {
    const existing = dataByTab[tab] ?? {};
    dataByTab[tab] = { ...existing, ...fields };
  }

  /** Gabungkan nota bagi tab yang sama. */
  function pushNote(tab: TabKey, note: string) {
    if (!note) return;
    const existing = dataByTab[tab] ?? {};
    const prev = typeof existing.notes === 'string' ? existing.notes : '';
    const merged = prev ? `${prev} ${note}` : note;
    dataByTab[tab] = { ...existing, notes: merged };
  }

  for (const raw of segments) {
    const s = raw.toLowerCase();
    if (!s) continue;

    // ── Pembelajaran (keutamaan tinggi) ─────────────────────────
    // Diperiksa DAHULU supaya penanda kategori "pembelajaran" dan kata
    // tindakan pembelajaran tidak dirampas oleh tab lain (cth: "makanan",
    // "aktiviti luar"). Penanda "pembelajaran" dikesan sebelum dibersihkan.
    if (
      s.includes('pembelajaran') ||
      s.includes('pelajaran') ||
      s.includes('belajar') ||
      s.includes('menggunting') ||
      s.includes('gunting') ||
      s.includes('mewarna') ||
      s.includes('melukis') ||
      s.includes('menulis') ||
      s.includes('membaca') ||
      s.includes('mengira') ||
      s.includes('menyanyi') ||
      s.includes('kraftangan') ||
      s.includes('kraf') ||
      s.includes('sains') ||
      s.includes('matematik') ||
      s.includes('blok') ||
      s.includes('huruf') ||
      s.includes('abjad') ||
      s.includes('nombor') ||
      s.includes('buku')
    ) {
      const clean = cleanSnippet(raw, knownStudentNames);
      if (clean) {
        // Isi KEDUA-DUA medan supaya Aktiviti dan Catatan sepadan.
        push('pembelajaran', { activity: clean });
        pushNote('pembelajaran', clean);
      }
      continue;
    }

    // ── Kehadiran / Suhu ────────────────────────────────────────
    const tempMatch = s.match(/(\d{2}[.,]\d)/);
    if (
      s.includes('suhu') ||
      tempMatch ||
      s.includes('demam') ||
      s.includes('hadir') ||
      s.includes('lewat')
    ) {
      const fields: Record<string, unknown> = {};
      if (tempMatch) fields.temperature = parseFloat(tempMatch[1].replace(',', '.'));
      if (s.includes('tidak hadir')) fields.status = 'Tidak hadir';
      else if (s.includes('lewat')) fields.status = 'Lewat';
      else if (s.includes('hadir')) fields.status = 'Hadir';
      push('kehadiran_suhu', fields);
      pushNote('kehadiran_suhu', cleanSnippet(raw, knownStudentNames));
      continue;
    }

    // ── Kesihatan / Ubat ────────────────────────────────────────
    if (
      s.includes('ubat') ||
      s.includes('sakit') ||
      s.includes('batuk') ||
      s.includes('selesema') ||
      s.includes('alahan')
    ) {
      const conditions: string[] = [];
      if (s.includes('batuk')) conditions.push('batuk');
      if (s.includes('selesema')) conditions.push('selesema');
      if (s.includes('sakit')) conditions.push('sakit');
      if (s.includes('alahan')) conditions.push('alahan');
      const fields: Record<string, unknown> = {};
      if (conditions.length) fields.condition = capitalise(conditions.join(' dan '));
      const medMatch = raw.match(/ubat\s+([\w\s]+?)(?:,|\.|\d|$)/i);
      if (medMatch) fields.medicine = capitalise(medMatch[1].trim());
      push('kesihatan_ubat', fields);
      pushNote('kesihatan_ubat', cleanSnippet(raw, knownStudentNames));
      continue;
    }

    // ── Makanan ─────────────────────────────────────────────────
    if (
      s.includes('makan') ||
      s.includes('minum') ||
      s.includes('suap') ||
      s.includes('kenyang') ||
      s.includes('susu') ||
      s.includes('sarapan')
    ) {
      const fields: Record<string, unknown> = {};
      if (s.includes('sarapan')) fields.meal = 'Sarapan';
      else if (s.includes('tengah hari')) fields.meal = 'Makan tengah hari';
      else if (s.includes('petang')) fields.meal = 'Minum petang';
      else if (s.includes('pagi')) fields.meal = 'Minum pagi';
      if (s.includes('habis') || s.includes('siap') || s.includes('kenyang'))
        fields.appetite = 'Makan habis';
      else if (s.includes('separuh')) fields.appetite = 'Makan separuh';
      else if (s.includes('tidak mahu') || s.includes('tak mahu'))
        fields.appetite = 'Tidak mahu makan';
      push('makanan', fields);
      pushNote('makanan', cleanSnippet(raw, knownStudentNames));
      continue;
    }

    // ── Tidur ───────────────────────────────────────────────────
    if (s.includes('tidur') || s.includes('lelap') || s.includes('rehat')) {
      const fields: Record<string, unknown> = {};
      const sleepMatch = s.match(/(\d+(?:[.,]\d+)?)\s*jam/);
      if (sleepMatch) fields.duration = parseFloat(sleepMatch[1].replace(',', '.'));
      if (s.includes('lena')) fields.quality = 'Tidur lena';
      else if (s.includes('sukar')) fields.quality = 'Sukar tidur';
      else if (s.includes('bangun')) fields.quality = 'Bangun awal';
      push('tidur', fields);
      pushNote('tidur', cleanSnippet(raw, knownStudentNames));
      continue;
    }

    // ── Aktiviti Luar ───────────────────────────────────────────
    if (
      s.includes('aktiviti luar') ||
      s.includes('padang') ||
      s.includes('bermain air') ||
      s.includes('kolam') ||
      s.includes('taman') ||
      s.includes('bola') ||
      s.includes('senaman') ||
      s.includes('berlari') ||
      s.includes('melompat')
    ) {
      const clean = cleanSnippet(raw, knownStudentNames);
      if (clean) {
        push('aktiviti_luar', { activity: clean });
        pushNote('aktiviti_luar', clean);
      }
      continue;
    }

    // ── Makluman Harian ─────────────────────────────────────────
    if (
      s.includes('ibu bapa') ||
      s.includes('penjaga') ||
      s.includes('lampin') ||
      s.includes('baju gantian') ||
      s.includes('mesej') ||
      s.includes('pesan')
    ) {
      const clean = cleanSnippet(raw, knownStudentNames);
      if (clean) push('makluman_harian', { message: clean });
      continue;
    }

    // Cebisan tidak dikenali — letak dalam pembelajaran sebagai lalai.
    const fallbackClean = cleanSnippet(raw, knownStudentNames);
    if (fallbackClean) {
      push('pembelajaran', { activity: fallbackClean });
      pushNote('pembelajaran', fallbackClean);
    }
  }

  // Ekstrak nama murid: utamakan nama yang dikenali (tenant), kemudian
  // perkataan bermula huruf besar sebagai cadangan tambahan.
  const studentNames: string[] = [];
  const lowerText = text.toLowerCase();
  for (const name of knownStudentNames) {
    const n = name.trim();
    if (n && lowerText.includes(n.toLowerCase()) && !studentNames.includes(n)) {
      studentNames.push(n);
    }
  }

  if (studentNames.length === 0) {
    const nameMatches = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g) ?? [];
    const stopWords = new Set([
      'Makan', 'Tidur', 'Hadir', 'Tidak', 'Sila', 'Guru', 'Murid',
      'Kelas', 'Hari', 'Pagi', 'Petang', 'Malam', 'Suhu', 'Ubat',
      'Aktiviti', 'Pembelajaran', 'Kesihatan', 'Makluman', 'Luar',
      'Makanan', 'Bermain', 'Kolam', 'Taman',
    ]);
    for (const n of nameMatches) {
      if (!stopWords.has(n) && !studentNames.includes(n)) studentNames.push(n);
    }
  }

  return { dataByTab, studentNames };
}
/**
 * Bina respons sandaran yang sentiasa berjaya apabila ada transkripsi.
 * Jika penghurai kata kunci tidak dapat mengisi mana-mana tab, teks penuh
 * dimasukkan ke dalam `pembelajaran.notes` supaya pertuturan guru tidak hilang.
 */
function buildFallbackResponse(transcript: string, knownStudentNames: string[] = []) {
  const fallback = keywordFallbackParse(transcript, knownStudentNames);
  const dataByTab = { ...fallback.dataByTab };

  const hasAnyTab = Object.values(dataByTab).some(
    (tab) => tab && Object.keys(tab).length > 0
  );
  if (!hasAnyTab) {
    dataByTab.pembelajaran = { notes: transcript };
  }

  return NextResponse.json({
    success: true,
    dataByTab,
    studentNames: fallback.studentNames,
    summary:
      'Sistem AI sibuk. Teks pertuturan telah diagihkan ke tab berkaitan — sila semak.',
    confidence: 0.4,
    fallback: true,
  });
}

export async function POST(request: NextRequest) {
  // Hanya pengguna disahkan boleh menggunakan endpoint ini.
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json(
      { error: 'Sesi tamat. Sila log masuk semula.' },
      { status: 401 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY belum ditetapkan. Sila tambah kunci API dalam .env.local.',
      },
      { status: 503 }
    );
  }

  let body: VoiceLogRequest;
  try {
    body = (await request.json()) as VoiceLogRequest;
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak sah.' }, { status: 400 });
  }

  const { transcript, audioBase64, mimeType } = body;
  const cleanTranscript = transcript?.trim() ?? '';

  if (!cleanTranscript && !audioBase64) {
    return NextResponse.json(
      { error: 'Tiada rakaman atau transkripsi diterima.' },
      { status: 400 }
    );
  }

  // Ambil nama murid tenant semasa — digunakan untuk membuang nama daripada
  // nilai medan supaya hanya butiran bersih disimpan.
  let knownStudentNames: string[] = [];
  try {
    const admin = createAdminClient();
    const { data: studentRows } = await admin
      .from('students')
      .select('full_name, nickname')
      .eq('tenant_id', profile.tenant_id);
    knownStudentNames = (studentRows ?? []).flatMap((row) => {
      const names: string[] = [];
      if (row.full_name) names.push(row.full_name);
      if (row.nickname) names.push(row.nickname);
      return names;
    });
  } catch {
    // Gagal mendapatkan nama murid tidak sepatutnya menggagalkan permintaan.
    knownStudentNames = [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Bina bahagian kandungan: teks dan/atau audio.
    const parts: Record<string, unknown>[] = [];

    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBase64,
        },
      });
      parts.push({
        text: 'Dengar rakaman audio ini dan tukarkan kepada log harian berstruktur.',
      });
    } else {
      parts.push({
        text: `Tukarkan transkripsi pertuturan guru ini kepada log harian berstruktur:\n\n"${cleanTranscript}"`,
      });
    }

    const response = await generateWithRetry(ai, parts);

    const text = response.text;
    if (!text) {
      // Gemini tidak memulangkan hasil — jangan gagalkan; gunakan sandaran.
      if (cleanTranscript) {
        return buildFallbackResponse(cleanTranscript, knownStudentNames);
      }
      return NextResponse.json(
        { error: 'Gemini tidak memulangkan hasil. Sila cuba lagi.' },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(text) as {
      data_by_tab?: Record<string, Record<string, unknown> | null>;
      student_names?: string[];
      summary_bm: string;
      confidence?: number;
    };

    // Bersihkan data_by_tab: buang tab null, buang medan kosong, sahkan medan,
    // dan bersihkan nilai teks (buang nama murid, penanda masa/kategori).
    const dataByTab: Partial<Record<TabKey, Record<string, unknown>>> = {};
    const rawTabs = parsed.data_by_tab ?? {};
    for (const key of TAB_KEYS) {
      const tab = rawTabs[key];
      if (!tab || typeof tab !== 'object') continue;
      const allowed = TAB_FIELDS[key];
      const clean: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(tab)) {
        if (!allowed.includes(field)) continue;
        if (value === null || value === undefined) continue;
        if (typeof value === 'string') {
          const cleaned = cleanSnippet(value, knownStudentNames);
          if (!cleaned) continue;
          clean[field] = cleaned;
        } else {
          clean[field] = value;
        }
      }
      if (Object.keys(clean).length > 0) dataByTab[key] = clean;
    }

    // Jika AI tidak mengisi mana-mana tab, masukkan transkripsi ke pembelajaran.
    if (Object.keys(dataByTab).length === 0 && cleanTranscript) {
      dataByTab.pembelajaran = { notes: cleanTranscript };
    }

    return NextResponse.json({
      success: true,
      dataByTab,
      studentNames: parsed.student_names ?? [],
      summary: parsed.summary_bm ?? '',
      confidence: parsed.confidence ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Ralat tidak diketahui';

    const isServiceUnavailable =
      message.includes('503') ||
      message.includes('UNAVAILABLE') ||
      message.includes('overloaded') ||
      message.includes('high demand');

    // Selagi ada transkripsi, JANGAN gagalkan permintaan — gunakan sandaran.
    if (cleanTranscript) {
      return buildFallbackResponse(cleanTranscript, knownStudentNames);
    }

    return NextResponse.json(
      {
        error: isServiceUnavailable
          ? 'Sistem AI mengalami kesibukan sementara. Sila isi borang secara manual atau cuba sebentar lagi.'
          : `Gagal memproses rakaman: ${message}`,
      },
      { status: isServiceUnavailable ? 503 : 500 }
    );
  }
}
