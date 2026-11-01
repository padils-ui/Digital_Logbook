/**
 * Penjana PDF Log Mingguan (PERMATALog).
 *
 * Menghasilkan dokumen A4 berbilang halaman yang merangkumi:
 *  1. Kepala dokumen — logo pusat di kiri, nama pusat & tajuk dokumen di kanan.
 *  2. Kad ringkasan murid — Nama Anak, No. MyKid, Cawangan Pusat, Julat Tarikh.
 *  3. Seksyen harian (Isnin–Jumaat) — sepanduk tarikh + lencana pengesahan,
 *     sub-seksyen Aktiviti Anak / Kesihatan & Ubat / Tidur & Rehat / Makanan,
 *     serta kotak ulasan ibu bapa.
 *  4. Pengaki — nombor halaman dinamik ("Halaman X daripada Y") dan cap masa
 *     penjanaan sistem. Tiada ruang tandatangan kertas.
 *
 * Nota: `pdf-lib` tidak menyokong susun atur automatik, jadi setiap blok
 * mengira ketinggiannya sendiri dahulu sebelum `ensureSpace()` dipanggil.
 */

import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type Color,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type { LogCategory } from '@/lib/log-categories';
import { formatDateMy, formatDateTimeMy, formatDayLabel } from '@/lib/week-window';

/** Logo pusat yang telah dimuat turun daripada storan awam. */
export interface WeeklyLogImage {
  buffer: Uint8Array;
  mimeType: string;
}

/** Maklumat pusat yang dipaparkan pada kepala dokumen. */
export interface WeeklyLogCenterInfo {
  name: string;
  branch?: string | null;
  logo?: WeeklyLogImage | null;
}

/** Data satu hari dalam minggu laporan. */
export interface WeeklyLogDayData {
  /** Tarikh ISO (YYYY-MM-DD). */
  date: string;
  contentByCategory: Partial<Record<LogCategory, Record<string, unknown>>>;
  parentReviewed: boolean;
  parentComment?: string | null;
  parentCommentedAt?: string | null;
}

/** Muatan lengkap penjanaan PDF log mingguan. */
export interface WeeklyLogPdfData {
  center: WeeklyLogCenterInfo;
  studentName: string;
  mykidNumber?: string | null;
  weekStart: string;
  weekEnd: string;
  days: WeeklyLogDayData[];
  /** Cap masa ISO penjanaan — lalai kepada masa semasa. */
  generatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Pemalar susun atur                                                          */
/* -------------------------------------------------------------------------- */

const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const MARGIN_X = 48;
const MARGIN_TOP = PAGE_HEIGHT - 52;
const MARGIN_BOTTOM = 58;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const FONT_TITLE = 15;
const FONT_HEADING = 10.5;
const FONT_BODY = 9.5;
const FONT_SMALL = 8;

const COLOR_BRAND = rgb(0.13, 0.35, 0.72);
const COLOR_DEEP_BLUE = rgb(0.118, 0.227, 0.541);
const COLOR_TEXT = rgb(0.15, 0.17, 0.21);
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);
const COLOR_RULE = rgb(0.8, 0.83, 0.87);
const COLOR_SLATE = rgb(0.953, 0.957, 0.965);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_GREEN = rgb(0.086, 0.639, 0.29);
const COLOR_GREEN_BG = rgb(0.925, 0.992, 0.957);
const COLOR_AMBER = rgb(0.706, 0.325, 0.035);
const COLOR_AMBER_BG = rgb(1, 0.984, 0.922);

/* -------------------------------------------------------------------------- */
/* Label                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Tajuk seksyen khusus PDF. Label `health` dalam aplikasi ialah "Tingkah Laku",
 * tetapi dokumen rasmi menggunakan istilah "Kesihatan & Ubat".
 */
const CATEGORY_TITLES: Record<LogCategory, string> = {
  child_activity: 'Aktiviti Anak',
  health: 'Kesihatan & Ubat',
  sleep: 'Tidur & Rehat',
  meals: 'Makanan',
};

/** Susunan seksyen harian mengikut keutamaan dokumen. */
const SECTION_ORDER: LogCategory[] = ['child_activity', 'health', 'sleep', 'meals'];

