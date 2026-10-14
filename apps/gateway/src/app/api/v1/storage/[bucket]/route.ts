/**
 * PUT /api/v1/storage/{bucket}?type=images   (idea.md §12)
 * Upload path: gateway picks the node, generates the object key (uuid),
 * and returns the Smart ID. Body is buffered (free-tier files cap at 50 MB)
 * to stay compatible with every edge runtime; downloads stream through.
 */
import { buildSmartId, ERR, NODE_CATEGORIES, type NodeCategory } from '@buttbase/shared-types';
import { requireAuth } from '@/lib/auth';
import { isDevMode } from '@/lib/env';
import { errorResponse, jsonResponse, logRequest, rid } from '@/lib/http';
import { pickWriteConnection } from '@/lib/registry';
import { passThrough, proxyToNode } from '@/lib/proxy';

export const runtime = 'edge';

const BUCKET_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;

type Params = { params: Promise<{ bucket: string }> };

export async function PUT(req: Request, ctx: Params) {
  const start = Date.now();
  const requestId = rid(req);

  const authFail = await requireAuth(req);
  if (authFail) return authFail;

  const { bucket } = await ctx.params;
  if (!BUCKET_RE.test(bucket)) {
    return errorResponse({ status: 400, body: { error: 'bad_bucket' } }, requestId);
  }

  const sp = new URL(req.url).searchParams;
  const type = (sp.get('type') ?? 'mixed') as NodeCategory;
  if (!(NODE_CATEGORIES as readonly string[]).includes(type)) {
    return errorResponse({ status: ERR.BAD_TYPE.status, body: { error: ERR.BAD_TYPE.code } }, requestId);
  }

  const conn = await pickWriteConnection(type);
  if (!conn) {
    return errorResponse(
      { status: ERR.NO_NODE.status, body: { error: ERR.NO_NODE.code, node: type } },
      requestId
    );
  }

  const uuid = crypto.randomUUID();
  const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = await req.arrayBuffer();

  if (isDevMode()) {
    // stateless — nothing to store in dev; live mode uploads to the real node below
  } else {
    const upstream = await proxyToNode(req, conn, '/storage/v1/object/' + bucket + '/' + uuid, {
      method: 'PUT',
      body: bytes,
      headers: { 'content-type': contentType },
    });
    if (!upstream.ok) {
      logRequest({ rid: requestId, method: 'PUT', path: '/api/v1/storage/' + bucket, node: conn.prefix, status: upstream.status, ms: Date.now() - start });
      return passThrough(upstream, conn.prefix);
    }
  }

  const smartId = buildSmartId(conn.prefix, uuid);
  logRequest({ rid: requestId, method: 'PUT', path: '/api/v1/storage/' + bucket, node: conn.prefix, status: 201, ms: Date.now() - start });
  return jsonResponse(
    { id: smartId, bucket, key: bucket + '/' + uuid },
    201,
    { 'x-bb-node': conn.prefix, 'x-bb-request-id': requestId }
  );
}
