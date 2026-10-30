import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
  type PDFFont,
  type PDFPage,
  type Color,
} from 'pdf-lib';
import { getCategory, type LogCategory } from '@/lib/log-categories';
import {
  PERMATA_DOMAINS,
  type PermataDomain,
  type RedFlag,
} from '@/lib/validations/assessment';

/**
 * Penjana PDF ringkasan log harian PAPN (satu halaman A4) menggunakan pdf-lib.
 */

/** Maklumat pusat PAPN yang dipaparkan pada pengepala PDF. */
export interface PapnCenterInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

/** Satu imej yang akan disematkan ke dalam kad kategori. */
export interface CategoryPhoto {
  buffer: Buffer | Uint8Array;
  mimeType: string;
}

/** Data lengkap yang diperlukan untuk menjana PDF log harian. */
export interface DailyLogPdfData {
  center: PapnCenterInfo;
  studentName: string;
  className: string;
  logDate: string;
  /** Kandungan log mengikut kategori: { [category]: { field: value } }. */
  contentByCategory: Partial<Record<LogCategory, Record<string, unknown>>>;
  /** Nama pendidik yang menandatangani log. */
  teacherName: string;
  /** Imej mengikut kategori untuk disematkan terus ke dalam kad kategori. */
  categoryPhotos?: Partial<Record<LogCategory, CategoryPhoto>>;
  /** Sama ada log harian telah disahkan oleh ibu bapa / penjaga. */
  parentReviewed?: boolean;
  /** Ulasan daripada ibu bapa (jika ada). */
  parentComment?: string | null;
  parentCommentedAt?: string | null;
  /** Status kehadiran anak bagi tarikh log (cth. 'Hadir'). */
  statusKehadiran?: string | null;
  /** Suhu badan anak semasa tiba (°C). */
  suhuTiba?: string | null;
  /** Suhu badan anak semasa pulang (°C). */
  suhuBalik?: string | null;
}

// ── Geometri halaman A4 (mata) ──────────────────────────────────
const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const MARGIN_X = 48;
const MARGIN_TOP = 800;
const MARGIN_BOTTOM = 70;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

/** Saiz fon yang digunakan dalam dokumen. */
const FONT_TITLE = 16;
const FONT_HEADING = 11;
const FONT_BODY = 9.5;
const FONT_SMALL = 8;

/** Warna untuk elemen dokumen. */
const COLOR_BRAND = rgb(0.13, 0.35, 0.72);
const COLOR_TEXT = rgb(0.1, 0.12, 0.16);
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);
const COLOR_RULE = rgb(0.8, 0.83, 0.87);
const COLOR_DEEP_BLUE = rgb(0.118, 0.227, 0.541);
const COLOR_SLATE = rgb(0.953, 0.957, 0.965);
const COLOR_CHARCOAL = rgb(0.118, 0.161, 0.231);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_GREEN = rgb(0.086, 0.639, 0.29);
const COLOR_GREEN_BG = rgb(0.925, 0.992, 0.957);
const COLOR_AMBER = rgb(0.706, 0.325, 0.035);
const COLOR_AMBER_BG = rgb(1, 0.984, 0.922);

/** Label Bahasa Melayu untuk setiap kategori log. */
const CATEGORY_LABELS: Record<LogCategory, string> = {
  child_activity: 'Aktiviti Anak',
  meals: 'Makanan',
  sleep: 'Tidur',
  health: 'Tingkah Laku',
};

/** Label Bahasa Melayu untuk medan yang diketahui. */
const FIELD_LABELS: Record<string, string> = {
  aktiviti_bebas: 'Aktiviti Bebas',
  penglibatan_bebas: 'Penglibatan Bebas',
  aktiviti_luar: 'Aktiviti Luar',
  penglibatan_luar: 'Penglibatan Luar',
  aktiviti_permata: 'Aktiviti PERMATA',
  penglibatan_permata: 'Penglibatan PERMATA',
  notes: 'Catatan',
  appetite: 'Selera',
  duration: 'Tempoh',
  quality: 'Kualiti Tidur',
  tingkah_laku: 'Tingkah Laku',
  kemalangan: 'Kemalangan',
  kecederaan: 'Kecederaan',
  kesihatan: 'Kesihatan',
};

/** Format nilai medan untuk paparan PDF. */
function formatFieldValue(field: string, value: unknown, category?: LogCategory): string {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!text) return '';
  if (field === 'duration') {
    return category === 'sleep' ? `${text} jam` : text;
  }
  return text;
}