const FIELD_LABELS: Record<string, string> = {
  appetite: 'Selera',
  duration: 'Tempoh Tidur',
  quality: 'Kualiti Tidur',
  tingkah_laku: 'Tingkah Laku',
  kesihatan: 'Kesihatan',
  kemalangan: 'Kemalangan',
  kecederaan: 'Kecederaan',
  notes: 'Catatan',
};

/** Kluster aktiviti anak yang direkodkan dalam satu kategori. */
const ACTIVITY_CLUSTERS = [
  { prefix: 'bebas', label: 'Aktiviti Bebas' },
  { prefix: 'luar', label: 'Aktiviti Luar' },
  { prefix: 'permata', label: 'Aktiviti PERMATA' },
] as const;

/** Susunan medan bagi kategori bukan-aktiviti. */
const SIMPLE_FIELDS: Partial<Record<LogCategory, string[]>> = {
  health: ['kesihatan', 'tingkah_laku', 'kemalangan', 'kecederaan'],
  sleep: ['duration', 'quality', 'notes'],
  meals: ['appetite', 'notes'],
};

/* -------------------------------------------------------------------------- */
/* Pembantu teks                                                               */
/* -------------------------------------------------------------------------- */

/** Bersihkan nilai medan log kepada teks paparan. */
function fieldText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Pecahkan teks kepada baris yang muat dalam `maxWidth`. */
function wrapLines(font: PDFFont, value: string, size: number, maxWidth: number): string[] {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Kecilkan saiz fon sehingga teks muat dalam lebar yang diberi. */
function fitFontSize(
  font: PDFFont,
  value: string,
  size: number,
  maxWidth: number,
  minSize = 9
): number {
  let current = size;
  while (current > minSize && font.widthOfTextAtSize(value, current) > maxWidth) {
    current -= 0.5;
  }
  return current;
}

/** Label sepanduk harian, cth. "Isnin, 19 Okt 2026". */
function dayBannerLabel(isoDate: string): string {
  return `${formatDayLabel(isoDate)} ${isoDate.slice(0, 4)}`;
}

/** Bina baris kandungan bagi satu kategori log. */
function buildCategoryLines(
  category: LogCategory,
  content: Record<string, unknown> | undefined
): string[] {
  if (!content) return [];

  if (category === 'child_activity') {
    const lines: string[] = [];
    for (const cluster of ACTIVITY_CLUSTERS) {
      const aktiviti = fieldText(content[`aktiviti_${cluster.prefix}`]);
      const penglibatan = fieldText(content[`penglibatan_${cluster.prefix}`]);
      if (!aktiviti && !penglibatan) continue;
      const parts = [aktiviti || 'Tiada catatan'];
      if (penglibatan) parts.push(`Penglibatan: ${penglibatan}`);
      lines.push(`• ${cluster.label}: ${parts.join(' — ')}`);
    }
    const notes = fieldText(content.notes);
    if (notes) lines.push(`Catatan Pendidik: ${notes}`);
    return lines;
  }

  const fields = SIMPLE_FIELDS[category] ?? [];
  const lines: string[] = [];
  for (const field of fields) {
    const raw = fieldText(content[field]);
    if (!raw) continue;
    const label = FIELD_LABELS[field] ?? field;
    const value = field === 'duration' && category === 'sleep' ? `${raw} jam` : raw;
    lines.push(`• ${label}: ${value}`);
  }
  return lines;
}

/* -------------------------------------------------------------------------- */
/* Penulis halaman                                                             */
/* -------------------------------------------------------------------------- */

interface TextOptions {
  x?: number;
  y?: number;
  size?: number;
  bold?: boolean;
  color?: Color;
  lineHeight?: number;
  maxWidth?: number;
}

/**
 * Pembalut `pdf-lib` yang menjejaki kedudukan menegak (`cursorY`) dan mencipta
 * halaman baharu secara automatik apabila ruang tidak mencukupi.
 */
class WeekWriter {
  private page: PDFPage | null = null;
  cursorY = MARGIN_TOP;

  constructor(
    private readonly doc: PDFDocument,
    readonly fonts: { regular: PDFFont; bold: PDFFont }
  ) {}

  get currentPage(): PDFPage {
    if (!this.page) throw new Error('Halaman PDF belum dicipta.');
    return this.page;
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = MARGIN_TOP;
  }

  /** Cipta halaman baharu jika ruang menegak tidak mencukupi. */
  ensureSpace(height: number): void {
    if (this.cursorY - height < MARGIN_BOTTOM) this.newPage();
  }

  text(value: string, options: TextOptions = {}): void {
    const {
      x = MARGIN_X,
      size = FONT_BODY,
      bold = false,
      color = COLOR_TEXT,
      lineHeight = size * 1.35,
    } = options;
    const y = options.y ?? this.cursorY;
    if (!value) return;
    this.currentPage.drawText(value, {
      x,
      y,
      size,
      font: bold ? this.fonts.bold : this.fonts.regular,
      color,
    });
    if (options.y === undefined) this.cursorY -= lineHeight;
  }

  paragraph(value: string, options: TextOptions = {}): void {
    const {
      x = MARGIN_X,
      size = FONT_BODY,
      bold = false,
      color = COLOR_TEXT,
      lineHeight = size * 1.35,
      maxWidth = CONTENT_WIDTH,
    } = options;
    const font = bold ? this.fonts.bold : this.fonts.regular;
    for (const line of wrapLines(font, value, size, maxWidth)) {
      this.ensureSpace(lineHeight);
      this.text(line, { x, size, bold, color, lineHeight });
    }
  }

  rect(x: number, y: number, width: number, height: number, color: Color): void {
    this.currentPage.drawRectangle({ x, y, width, height, color });
  }

  rule(color: Color = COLOR_RULE, gap = 6): void {
    const y = this.cursorY + gap;
    this.currentPage.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: PAGE_WIDTH - MARGIN_X, y },
      thickness: 0.9,
      color,
    });
    this.cursorY -= gap * 2;
  }

  space(amount: number): void {
    this.cursorY -= amount;
  }
}

