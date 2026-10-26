import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';
import { WEEKLY_CRON_EVENT } from '@/inngest/events';

/** Sahkan permintaan cron melalui `Authorization: Bearer` atau `x-cron-secret`. */
function isAuthorized(request: Request): boolean {
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
 * Melindungi pemicu cron dengan `CRON_SECRET` dan menghantar acara kepada
 * Inngest. Pemicu cron berjadual (`0 10 * * 5` UTC) tidak melalui laluan ini.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Tidak dibenarkan.' }, { status: 401 });
  }

  try {
    await inngest.send({ name: WEEKLY_CRON_EVENT, data: {} });
    return NextResponse.json({ ok: true, event: WEEKLY_CRON_EVENT });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Gagal menghantar acara Inngest.',
      },
      { status: 500 }
    );
  }
}
