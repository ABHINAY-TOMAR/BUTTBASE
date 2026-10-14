/** Enqueue a provisioning job (idea.md §8). Dev mode simulates; live mode writes the throttled queue. */
import { NextResponse } from 'next/server';
import { NODE_CATEGORIES } from '@buttbase/shared-types';

export const dynamic = 'force-dynamic';

function isLive(): boolean {
  return (
    process.env.BB_DEV_MODE === '0' &&
    Boolean(process.env.MASTER_SUPABASE_URL) &&
    Boolean(process.env.MASTER_SERVICE_ROLE_KEY)
  );
}

export async function POST(req: Request) {
  let body: { name?: string; type?: string };
  try {
    body = (await req.json()) as { name?: string; type?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const type = body.type ?? '';
  if (!(NODE_CATEGORIES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: 'bad_data_type' }, { status: 400 });
  }
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : null;

  if (!isLive()) {
    return NextResponse.json({
      queued: true,
      mode: 'dev',
      job: { id: crypto.randomUUID(), requested_data_type: type, requested_name: name, status: 'pending' },
    });
  }

  try {
    const url = (process.env.MASTER_SUPABASE_URL ?? '').replace(/\/$/, '');
    const key = process.env.MASTER_SERVICE_ROLE_KEY ?? '';
    const res = await fetch(url + '/rest/v1/provisioning_queue', {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: 'Bearer ' + key,
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify({ requested_data_type: type, requested_name: name, status: 'pending' }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return NextResponse.json({ queued: true, mode: 'live' });
  } catch (e) {
    return NextResponse.json(
      { error: 'queue_unavailable', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
