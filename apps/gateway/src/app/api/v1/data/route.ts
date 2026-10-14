/**
 * POST /api/v1/data?type=images&table=profile_pics   (idea.md §12)
 * Write path: pick the node with the most free capacity for the category,
 * inject a gateway-generated uuid as the row id, and return the Smart ID.
 */
import {
  buildSmartId,
  ERR,
  NODE_CATEGORIES,
  type NodeCategory,
} from '@buttbase/shared-types';
import { requireAuth } from '@/lib/auth';
import { isDevMode } from '@/lib/env';
import { errorResponse, jsonResponse, logRequest, rid } from '@/lib/http';
import { pickWriteConnection } from '@/lib/registry';
import { passThrough, proxyToNode } from '@/lib/proxy';

export const runtime = 'edge';

const TABLE_RE = /^[a-z_][a-z0-9_]{0,62}$/;

export async function POST(req: Request) {
  const start = Date.now();
  const requestId = rid(req);

  const authFail = await requireAuth(req);
  if (authFail) return authFail;

  const sp = new URL(req.url).searchParams;
  const table = sp.get('table') ?? '';
  const type = (sp.get('type') ?? 'mixed') as NodeCategory;

  if (!TABLE_RE.test(table)) {
    return errorResponse({ status: ERR.BAD_TABLE.status, body: { error: ERR.BAD_TABLE.code } }, requestId);
  }
  if (!(NODE_CATEGORIES as readonly string[]).includes(type)) {
    return errorResponse({ status: ERR.BAD_TYPE.status, body: { error: ERR.BAD_TYPE.code } }, requestId);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse({ status: 400, body: { error: 'invalid_json' } }, requestId);
  }

  const conn = await pickWriteConnection(type);
  if (!conn) {
    logRequest({ rid: requestId, method: 'POST', path: '/api/v1/data', node: type, status: ERR.NO_NODE.status, ms: Date.now() - start });
    return errorResponse(
      { status: ERR.NO_NODE.status, body: { error: ERR.NO_NODE.code, node: type } },
      requestId
    );
  }

  // The routing decision is born with the data: prefix + uuid (ADR-001)
  const uuid = crypto.randomUUID();
  const row: Record<string, unknown> = { ...body, id: uuid };
  const smartId = buildSmartId(conn.prefix, uuid);

  let inserted: Record<string, unknown> = row;
  let status = 201;

  if (isDevMode()) {
    // stateless echo — live mode proxies to the real node below
  } else {
    const upstream = await proxyToNode(req, conn, '/rest/v1/' + table, {
      method: 'POST',
      body: JSON.stringify(row),
      headers: { 'content-type': 'application/json', prefer: 'return=representation' },
    });
    if (!upstream.ok) {
      logRequest({ rid: requestId, method: 'POST', path: '/api/v1/data', node: conn.prefix, status: upstream.status, ms: Date.now() - start });
      return passThrough(upstream, conn.prefix);
    }
    const res = await upstream.json();
    inserted = (Array.isArray(res) ? res[0] : res) as Record<string, unknown>;
  }

  logRequest({ rid: requestId, method: 'POST', path: '/api/v1/data', node: conn.prefix, status, ms: Date.now() - start });
  return jsonResponse({ id: smartId, node: conn.prefix, row: inserted }, status, { 'x-bb-node': conn.prefix, 'x-bb-request-id': requestId });
}
