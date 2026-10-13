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
  'aktiviti_anak',
  'makanan',
  'tidur',
  'tingkah_laku',
] as const;

type TabKey = (typeof TAB_KEYS)[number];

/** Peta tabKey → nilai kategori dalam LOG_CATEGORIES. */
const TAB_TO_CATEGORY: Record<TabKey, string> = {
  aktiviti_anak: 'child_activity',
  makanan: 'meals',
  tidur: 'sleep',
  tingkah_laku: 'health',
};

/** Medan yang sah bagi setiap tab (mengikut definisi borang). */
const TAB_FIELDS: Record<TabKey, string[]> = {
  aktiviti_anak: [
    'aktiviti_bebas',
    'penglibatan_bebas',
    'aktiviti_luar',
    'penglibatan_luar',
    'aktiviti_permata',
    'penglibatan_permata',
    'notes',
  ],
  makanan: ['appetite', 'notes'],
  tidur: ['duration', 'quality', 'notes'],
  tingkah_laku: ['tingkah_laku', 'kemalangan', 'kecederaan', 'kesihatan', 'notes'],
};

/** Skema satu tab — semua medan opsional (nullable). */
function tabSchema(fields: string[]) {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    properties[field] =
      field === 'duration'
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
      description: 'Nama anak yang disebut dalam rakaman.',
    },
    summary_bm: {
      type: Type.STRING,
      description: 'Ringkasan ringkas dalam Bahasa Melayu untuk pengesahan pendidik.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Keyakinan 0-1 terhadap penghalaan tab.',
    },
  },
  required: ['data_by_tab', 'summary_bm'],
};

