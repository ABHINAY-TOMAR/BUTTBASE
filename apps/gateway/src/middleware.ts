/** Request-id + basic timing on every gateway call (feeds Edge Logs; ADR-002). */
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const requestRid = req.headers.get('x-bb-request-id') ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-bb-request-id', requestRid);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('x-bb-request-id', requestRid);
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