/* -------------------------------------------------------------------------- */
/* Blok dokumen                                                                */
/* -------------------------------------------------------------------------- */

/** Bina kepala dokumen: logo pusat (kiri) + nama pusat & tajuk (kanan). */
function drawHeader(writer: WeekWriter, logo: PDFImage | null, centerName: string): void {
  const top = MARGIN_TOP;
  let textX = MARGIN_X;
  let textWidth = CONTENT_WIDTH;

  if (logo) {
    const scaled = logo.scaleToFit(52, 52);
    writer.currentPage.drawImage(logo, {
      x: MARGIN_X,
      y: top - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
    textX = MARGIN_X + 66;
    textWidth = CONTENT_WIDTH - 66;
  }

  const title = centerName.trim().toUpperCase() || 'PUSAT ANAK PERMATA NEGARA';
  const titleSize = fitFontSize(writer.fonts.bold, title, FONT_TITLE, textWidth, 9.5);

  writer.text(title, {
    x: textX,
    y: top - 14,
    size: titleSize,
    bold: true,
    color: COLOR_DEEP_BLUE,
  });
  writer.text('REKOD LOG HARIAN & PENGESAHAN MINGGUAN', {
    x: textX,
    y: top - 31,
    size: FONT_HEADING - 1,
    bold: true,
    color: COLOR_BRAND,
  });
  writer.text('Laporan mingguan aktiviti, kesihatan, tidur dan pemakanan anak', {
    x: textX,
    y: top - 44,
    size: FONT_SMALL,
    color: COLOR_MUTED,
  });

  writer.cursorY = top - 60;
  writer.rule(COLOR_BRAND, 4);
}

/** Kad ringkasan murid dalam grid dua lajur. */
function drawSummaryCard(writer: WeekWriter, data: WeeklyLogPdfData): void {
  const cardHeight = 60;
  const top = writer.cursorY;
  writer.rect(MARGIN_X, top - cardHeight, CONTENT_WIDTH, cardHeight, COLOR_SLATE);
  writer.rect(MARGIN_X, top - cardHeight, 4, cardHeight, COLOR_BRAND);

  const padX = 14;
  const colWidth = CONTENT_WIDTH / 2;
  const cellWidth = colWidth - padX - 8;

  const rows: Array<Array<{ label: string; value: string }>> = [
    [
      { label: 'Nama Anak', value: data.studentName || 'Tiada Rekod' },
      { label: 'No. MyKid', value: data.mykidNumber?.trim() || 'Tiada Rekod' },
    ],
    [
      { label: 'Cawangan Pusat', value: data.center.branch?.trim() || data.center.name },
      {
        label: 'Julat Tarikh',
        value: `${formatDateMy(data.weekStart)} – ${formatDateMy(data.weekEnd)}`,
      },
    ],
  ];

  rows.forEach((row, rowIndex) => {
    const valueY = top - 20 - rowIndex * 24;
    row.forEach((cell, colIndex) => {
      const x = MARGIN_X + padX + colIndex * colWidth;
      writer.text(cell.label.toUpperCase(), {
        x,
        y: valueY + 10,
        size: FONT_SMALL - 0.5,
        bold: true,
        color: COLOR_MUTED,
        lineHeight: 0,
      });
      const size = fitFontSize(writer.fonts.bold, cell.value, FONT_BODY, cellWidth, 7.5);
      writer.text(cell.value, {
        x,
        y: valueY - 2,
        size,
        bold: true,
        color: COLOR_TEXT,
        lineHeight: 0,
      });
    });
  });

  writer.cursorY = top - cardHeight - 14;
}

/** Sepanduk harian: tarikh di kiri, lencana pengesahan di kanan. */
function drawDayBanner(writer: WeekWriter, day: WeeklyLogDayData): void {
  const bannerHeight = 24;
  const top = writer.cursorY;
  writer.rect(MARGIN_X, top - bannerHeight, CONTENT_WIDTH, bannerHeight, COLOR_DEEP_BLUE);

  writer.text(dayBannerLabel(day.date), {
    x: MARGIN_X + 10,
    y: top - bannerHeight + 8,
    size: FONT_HEADING,
    bold: true,
    color: COLOR_WHITE,
    lineHeight: 0,
  });

  const badgeText = day.parentReviewed ? 'Telah Disahkan' : 'Belum Disahkan';
  const badgeWidth = writer.fonts.bold.widthOfTextAtSize(badgeText, FONT_SMALL) + 16;
  const badgeHeight = 15;
  const badgeX = MARGIN_X + CONTENT_WIDTH - badgeWidth - 7;
  const badgeY = top - bannerHeight + (bannerHeight - badgeHeight) / 2;

  writer.rect(badgeX, badgeY, badgeWidth, badgeHeight, day.parentReviewed ? COLOR_GREEN : COLOR_AMBER);
  writer.text(badgeText, {
    x: badgeX + 8,
    y: badgeY + 4.5,
    size: FONT_SMALL,
    bold: true,
    color: COLOR_WHITE,
    lineHeight: 0,
  });

  writer.cursorY = top - bannerHeight - 10;
}

/** Satu sub-seksyen kategori log. */
function drawCategoryBlock(
  writer: WeekWriter,
  category: LogCategory,
  content: Record<string, unknown> | undefined
): void {
  const lines = buildCategoryLines(category, content);
  writer.ensureSpace(28);

  writer.text(CATEGORY_TITLES[category].toUpperCase(), {
    size: FONT_SMALL,
    bold: true,
    color: COLOR_BRAND,
    lineHeight: 12,
  });

  if (lines.length === 0) {
    writer.ensureSpace(12);
    writer.text('Tiada rekod bagi kategori ini.', {
      x: MARGIN_X + 8,
      size: FONT_BODY,
      color: COLOR_MUTED,
      lineHeight: 12,
    });
  } else {
    for (const line of lines) {
      writer.paragraph(line, {
        x: MARGIN_X + 8,
        size: FONT_BODY,
        lineHeight: 12,
        maxWidth: CONTENT_WIDTH - 8,
      });
    }
  }

  writer.space(5);
}

/** Kotak ulasan / pengesahan ibu bapa bagi satu hari. */
function drawParentReview(writer: WeekWriter, day: WeeklyLogDayData): void {
  const padding = 9;
  const lineHeight = 12;
  const heading = 'Ulasan / Pengesahan Ibu Bapa Bagi Laporan Ini';

  const comment = day.parentComment?.trim() ?? '';
  const body =
    comment ||
    (day.parentReviewed
      ? 'Log harian telah disahkan tanpa ulasan tambahan.'
      : 'Tiada ulasan diterima daripada ibu bapa lagi.');

  const bodyLines = wrapLines(
    writer.fonts.regular,
    body,
    FONT_BODY,
    CONTENT_WIDTH - padding * 2
  );
  const meta =
    day.parentReviewed && day.parentCommentedAt
      ? `Disahkan pada ${formatDateTimeMy(day.parentCommentedAt)}`
      : null;

  const boxHeight =
    padding * 2 + 12 + 4 + bodyLines.length * lineHeight + (meta ? 12 : 0);

  writer.ensureSpace(boxHeight + 6);
  const top = writer.cursorY;
  const accent = day.parentReviewed ? COLOR_GREEN : COLOR_AMBER;

  writer.rect(MARGIN_X, top - boxHeight, CONTENT_WIDTH, boxHeight, day.parentReviewed ? COLOR_GREEN_BG : COLOR_AMBER_BG);
  writer.rect(MARGIN_X, top - boxHeight, 3, boxHeight, accent);

  writer.text(heading, {
    x: MARGIN_X + padding,
    y: top - padding - 5,
    size: FONT_SMALL,
    bold: true,
    color: accent,
    lineHeight: 0,
  });

  let y = top - padding - 20;
  for (const line of bodyLines) {
    writer.text(line, {
      x: MARGIN_X + padding,
      y,
      size: FONT_BODY,
      color: COLOR_TEXT,
      lineHeight: 0,
    });
    y -= lineHeight;
  }

  if (meta) {
    writer.text(meta, {
      x: MARGIN_X + padding,
      y: y + 2,
      size: FONT_SMALL - 0.5,
      color: COLOR_MUTED,
      lineHeight: 0,
    });
  }

  writer.cursorY = top - boxHeight - 12;
}

/** Satu seksyen harian lengkap. */
function drawDaySection(writer: WeekWriter, day: WeeklyLogDayData): void {
  writer.ensureSpace(170);
  drawDayBanner(writer, day);

  for (const category of SECTION_ORDER) {
    drawCategoryBlock(writer, category, day.contentByCategory[category]);
  }

  drawParentReview(writer, day);
}

/** Pengaki semua halaman: cap masa penjanaan + "Halaman X daripada Y". */
function drawFooters(
  doc: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  generatedAt: string
): void {
  const pages = doc.getPages();
  const total = pages.length;
  const stamp = `Dijana pada ${formatDateTimeMy(generatedAt)}`;

  pages.forEach((page, index) => {
    const y = MARGIN_BOTTOM - 22;
    page.drawLine({
      start: { x: MARGIN_X, y: y + 12 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: y + 12 },
      thickness: 0.6,
      color: COLOR_RULE,
    });
    page.drawText('PERMATALog — Rekod Log Harian Anak', {
      x: MARGIN_X,
      y,
      size: FONT_SMALL - 0.5,
      font: fonts.regular,
      color: COLOR_MUTED,
    });
    page.drawText(stamp, {
      x: MARGIN_X,
      y: y - 11,
      size: FONT_SMALL - 0.5,
      font: fonts.regular,
      color: COLOR_MUTED,
    });

    const pageText = `Halaman ${index + 1} daripada ${total}`;
    const textWidth = fonts.bold.widthOfTextAtSize(pageText, FONT_SMALL);
    page.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN_X - textWidth,
      y,
      size: FONT_SMALL,
      font: fonts.bold,
      color: COLOR_MUTED,
    });
  });
}

