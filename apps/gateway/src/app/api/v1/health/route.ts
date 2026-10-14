/** GET /api/v1/health — liveness + mode + active node count. */
import { isDevMode } from '@/lib/env';
import { jsonResponse } from '@/lib/http';
import { listNodes } from '@/lib/registry';

export const runtime = 'edge';

export async function GET() {
  const nodes = await listNodes();
  return jsonResponse({
    ok: true,
    service: 'buttbase-gateway',
    mode: isDevMode() ? 'dev' : 'live',
    nodes: nodes.length,
    ts: new Date().toISOString(),
  });
}