/** Format nilai suhu dengan unit °C; 'Tiada Rekod' jika tiada nilai. */
function formatSuhu(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text ? `${text} °C` : 'Tiada Rekod';
}

/** Format tarikh ISO (YYYY-MM-DD) kepada format Bahasa Melayu. */
function formatDateMs(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const months = [
    'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Ambil nilai medan yang tidak kosong daripada satu kategori. */
function categoryEntries(
  fields: Record<string, unknown> | undefined,
  category?: LogCategory
): Array<[string, string]> {
  if (!fields) return [];
  return Object.entries(fields)
    .map(
      ([field, value]) =>
        [field, formatFieldValue(field, value, category)] as [string, string]
    )
    .filter(([, text]) => text !== '');
}

/** Pembantu untuk menguruskan lukisan pada halaman. */
class PageHelper {
  cursorY: number = MARGIN_TOP;

  constructor(
    public page: PDFPage,
    public fonts: { regular: PDFFont; bold: PDFFont }
  ) {}

  text(
    value: string,
    options: {
      x?: number;
      y?: number;
      size?: number;
      bold?: boolean;
      color?: Color;
      lineHeight?: number;
    } = {}
  ): void {
    const {
      x = MARGIN_X,
      size = FONT_BODY,
      bold = false,
      color = COLOR_TEXT,
      lineHeight = size * 1.35,
    } = options;

    const y = options.y ?? this.cursorY;
    this.page.drawText(value, {
      x,
      y,
      size,
      font: bold ? this.fonts.bold : this.fonts.regular,
      color,
    });

    if (options.y === undefined) {
      this.cursorY -= lineHeight;
    }
  }

  paragraph(
    value: string,
    options: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: Color;
      maxWidth?: number;
      lineHeight?: number;
    } = {}
  ): void {
    const {
      x = MARGIN_X,
      size = FONT_BODY,
      maxWidth = CONTENT_WIDTH,
      lineHeight = size * 1.35,
    } = options;

    const words = value.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    let currentLine = '';
    const font = options.bold ? this.fonts.bold : this.fonts.regular;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          this.text(currentLine, { ...options, x, size, lineHeight });
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      this.text(currentLine, { ...options, x, size, lineHeight });
    }
  }

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color
  ): void {
    this.page.drawRectangle({
      x,
      y,
      width,
      height,
      color,
    });
  }

  rule(color: Color = COLOR_RULE, gap = 6): void {
    const y = this.cursorY + gap;
    this.page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: PAGE_WIDTH - MARGIN_X, y },
      thickness: 0.7,
      color,
    });
    this.cursorY -= gap * 2;
  }

  space(amount: number): void {
    this.cursorY -= amount;
  }
}

/**
 * Lukis kad bertajuk, dengan sokongan imej sebaris (inline) di bawah
 * senarai bulet jika foto kategori disediakan.
 */
async function drawCard(
  helper: PageHelper,
  doc: PDFDocument,
  title: string,
  lines: string[],
  x: number,
  width: number,
  photo?: CategoryPhoto
): Promise<void> {
  const lineHeight = 12;
  const padding = 8;
  const titleHeight = 22;
  const photoMaxHeight = 70;

  let estimatedContentHeight = 0;
  const font = helper.fonts.regular;
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    let currentLine = '';
    let lineCount = 1;
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(test, FONT_BODY) > width - padding * 2) {
        lineCount++;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    estimatedContentHeight += lineCount * lineHeight;
  }

  let embedded: Awaited<ReturnType<PDFDocument['embedJpg']>> | null = null;
  let photoHeight = 0;
  let photoWidth = 0;
  if (photo) {
    try {
      const mime = photo.mimeType.toLowerCase();
      embedded = mime.includes('png')
        ? await doc.embedPng(photo.buffer)
        : await doc.embedJpg(photo.buffer);
      const dims = embedded.scaleToFit(width - padding * 2, photoMaxHeight);
      photoWidth = dims.width;
      photoHeight = dims.height;
    } catch (err) {
      console.error('[pdf-generator] Gagal membenamkan imej kategori:', err);
      embedded = null;
      photoHeight = 0;
    }
  }

  const photoBlockHeight = embedded ? photoHeight + 8 : 0;
  const totalHeight = titleHeight + estimatedContentHeight + photoBlockHeight + 6;
  const top = helper.cursorY;

  helper.rect(x, top - totalHeight, width, totalHeight, COLOR_SLATE);

  helper.cursorY = top - 14;
  helper.text(title, { x: x + padding, size: FONT_HEADING, bold: true, color: COLOR_DEEP_BLUE, lineHeight: 14 });

  for (const line of lines) {
    helper.paragraph(line, { x: x + padding, size: FONT_BODY, maxWidth: width - padding * 2, lineHeight });
  }

  if (embedded) {
    const photoX = x + (width - photoWidth) / 2;
    const photoY = helper.cursorY - photoHeight - 2;
    helper.page.drawImage(embedded, {
      x: photoX,
      y: photoY,
      width: photoWidth,
      height: photoHeight,
    });
  }

  helper.cursorY = top - totalHeight - 8;
}