/** Benamkan logo pusat; pulangkan `null` jika tiada atau gagal. */
async function embedLogo(
  doc: PDFDocument,
  logo: WeeklyLogImage | null | undefined
): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    const bytes = logo.buffer instanceof Uint8Array ? logo.buffer : new Uint8Array(logo.buffer);
    return logo.mimeType.includes('png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (error) {
    console.error('[weekly-log-pdf] Gagal membenamkan logo pusat:', error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* API awam                                                                    */
/* -------------------------------------------------------------------------- */

/** Jana dokumen PDF log mingguan dan pulangkan sebagai `Buffer`. */
export async function generateWeeklyLogPdf(data: WeeklyLogPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Log Mingguan — ${data.studentName}`);
  doc.setAuthor('PERMATALog');
  doc.setSubject('Rekod Log Harian & Pengesahan Mingguan');
  doc.setCreator('PERMATALog');
  doc.setCreationDate(new Date());

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const writer = new WeekWriter(doc, fonts);
  writer.newPage();

  const logo = await embedLogo(doc, data.center.logo);
  drawHeader(writer, logo, data.center.name);
  drawSummaryCard(writer, data);

  for (const day of data.days) {
    drawDaySection(writer, day);
  }

  drawFooters(doc, fonts, data.generatedAt ?? new Date().toISOString());

  return Buffer.from(await doc.save());
}