const SYSTEM_PROMPT = `Anda ialah pembantu pentadbiran untuk Pusat Anak PERMATA Negara (PAPN) di Malaysia.
Tugas anda: tukar pertuturan pendidik dalam Bahasa Melayu kepada data log harian berstruktur,
DIHALAKAN ke tab yang betul (penghalaan pintar berbilang tab).

Tab yang tersedia (gunakan kunci ini dalam data_by_tab):
- aktiviti_anak: aktiviti yang dijalankan, merangkumi kluster Aktiviti Bebas, Aktiviti Luar dan Aktiviti PERMATA (cth: mengenal huruf, menggunting, melukis, mewarna, menyanyi, bermain di taman, bola, senaman). Isi aktiviti_bebas / aktiviti_luar / aktiviti_permata mengikut kluster yang disebut.
- makanan: selera makan, jenis hidangan, nota makanan (cth: makan, minum, suap, kenyang, susu)
- tidur: tempoh tidur, kualiti tidur (cth: tidur, lelap, rehat)
- tingkah_laku: tingkah laku anak, kemalangan, kecederaan dan kesihatan (cth: menangis, bergaduh, jatuh, lebam, batuk, selesema, demam)

Peraturan:
1. Gunakan Bahasa Melayu baku (istilah KPM). JANGAN gunakan istilah Indonesia.
   Contoh: "Muat Naik" bukan "Unggah", "Guru Besar" bukan "Pengetua".
2. PECAH pertuturan kepada beberapa tab jika ia menyebut pelbagai perkara.
   Contoh: "Aiman makan habis, kemudian tidur satu jam" →
   { "makanan": { "appetite": "Makan habis", "notes": "Makan habis" },
     "tidur": { "duration": 1, "quality": "Tidur lena" } }
3. HANYA isi tab yang disebut secara eksplisit. Tab yang tidak disebut MESTI null.
   JANGAN reka data. JANGAN ulang teks yang sama dalam semua tab.
4. Tempoh tidur dalam jam. "satu jam" = 1.
5. Jika pendidik menyebut beberapa anak, senaraikan nama dalam student_names.
6. summary_bm mesti ringkas dan mudah difahami pendidik untuk pengesahan.

PEMBERSIHAN NILAI (SANGAT PENTING):
7. BUANG nama anak daripada SEMUA nilai medan. Nama anak hanya diletakkan
   dalam student_names, TIDAK dalam medan.
   Contoh: "Khairul Zikri", "Zikri", "Aiman" → dibuang sepenuhnya.
8. BUANG penanda masa/tarikh: "hari ini", "pada hari ini", "pada pagi ini",
   "petang tadi", "tadi".
9. BUANG penanda kategori dan kata transisi di awal/akhir nilai:
   "aktiviti bebas", "aktiviti luar", "aktiviti PERMATA", "makanan pula ialah",
   "ialah", "adalah", "pula", "kemudian", "dan", "seterusnya", "selanjutnya".
10. Nilai MESTI ringkas dan mengandungi HANYA tindakan/butiran sebenar.
    Contoh BETUL:
      - aktiviti_bebas: "Menggunting bentuk bulat"
      - aktiviti_luar: "Bermain air di kolam"
      - makanan.notes: "Makan dengan habis"
    Contoh SALAH (jangan hasilkan begini):
      - "aktiviti bebas khairul zikri hari ini ialah menggunting"
      - "ialah bermain air di kolam zikri makan dengan habis"
11. JANGAN campurkan kandungan antara tab. Teks aktiviti luar TIDAK boleh masuk
    ke makanan. Teks aktiviti bebas TIDAK boleh masuk ke aktiviti luar.
    Setiap tab hanya menerima butiran yang berkaitan dengannya sahaja.
12. Mulakan nilai dengan huruf besar dan jangan tinggalkan perkataan
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
  'aktiviti bebas ialah',
  'aktiviti permata ialah',
  'makanan pula ialah',
  'makanan ialah',
  'pembelajaran ialah',
  'tidur ialah',
  'aktiviti luar',
  'aktiviti bebas',
  'aktiviti permata',
  'tingkah laku',
  'pembelajaran',
  'makanan',
  'tidur',
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
 * Bersihkan satu cebisan teks: buang nama anak, penanda masa, penanda
 * kategori dan kata transisi di awal/akhir. Memulangkan teks ringkas.
 */
function cleanSnippet(raw: string, studentNames: string[]): string {
  let out = ` ${raw} `;

  // Buang nama anak (padanan tidak sensitif huruf besar/kecil).
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
 * nama anak, penanda masa dan penanda kategori daripada nilai.
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

    // ── Aktiviti Anak (keutamaan tinggi) ────────────────────────
    // Diperiksa DAHULU supaya penanda kategori dan kata tindakan aktiviti
    // tidak dirampas oleh tab lain (cth: "makanan", "aktiviti luar").
    if (
      s.includes('aktiviti anak') ||
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
      s.includes('buku') ||
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
        // Tentukan kluster: Aktiviti Luar jika ada kata kunci luar/fizikal.
        const isLuar =
          s.includes('aktiviti luar') ||
          s.includes('padang') ||
          s.includes('bermain air') ||
          s.includes('kolam') ||
          s.includes('taman') ||
          s.includes('bola') ||
          s.includes('senaman') ||
          s.includes('berlari') ||
          s.includes('melompat');
        const aktivitiField = isLuar ? 'aktiviti_luar' : 'aktiviti_bebas';
        push('aktiviti_anak', { [aktivitiField]: clean });
        pushNote('aktiviti_anak', clean);
      }
      continue;
    }

    // ── Tingkah Laku / Kesihatan ────────────────────────────────
    if (
      s.includes('ubat') ||
      s.includes('sakit') ||
      s.includes('batuk') ||
      s.includes('selesema') ||
      s.includes('alahan') ||
      s.includes('demam') ||
      s.includes('jatuh') ||
      s.includes('kemalangan') ||
      s.includes('terhantuk') ||
      s.includes('cedera') ||
      s.includes('luka') ||
      s.includes('lebam') ||
      s.includes('menangis') ||
      s.includes('bergaduh')
    ) {
      const clean = cleanSnippet(raw, knownStudentNames);
      const fields: Record<string, unknown> = {};
      const conditions: string[] = [];
      if (s.includes('batuk')) conditions.push('batuk');
      if (s.includes('selesema')) conditions.push('selesema');
      if (s.includes('sakit')) conditions.push('sakit');
      if (s.includes('alahan')) conditions.push('alahan');
      if (s.includes('demam')) conditions.push('demam');
      if (conditions.length) fields.kesihatan = capitalise(conditions.join(' dan '));
      if (s.includes('jatuh') || s.includes('kemalangan') || s.includes('terhantuk'))
        fields.kemalangan = clean;
      if (s.includes('cedera') || s.includes('luka') || s.includes('lebam'))
        fields.kecederaan = clean;
      push('tingkah_laku', fields);
      pushNote('tingkah_laku', clean);
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

    // Cebisan tidak dikenali — letak dalam aktiviti anak sebagai lalai.
    const fallbackClean = cleanSnippet(raw, knownStudentNames);
    if (fallbackClean) {
      push('aktiviti_anak', { aktiviti_bebas: fallbackClean });
      pushNote('aktiviti_anak', fallbackClean);
    }
  }

  // Ekstrak nama anak: utamakan nama yang dikenali (tenant), kemudian
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
      'Makan', 'Tidur', 'Hadir', 'Tidak', 'Sila', 'Pendidik', 'Anak',
      'Kelas', 'Hari', 'Pagi', 'Petang', 'Malam', 'Tingkah', 'Laku',
      'Aktiviti', 'Pembelajaran', 'Kesihatan', 'Makluman', 'Luar',
      'Makanan', 'Bermain', 'Kolam', 'Taman', 'Anak',
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
 * dimasukkan ke dalam `aktiviti_anak.notes` supaya pertuturan pendidik tidak hilang.
 */
function buildFallbackResponse(transcript: string, knownStudentNames: string[] = []) {
  const fallback = keywordFallbackParse(transcript, knownStudentNames);
  const dataByTab = { ...fallback.dataByTab };

  const hasAnyTab = Object.values(dataByTab).some(
    (tab) => tab && Object.keys(tab).length > 0
  );
  if (!hasAnyTab) {
    dataByTab.aktiviti_anak = { notes: transcript };
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

  // Ambil nama anak tenant semasa — digunakan untuk membuang nama daripada
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
    // Gagal mendapatkan nama anak tidak sepatutnya menggagalkan permintaan.
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
        text: `Tukarkan transkripsi pertuturan pendidik ini kepada log harian berstruktur:\n\n"${cleanTranscript}"`,
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
    // dan bersihkan nilai teks (buang nama anak, penanda masa/kategori).
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

    // Jika AI tidak mengisi mana-mana tab, masukkan transkripsi ke aktiviti_anak.
    if (Object.keys(dataByTab).length === 0 && cleanTranscript) {
      dataByTab.aktiviti_anak = { notes: cleanTranscript };
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