/** Pengepala dan maklumat anak. */
function drawHeaderAndStudentInfo(helper: PageHelper, data: DailyLogPdfData): void {
  const bannerHeight = 72;
  helper.rect(0, PAGE_HEIGHT - bannerHeight, PAGE_WIDTH, bannerHeight, COLOR_DEEP_BLUE);
  
  helper.cursorY = PAGE_HEIGHT - 30;
  helper.text(data.center.name.toUpperCase(), {
    x: MARGIN_X,
    size: FONT_TITLE,
    bold: true,
    color: COLOR_WHITE,
    lineHeight: 18,
  });
  helper.text('LOG HARIAN ANAK', {
    x: MARGIN_X,
    size: FONT_HEADING,
    bold: true,
    color: COLOR_WHITE,
    lineHeight: 14,
  });
  
  helper.text(formatDateMs(data.logDate), {
    x: PAGE_WIDTH - MARGIN_X - 120,
    y: PAGE_HEIGHT - 30,
    size: FONT_SMALL,
    color: COLOR_WHITE,
  });

  helper.cursorY = PAGE_HEIGHT - 96;
  const cardTop = helper.cursorY;
  const cardHeight = 60;
  helper.rect(MARGIN_X, cardTop - cardHeight, CONTENT_WIDTH, cardHeight, COLOR_SLATE);
  
  const colWidth = CONTENT_WIDTH / 2;
  const leftX = MARGIN_X + 10;
  const rightX = MARGIN_X + colWidth + 10;

  helper.cursorY = cardTop - 18;
  helper.text(`Nama Anak: ${data.studentName}`, { x: leftX, size: FONT_BODY, bold: true, color: COLOR_CHARCOAL, lineHeight: 14 });
  helper.text(`Tarikh: ${formatDateMs(data.logDate)}`, { x: rightX, y: cardTop - 18, size: FONT_BODY, color: COLOR_CHARCOAL });
  
  helper.cursorY = cardTop - 32;
  helper.text(`Kelas: ${data.className}`, { x: leftX, size: FONT_BODY, color: COLOR_CHARCOAL, lineHeight: 14 });
  helper.text(`Pendidik / Pengasuh: ${data.teacherName}`, { x: rightX, y: cardTop - 32, size: FONT_BODY, color: COLOR_CHARCOAL });

  // Baris kehadiran & suhu — fallback 'Tiada Rekod' jika rekod tiada.
  const statusLabel = (data.statusKehadiran ?? '').trim() || 'Tiada Rekod';
  helper.text(
    `Kehadiran: ${statusLabel}   |   Suhu Tiba: ${formatSuhu(data.suhuTiba)}   |   Suhu Balik: ${formatSuhu(data.suhuBalik)}`,
    { x: leftX, y: cardTop - 46, size: FONT_SMALL, color: COLOR_CHARCOAL }
  );

  helper.cursorY = cardTop - cardHeight - 14;
}

