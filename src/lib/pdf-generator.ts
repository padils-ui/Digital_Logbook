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
  helper.text('Dokumen ini dijana secara automatik oleh Digital Logbook PAPN.', {
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