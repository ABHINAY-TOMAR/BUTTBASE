/** Response helpers + one-line request logging (idea.md §18 DO-5/DO-6). */
import { gatewayError, type GatewayErrorResponse } from '@buttbase/shared-types';

export function rid(req: Request): string {
  return req.headers.get('x-bb-request-id') ?? 'n/a';
}

export function errorResponse(er: GatewayErrorResponse, requestId?: string): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (requestId) headers['x-bb-request-id'] = requestId;
  if (er.body.node) headers['x-bb-node'] = er.body.node;
  return new Response(JSON.stringify(er.body), { status: er.status, headers });
}

export function jsonResponse(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...(extra ?? {}) },
  });
}

export function logRequest(fields: {
  rid: string;
  method: string;
  path: string;
  node?: string;
  status: number;
  ms: number;
}): void {
  // Structured single-line log — feeds Edge Logs / observability later (Master stays off the hot path).
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), kind: 'bb.gateway', ...fields })
  );
}

export { gatewayError };