/** Kategori log. */
async function drawLogCategories(
  helper: PageHelper,
  data: DailyLogPdfData,
  doc: PDFDocument
): Promise<void> {
  const photos = data.categoryPhotos ?? {};

  const activity = categoryEntries(data.contentByCategory.child_activity, 'child_activity');
  if (activity.length > 0) {
    await drawCard(
      helper,
      doc,
      CATEGORY_LABELS.child_activity,
      activity.map(([field, value]) => `• ${FIELD_LABELS[field] ?? field}: ${value}`),
      MARGIN_X,
      CONTENT_WIDTH,
      photos.child_activity
    );
  }

  const meals = categoryEntries(data.contentByCategory.meals, 'meals');
  const sleep = categoryEntries(data.contentByCategory.sleep, 'sleep');
  
  if (meals.length > 0 || sleep.length > 0) {
    const colWidth = (CONTENT_WIDTH - 10) / 2;
    const top = helper.cursorY;
    let leftBottom = top;
    let rightBottom = top;

    if (meals.length > 0) {
      await drawCard(helper, doc, CATEGORY_LABELS.meals, meals.map(([f, v]) => `${FIELD_LABELS[f] ?? f}: ${v}`), MARGIN_X, colWidth, photos.meals);
      leftBottom = helper.cursorY;
    }
    
    if (sleep.length > 0) {
      helper.cursorY = top;
      await drawCard(helper, doc, CATEGORY_LABELS.sleep, sleep.map(([f, v]) => `${FIELD_LABELS[f] ?? f}: ${v}`), MARGIN_X + colWidth + 10, colWidth, photos.sleep);
      rightBottom = helper.cursorY;
    }
    helper.cursorY = Math.min(leftBottom, rightBottom);
  }

  const health = categoryEntries(data.contentByCategory.health, 'health');
  if (health.length > 0) {
    await drawCard(
      helper,
      doc,
      CATEGORY_LABELS.health,
      health.map(([f, v]) => `${FIELD_LABELS[f] ?? f}: ${v}`),
      MARGIN_X,
      CONTENT_WIDTH,
      photos.health
    );
  }
}

/**
 * Lukis seksyen "Pengesahan & Ulasan Ibu Bapa / Penjaga".
 *
 * Dipaparkan tepat di atas footer dokumen. Mengandungi pengepala dengan
 * lencana status (Telah Disahkan / Belum Disahkan) dan badan yang memaparkan
 * ulasan ibu bapa atau mesej lalai yang sesuai.
 */
function drawParentReview(helper: PageHelper, data: DailyLogPdfData): void {
  const reviewed = data.parentReviewed === true;
  const comment = (data.parentComment ?? '').trim();

  const padding = 8;
  const width = CONTENT_WIDTH;
  const headerHeight = 20;
  const bodyLineHeight = 12;

  // Tentukan teks badan berdasarkan status pengesahan.
  let bodyText: string;
  if (reviewed) {
    bodyText = comment || 'Log harian telah disahkan tanpa ulasan tambahan.';
  } else {
    bodyText = 'Tiada ulasan diterima daripada ibu bapa lagi.';
  }

  // Kira tinggi badan berdasarkan bilangan baris teks.
  const font = helper.fonts.regular;
  const words = bodyText.split(/\s+/).filter(Boolean);
  let currentLine = '';
  let bodyLines = 1;
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(test, FONT_BODY) > width - padding * 2) {
      bodyLines++;
      currentLine = word;
    } else {
      currentLine = test;
    }
  }

  const bodyHeight = bodyLines * bodyLineHeight + padding;
  const totalHeight = headerHeight + bodyHeight + 6;
  const top = helper.cursorY;

  // Latar belakang keseluruhan seksyen.
  helper.rect(MARGIN_X, top - totalHeight, width, totalHeight, COLOR_SLATE);

  // Pengepala + lencana status.
  helper.text('Pengesahan & Ulasan Ibu Bapa / Penjaga', {
    x: MARGIN_X + padding,
    y: top - 14,
    size: FONT_HEADING,
    bold: true,
    color: COLOR_DEEP_BLUE,
  });

  const badgeText = reviewed ? 'Telah Disahkan' : 'Belum Disahkan';
  const badgeColor = reviewed ? COLOR_GREEN : COLOR_AMBER;
  const badgeBg = reviewed ? COLOR_GREEN_BG : COLOR_AMBER_BG;
  const badgeFont = helper.fonts.bold;
  const badgeTextWidth = badgeFont.widthOfTextAtSize(badgeText, FONT_SMALL);
  const badgeWidth = badgeTextWidth + 16;
  const badgeX = MARGIN_X + width - padding - badgeWidth;
  const badgeY = top - 18;

  helper.rect(badgeX, badgeY, badgeWidth, 14, badgeBg);
  helper.text(badgeText, {
    x: badgeX + 8,
    y: badgeY + 4,
    size: FONT_SMALL,
    bold: true,
    color: badgeColor,
  });

  // Kotak badan untuk ulasan.
  const bodyTop = top - headerHeight;
  helper.rect(MARGIN_X + padding, bodyTop - bodyHeight, width - padding * 2, bodyHeight, COLOR_WHITE);

  helper.cursorY = bodyTop - padding - 2;
  helper.paragraph(bodyText, {
    x: MARGIN_X + padding * 2,
    size: FONT_BODY,
    maxWidth: width - padding * 4,
    lineHeight: bodyLineHeight,
    color: reviewed && comment ? COLOR_CHARCOAL : COLOR_MUTED,
  });

  helper.cursorY = top - totalHeight - 8;
}

