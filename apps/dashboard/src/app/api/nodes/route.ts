/** Registry for the Databases view. Live mode reads the Master via PostgREST (service key, server-side only). */
import { NextResponse } from 'next/server';
import type { RegistryNode } from '@buttbase/shared-types';
import { mockNodes } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

function isLive(): boolean {
  return (
    process.env.BB_DEV_MODE === '0' &&
    Boolean(process.env.MASTER_SUPABASE_URL) &&
    Boolean(process.env.MASTER_SERVICE_ROLE_KEY)
  );
}

export async function GET() {
  if (!isLive()) {
    return NextResponse.json({ nodes: mockNodes(), mode: 'dev' });
  }
  try {
    const url = (process.env.MASTER_SUPABASE_URL ?? '').replace(/\/$/, '');
    const key = process.env.MASTER_SERVICE_ROLE_KEY ?? '';
    const res = await fetch(url + '/rest/v1/projects_registry?select=*', {
      headers: { apikey: key, authorization: 'Bearer ' + key },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const nodes = (await res.json()) as RegistryNode[];
    return NextResponse.json({ nodes, mode: 'live' });
  } catch (e) {
    return NextResponse.json({
      nodes: mockNodes(),
      mode: 'dev',
      fallback: true,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
