/**
 * The transparent proxy core (deep module): forward method/headers/body to a node with its
 * service_role key, stream the response back, map failures to clean errors — the node's
 * xyz.supabase.co URL must never leak (idea.md §18 DON'T-5/DO-5).
 */
import { ERR } from '@buttbase/shared-types';
import type { NodeConnection } from './registry';
import { errorResponse, rid } from './http';

const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'content-length', 'cookie', 'x-bb-request-id',
]);

export function nodeTimeoutMs(): number {
  return Number(process.env.BB_NODE_TIMEOUT_MS ?? 30000);
}

function upstreamHeaders(req: Request, node: NodeConnection, extra?: Record<string, string>): Headers {
  const h = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key)) h.set(key, value);
  });
  h.delete('authorization');
  h.set('apikey', node.serviceRoleKey);
  h.set('authorization', 'Bearer ' + node.serviceRoleKey);
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

export interface ProxyOptions {
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
}

export async function proxyToNode(
  req: Request,
  node: NodeConnection,
  targetPath: string,
  opts: ProxyOptions = {}
): Promise<Response> {
  const target = node.supabase_url + targetPath;
  const method = opts.method ?? req.method;
  try {
    return await fetch(target, {
      method,
      headers: upstreamHeaders(req, node, opts.headers),
      body: opts.body ?? undefined,
      signal: AbortSignal.timeout(nodeTimeoutMs()),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const aborted = name === 'TimeoutError' || name === 'AbortError';
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'bb.gateway.node_error',
        node: node.prefix,
        reason: aborted ? 'timeout' : 'fetch_failed',
        message: e instanceof Error ? e.message : String(e),
      })
    );
    return errorResponse(
      { status: ERR.NODE_UNAVAILABLE.status, body: { error: ERR.NODE_UNAVAILABLE.code, node: node.prefix } },
      rid(req)
    );
  }
}

/** Pass an upstream response through, tagging it with the node prefix (never the URL). */
export function passThrough(upstream: Response, prefix: string): Response {
  const res = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: upstream.headers });
  res.headers.set('x-bb-node', prefix);
  return res;
}