/** Footer dokumen. */
function drawFooter(helper: PageHelper): void {
  helper.text('Dokumen ini dijana secara automatik oleh PERMATALog.', {
    x: MARGIN_X,
    y: MARGIN_BOTTOM - 6,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
}

/**
 * Jana PDF ringkasan log harian satu halaman A4 menggunakan pdf-lib.
 * Mengembalikan dokumen sebagai `Buffer` Node.js.
 */
export async function generateDailyLogPdf(data: DailyLogPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  
  const helper = new PageHelper(page, fonts);
  
  drawHeaderAndStudentInfo(helper, data);
  await drawLogCategories(helper, data, doc);
  drawParentReview(helper, data);
  drawFooter(helper);
  
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/** Label kategori untuk kegunaan luaran (cth. nama fail). */
export function categoryLabel(category: LogCategory): string {
  return CATEGORY_LABELS[category] ?? getCategory(category).label;
}

// ══════════════════════════════════════════════════════════════
// Laporan Pentaksiran Mingguan (PERMATA)
// ══════════════════════════════════════════════════════════════

/** Label Bahasa Melayu bagi setiap domain PERMATA. */
const PERMATA_LABELS: Record<PermataDomain, string> = {
  fizikal: 'Fizikal',
  bahasa: 'Bahasa',
  sahsiah: 'Sahsiah',
  awal_matematik: 'Awal Matematik',
  deria: 'Deria',
  kreativiti: 'Kreativiti',
};

/** Warna teks bendera merah keterukan tinggi/sederhana. */
const COLOR_RED_FLAG = rgb(0.75, 0.13, 0.2);

/** Data yang diperlukan untuk menjana PDF laporan pentaksiran. */
export interface AssessmentReportPdfData {
  center: PapnCenterInfo;
  studentName: string;
  className: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  domainScores: Partial<Record<PermataDomain, number | null>>;
  summary: string;
  teacherNotes?: string | null;
  suggestionsNextWeek: string[];
  redFlags: RedFlag[];
  teacherName: string;
}

/** Konteks lukisan yang boleh bertukar halaman apabila ruang tidak cukup. */
interface PdfContext {
  doc: PDFDocument;
  helper: PageHelper;
  fonts: { regular: PDFFont; bold: PDFFont };
}

/** Tambah halaman baharu jika ruang menegak tidak mencukupi. */
function ensureSpace(context: PdfContext, needed: number): void {
  if (context.helper.cursorY - needed >= MARGIN_BOTTOM + 40) return;
  context.helper = new PageHelper(
    context.doc.addPage(PageSizes.A4),
    context.fonts
  );
}

/** Tajuk seksyen dengan garis pemisah. */
function drawSectionTitle(context: PdfContext, title: string): void {
  const { helper } = context;
  helper.text(title, {
    size: FONT_HEADING,
    bold: true,
    color: COLOR_DEEP_BLUE,
  });
  helper.rule();
}

/** Pengepala dokumen beserta maklumat pusat. */
function drawAssessmentHeader(context: PdfContext, data: AssessmentReportPdfData) {
  const { helper } = context;

  helper.rect(0, PAGE_HEIGHT - 72, PAGE_WIDTH, 72, COLOR_DEEP_BLUE);
  helper.cursorY = PAGE_HEIGHT - 30;
  helper.text('LAPORAN PENTAKSIRAN MINGGUAN', {
    size: FONT_TITLE,
    bold: true,
    color: COLOR_WHITE,
  });
  helper.text('Kurikulum PERMATA Negara', {
    size: FONT_SMALL,
    color: rgb(0.78, 0.86, 1),
  });

  helper.cursorY = PAGE_HEIGHT - 96;
  helper.text(data.center.name, {
    size: FONT_HEADING,
    bold: true,
    color: COLOR_CHARCOAL,
  });
  if (data.center.address) {
    helper.text(data.center.address, { size: FONT_SMALL, color: COLOR_MUTED });
  }
  helper.space(8);
}

/** Kad maklumat anak dan tempoh laporan. */
function drawAssessmentStudentCard(
  context: PdfContext,
  data: AssessmentReportPdfData
) {
  const { helper } = context;
  const top = helper.cursorY;
  const height = 62;
  const rightX = MARGIN_X + CONTENT_WIDTH / 2 + 10;

  helper.rect(MARGIN_X, top - height, CONTENT_WIDTH, height, COLOR_SLATE);

  const labelY = top - 18;
  const valueY = top - 33;

  helper.text('Nama Anak', {
    x: MARGIN_X + 12,
    y: labelY,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  helper.text(data.studentName, {
    x: MARGIN_X + 12,
    y: valueY,
    size: FONT_HEADING,
    bold: true,
    color: COLOR_CHARCOAL,
  });

  helper.text('Kelas', {
    x: rightX,
    y: labelY,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  helper.text(data.className, {
    x: rightX,
    y: valueY,
    size: FONT_BODY,
    bold: true,
    color: COLOR_CHARCOAL,
  });

  helper.text('Minggu', {
    x: MARGIN_X + 12,
    y: top - 44,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  helper.text(`Minggu ${data.weekNumber} / ${data.year}`, {
    x: MARGIN_X + 58,
    y: top - 44,
    size: FONT_SMALL,
    bold: true,
    color: COLOR_CHARCOAL,
  });

  helper.text('Tempoh', {
    x: rightX,
    y: top - 44,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  helper.text(
    `${formatDateMs(data.startDate)} – ${formatDateMs(data.endDate)}`,
    {
      x: rightX + 42,
      y: top - 44,
      size: FONT_SMALL,
      bold: true,
      color: COLOR_CHARCOAL,
    }
  );

  helper.cursorY = top - height - 14;
}

/** Bar mendatar bagi enam domain PERMATA. */
function drawAssessmentDomainScores(
  context: PdfContext,
  scores: Partial<Record<PermataDomain, number | null>>
) {
  const { helper } = context;
  drawSectionTitle(context, 'Skor Domain PERMATA');

  const labelWidth = 100;
  const trackWidth = CONTENT_WIDTH - labelWidth - 56;

  for (const domain of PERMATA_DOMAINS) {
    const raw = scores[domain];
    const hasScore = typeof raw === 'number' && !Number.isNaN(raw);
    const value = hasScore ? Math.min(100, Math.max(0, raw)) : 0;

    const y = helper.cursorY - 10;
    helper.text(PERMATA_LABELS[domain], {
      x: MARGIN_X,
      y,
      size: FONT_BODY,
      color: COLOR_CHARCOAL,
    });

    const trackX = MARGIN_X + labelWidth;
    helper.rect(trackX, y - 1, trackWidth, 7, COLOR_SLATE);
    if (value > 0) {
      helper.rect(trackX, y - 1, (trackWidth * value) / 100, 7, COLOR_BRAND);
    }

    helper.text(hasScore ? `${value}` : 'Tiada data', {
      x: trackX + trackWidth + 8,
      y,
      size: FONT_SMALL,
      bold: hasScore,
      color: hasScore ? COLOR_CHARCOAL : COLOR_MUTED,
    });

    helper.cursorY = y - 8;
  }

  helper.space(8);
}

/** Perenggan teks dengan tajuk seksyen. */
function drawAssessmentParagraph(
  context: PdfContext,
  title: string,
  body: string,
  fallback: string
) {
  const { helper } = context;
  const text = body.trim() || fallback;

  ensureSpace(context, 70);
  drawSectionTitle(context, title);
  helper.paragraph(text, { color: COLOR_CHARCOAL, maxWidth: CONTENT_WIDTH - 8 });
  helper.space(8);
}

/** Senarai cadangan untuk minggu hadapan. */
function drawAssessmentSuggestions(
  context: PdfContext,
  suggestions: string[]
) {
  const { helper } = context;
  const items = suggestions.map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return;

  ensureSpace(context, 60);
  drawSectionTitle(context, 'Cadangan Minggu Hadapan');
  for (const item of items) {
    const bulletY = helper.cursorY;
    helper.text('•', {
      x: MARGIN_X,
      y: bulletY,
      size: FONT_BODY,
      color: COLOR_BRAND,
    });
    helper.paragraph(item, {
      x: MARGIN_X + 12,
      maxWidth: CONTENT_WIDTH - 12,
      color: COLOR_CHARCOAL,
    });
    helper.space(3);
  }
  helper.space(6);
}

/** Kotak amaran bagi bendera merah (red flag). */
function drawAssessmentRedFlags(context: PdfContext, redFlags: RedFlag[]) {
  if (redFlags.length === 0) return;
  const { helper } = context;

  ensureSpace(context, 80);
  drawSectionTitle(context, 'Perhatian / Bendera Merah');

  for (const flag of redFlags) {
    ensureSpace(context, 64);
    const severityLabel =
      flag.severity === 'HIGH'
        ? 'TINGGI'
        : flag.severity === 'MEDIUM'
          ? 'SEDERHANA'
          : 'RENDAH';
    const severityColor = flag.severity === 'LOW' ? COLOR_AMBER : COLOR_RED_FLAG;

    const top = helper.cursorY;
    const boxHeight = 46;
    helper.rect(MARGIN_X, top - boxHeight, CONTENT_WIDTH, boxHeight, COLOR_AMBER_BG);

    helper.text(`[${severityLabel}] ${flag.flag}`, {
      x: MARGIN_X + 10,
      y: top - 15,
      size: FONT_BODY,
      bold: true,
      color: severityColor,
    });
    helper.cursorY = top - 26;
    helper.paragraph(`Cadangan: ${flag.recommendation}`, {
      x: MARGIN_X + 10,
      size: FONT_SMALL,
      maxWidth: CONTENT_WIDTH - 20,
      color: COLOR_CHARCOAL,
      lineHeight: 11,
    });
    helper.cursorY = top - boxHeight - 10;
  }
}

/** Blok tandatangan guru dan ibu bapa / penjaga. */
function drawAssessmentSignature(context: PdfContext, teacherName: string) {
  const { helper } = context;
  ensureSpace(context, 90);

  const top = helper.cursorY - 20;
  const columnWidth = (CONTENT_WIDTH - 30) / 2;

  helper.text('Disemak oleh:', {
    x: MARGIN_X,
    y: top,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
  helper.text('Disahkan oleh Ibu Bapa / Penjaga:', {
    x: MARGIN_X + columnWidth + 30,
    y: top,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });

  const lineY = top - 34;
  helper.page.drawLine({
    start: { x: MARGIN_X, y: lineY },
    end: { x: MARGIN_X + columnWidth, y: lineY },
    thickness: 0.8,
    color: COLOR_RULE,
  });
  helper.page.drawLine({
    start: { x: MARGIN_X + columnWidth + 30, y: lineY },
    end: { x: MARGIN_X + columnWidth * 2 + 30, y: lineY },
    thickness: 0.8,
    color: COLOR_RULE,
  });

  helper.text(teacherName, {
    x: MARGIN_X,
    y: lineY - 14,
    size: FONT_SMALL,
    bold: true,
    color: COLOR_CHARCOAL,
  });
  helper.text('Guru / Pengasuh', {
    x: MARGIN_X,
    y: lineY - 25,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });

  helper.text('Tandatangan & Tarikh', {
    x: MARGIN_X + columnWidth + 30,
    y: lineY - 14,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });
}

/**
 * Jana PDF laporan pentaksiran mingguan (A4) menggunakan pdf-lib.
 * Mengembalikan dokumen sebagai `Buffer` Node.js.
 */
export async function generateAssessmentReportPdf(
  data: AssessmentReportPdfData
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const context: PdfContext = {
    doc,
    fonts,
    helper: new PageHelper(page, fonts),
  };

  drawAssessmentHeader(context, data);
  drawAssessmentStudentCard(context, data);
  drawAssessmentDomainScores(context, data.domainScores);
  drawAssessmentParagraph(
    context,
    'Ringkasan Perkembangan',
    data.summary,
    'Tiada ringkasan disediakan.'
  );
  if (data.teacherNotes && data.teacherNotes.trim()) {
    drawAssessmentParagraph(
      context,
      'Catatan Guru',
      data.teacherNotes,
      ''
    );
  }
  drawAssessmentSuggestions(context, data.suggestionsNextWeek);
  drawAssessmentRedFlags(context, data.redFlags);
  drawAssessmentSignature(context, data.teacherName);

  drawFooter(context.helper);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}