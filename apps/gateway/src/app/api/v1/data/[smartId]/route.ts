/**
 * /api/v1/data/{smartId}?table=notes   (idea.md §12, §5)
 * Read/update/delete path: split the Smart ID at the first underscore —
 * the prefix IS the route. Zero database lookups on the routing path.
 */
import { ERR, isNodePrefix, parseSmartId } from '@buttbase/shared-types';
import { requireAuth } from '@/lib/auth';
import { isDevMode } from '@/lib/env';
import { errorResponse, jsonResponse, logRequest, rid } from '@/lib/http';
import { connectionOf, resolveByPrefix } from '@/lib/registry';
import { passThrough, proxyToNode } from '@/lib/proxy';

export const runtime = 'edge';

const TABLE_RE = /^[a-z_][a-z0-9_]{0,62}$/;

type Params = { params: Promise<{ smartId: string }> };

export async function GET(req: Request, ctx: Params) {
  return handle(req, ctx, 'GET');
}
export async function PATCH(req: Request, ctx: Params) {
  return handle(req, ctx, 'PATCH');
}
export async function DELETE(req: Request, ctx: Params) {
  return handle(req, ctx, 'DELETE');
}

async function handle(req: Request, ctx: Params, method: 'GET' | 'PATCH' | 'DELETE') {
  const start = Date.now();
  const requestId = rid(req);

  const authFail = await requireAuth(req);
  if (authFail) return authFail;

  const { smartId } = await ctx.params;
  const parsed = parseSmartId(smartId);
  if (!parsed || !isNodePrefix(parsed.prefix)) {
    return errorResponse({ status: ERR.BAD_SMART_ID.status, body: { error: ERR.BAD_SMART_ID.code } }, requestId);
  }

  const sp = new URL(req.url).searchParams;
  const table = sp.get('table') ?? '';
  if (!TABLE_RE.test(table)) {
    return errorResponse({ status: ERR.BAD_TABLE.status, body: { error: ERR.BAD_TABLE.code } }, requestId);
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

  sp.delete('table');
  sp.set('id', 'eq.' + parsed.uuid);
  const qs = sp.toString();
  const targetPath = '/rest/v1/' + table + (qs ? '?' + qs : '');

  let res: Response;
  if (isDevMode()) {
    // Stateless dev echo — proves prefix parsing + node routing; live mode proxies below.
    if (method === 'GET') {
      res = jsonResponse(
        [{ id: parsed.uuid, smart_id: smartId, node: conn.prefix, table, simulated: true }],
        200,
        { 'x-bb-node': conn.prefix }
      );
    } else if (method === 'PATCH') {
      let patch: Record<string, unknown> = {};
      try {
        patch = (await req.json()) as Record<string, unknown>;
      } catch {
        return errorResponse({ status: 400, body: { error: 'invalid_json' } }, requestId);
      }
      res = jsonResponse([{ ...patch, id: parsed.uuid, smart_id: smartId, simulated: true }], 200, { 'x-bb-node': conn.prefix });
    } else {
      res = new Response(null, { status: 204, headers: { 'x-bb-node': conn.prefix } });
    }
  } else if (method === 'GET') {
    res = passThrough(await proxyToNode(req, conn, targetPath), conn.prefix);
  } else if (method === 'PATCH') {
    const body = await req.text();
    res = passThrough(
      await proxyToNode(req, conn, targetPath, {
        method: 'PATCH',
        body,
        headers: { 'content-type': 'application/json', prefer: 'return=representation' },
      }),
      conn.prefix
    );
  } else {
    res = passThrough(await proxyToNode(req, conn, targetPath, { method: 'DELETE' }), conn.prefix);
  }

  logRequest({
    rid: requestId,
    method,
    path: '/api/v1/data/' + smartId,
    node: conn.prefix,
    status: res.status,
    ms: Date.now() - start,
  });
  return res;
}
