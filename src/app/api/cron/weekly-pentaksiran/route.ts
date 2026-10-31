import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';
import { WEEKLY_CRON_EVENT } from '@/inngest/events';

/**
 * Sahkan permintaan cron melalui `Authorization: Bearer` atau `x-cron-secret`.
 *
 * Dalam mod pembangunan (`NODE_ENV === 'development'`), pengesahan dilangkau
 * supaya pencetus manual boleh diuji setempat tanpa menetapkan `CRON_SECRET`.
 */
function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const explicit = request.headers.get('x-cron-secret') ?? '';

  return bearer === secret || explicit === secret;
}

/**
 * Pencetus manual Pentaksiran Mingguan.
 *
 * Menghantar acara `app/pentaksiran.weekly-cron` kepada Inngest, yang kemudian
 * memecahkan kerja kepada satu acara bagi setiap murid. Pemicu cron berjadual
 * (`0 10 * * 5` UTC) tidak melalui laluan ini.
 */
async function triggerWeeklyPentaksiran(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        processedCount: 0,
        message: 'Tidak dibenarkan. Sertakan `Authorization: Bearer <CRON_SECRET>`.',
      },
      { status: 401 }
    );
  }

  try {
    const result = await inngest.send({ name: WEEKLY_CRON_EVENT, data: {} });
    const processedCount = result.ids.length;

    return NextResponse.json({
      success: true,
      processedCount,
      message: `Acara ${WEEKLY_CRON_EVENT} berjaya dihantar kepada Inngest (${processedCount} acara).`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        processedCount: 0,
        message:
          error instanceof Error ? error.message : 'Gagal menghantar acara Inngest.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return triggerWeeklyPentaksiran(request);
}

export async function POST(request: Request) {
  return triggerWeeklyPentaksiran(request);
}
