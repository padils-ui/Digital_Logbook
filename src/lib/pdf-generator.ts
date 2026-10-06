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
  /** Nama guru yang menandatangani log. */
  teacherName: string;
  /** Imej mengikut kategori untuk disematkan terus ke dalam kad kategori. */
  categoryPhotos?: Partial<Record<LogCategory, CategoryPhoto>>;
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

/** Label Bahasa Melayu untuk setiap kategori log. */
const CATEGORY_LABELS: Record<LogCategory, string> = {
  child_activity: 'Aktiviti Anak',
  meals: 'Makanan',
  sleep: 'Tidur',
  attendance: 'Kehadiran / Suhu',
  health: 'Kesihatan / Ubat',
};

/** Label Bahasa Melayu untuk medan yang diketahui. */
const FIELD_LABELS: Record<string, string> = {
  activity: 'Aktiviti',
  participation: 'Penglibatan',
  duration: 'Tempoh',
  notes: 'Catatan',
  meal: 'Waktu Makan',
  appetite: 'Selera',
  quality: 'Kualiti Tidur',
  status: 'Status Kehadiran',
  temperature: 'Suhu Badan',
  condition: 'Keadaan',
  medicine: 'Ubat Diberi',
};

/** Format nilai medan untuk paparan PDF. */
function formatFieldValue(field: string, value: unknown, category?: LogCategory): string {
  const text = value === null || value === undefined ? '' : String(value).trim();
  if (!text) return '';
  if (field === 'temperature') return `${text} °C`;
  if (field === 'duration') {
    return category === 'sleep' ? `${text} jam` : `${text} minit`;
  }
  return text;
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
    color: Color,
    radius: number = 0
  ): void {
    // pdf-lib drawRectangle draws from bottom-left
    this.page.drawRectangle({
      x,
      y,
      width,
      height,
      color,
    });
    // Note: pdf-lib doesn't have native rounded corners for drawRectangle.
    // We could use SVG paths, but for this refactor we'll stick to simple rects
    // or just omit the radius if not critical. The original had Bezier curves.
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
 *
 * Imej diskalakan kepada ketinggian maksimum ~70pt supaya kad kekal padat
 * dan dokumen dapat dimuatkan pada satu halaman A4.
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

  // Estimate height
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

  // Semat imej terlebih dahulu untuk mengetahui dimensi sebenar.
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

  // Lukis imej sebaris di bawah bulet, di tengah-tengah kad.
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

/** Pengepala dan maklumat murid. */
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
  helper.text('LOG HARIAN MURID', {
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
  const cardHeight = 58;
  helper.rect(MARGIN_X, cardTop - cardHeight, CONTENT_WIDTH, cardHeight, COLOR_SLATE);
  
  const colWidth = CONTENT_WIDTH / 2;
  const leftX = MARGIN_X + 10;
  const rightX = MARGIN_X + colWidth + 10;

  helper.cursorY = cardTop - 18;
  helper.text(`Nama Murid: ${data.studentName}`, { x: leftX, size: FONT_BODY, bold: true, color: COLOR_CHARCOAL, lineHeight: 14 });
  helper.text(`Tarikh: ${formatDateMs(data.logDate)}`, { x: rightX, y: cardTop - 18, size: FONT_BODY, color: COLOR_CHARCOAL });
  
  helper.cursorY = cardTop - 32;
  helper.text(`Kelas: ${data.className}`, { x: leftX, size: FONT_BODY, color: COLOR_CHARCOAL, lineHeight: 14 });
  helper.text(`Guru / Pengasuh: ${data.teacherName}`, { x: rightX, y: cardTop - 32, size: FONT_BODY, color: COLOR_CHARCOAL });

  // Badge kehadiran & suhu
  helper.cursorY = cardTop - cardHeight - 26;
  const attendance = data.contentByCategory.attendance ?? {};
  const status = formatFieldValue('status', attendance.status) || 'Hadir';
  const temp = formatFieldValue('temperature', attendance.temperature);
  const badgeY = helper.cursorY;
  
  helper.rect(MARGIN_X, badgeY, 150, 20, COLOR_DEEP_BLUE);
  helper.text(`Status: ${status}`, { x: MARGIN_X + 12, y: badgeY + 6, size: FONT_SMALL, bold: true, color: COLOR_WHITE });
  
  if (temp) {
    helper.rect(MARGIN_X + 160, badgeY, 130, 20, COLOR_SLATE);
    helper.text(`Suhu: ${temp}`, { x: MARGIN_X + 172, y: badgeY + 6, size: FONT_SMALL, bold: true, color: COLOR_CHARCOAL });
  }
  helper.cursorY = badgeY - 14;
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

  const attendanceNotes = categoryEntries(data.contentByCategory.attendance, 'attendance').filter(
    ([field]) => field === 'notes'
  );
  if (attendanceNotes.length > 0) {
    await drawCard(
      helper,
      doc,
      CATEGORY_LABELS.attendance,
      attendanceNotes.map(([f, v]) => `${FIELD_LABELS[f] ?? f}: ${v}`),
      MARGIN_X,
      CONTENT_WIDTH,
      photos.attendance
    );
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
  drawFooter(helper);
  
  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/** Label kategori untuk kegunaan luaran (cth. nama fail). */
export function categoryLabel(category: LogCategory): string {
  return CATEGORY_LABELS[category] ?? getCategory(category).label;
}
