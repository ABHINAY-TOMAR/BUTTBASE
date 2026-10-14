/**
 * GET/DELETE /api/v1/storage/{bucket}/{smartId}   (idea.md §12)
 * Object path = the uuid half of the Smart ID. Downloads stream through.
 */
import { ERR, isNodePrefix, parseSmartId } from '@buttbase/shared-types';
import { requireAuth } from '@/lib/auth';
import { isDevMode } from '@/lib/env';
import { errorResponse, logRequest, rid } from '@/lib/http';
import { connectionOf, resolveByPrefix } from '@/lib/registry';
import { passThrough, proxyToNode } from '@/lib/proxy';

export const runtime = 'edge';

const BUCKET_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;

type Params = { params: Promise<{ bucket: string; path: string[] }> };

export async function GET(req: Request, ctx: Params) {
  return handle(req, ctx, 'GET');
}
export async function DELETE(req: Request, ctx: Params) {
  return handle(req, ctx, 'DELETE');
}

async function handle(req: Request, ctx: Params, method: 'GET' | 'DELETE') {
  const start = Date.now();
  const requestId = rid(req);

  const authFail = await requireAuth(req);
  if (authFail) return authFail;

  const { bucket, path } = await ctx.params;
  if (!BUCKET_RE.test(bucket)) {
    return errorResponse({ status: 400, body: { error: 'bad_bucket' } }, requestId);
  }

  const smartId = path[0] ?? '';
  const parsed = parseSmartId(smartId);
  if (!parsed || !isNodePrefix(parsed.prefix)) {
    return errorResponse({ status: ERR.BAD_SMART_ID.status, body: { error: ERR.BAD_SMART_ID.code } }, requestId);
  }

  const node = await resolveByPrefix(parsed.prefix);
  if (!node) {
    return errorResponse({ status: 404, body: { error: 'unknown_node', node: parsed.prefix } }, requestId);
  }
  if (node.is_paused) {
    return errorResponse(
      { status: ERR.NODE_PAUSED.status, body: { error: ERR.NODE_PAUSED.code, node: parsed.prefix } },
      requestId
    );
  }
  const conn = await connectionOf(node);
  const objectPath = '/storage/v1/object/' + bucket + '/' + parsed.uuid;

  let res: Response;
  if (isDevMode()) {
    // Stateless dev echo — object routing verified via the x-bb-node header.
    if (method === 'GET') {
      res = new Response('buttbase-dev-object', {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', 'x-bb-node': conn.prefix },
      });
    } else {
      res = new Response(null, { status: 204, headers: { 'x-bb-node': conn.prefix } });
    }
  } else {
    res = passThrough(await proxyToNode(req, conn, objectPath, { method }), conn.prefix);
  }

  logRequest({
    rid: requestId,
    method,
    path: '/api/v1/storage/' + bucket + '/' + smartId,
    node: conn.prefix,
    status: res.status,
    ms: Date.now() - start,
  });
  return res;
}
