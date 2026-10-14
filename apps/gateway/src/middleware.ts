/**
 * Gateway middleware: request ID injection + per-user rate limiting.
 * FLAW-05 FIX: Sliding window rate limit via Upstash Redis (JWT sub or IP fallback).
 * Gracefully disabled when Redis env vars are absent or in dev mode.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _rl: Ratelimit | null = null;

function ratelimiter(): Ratelimit | null {
  if (_rl) return _rl;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || process.env.BB_DEV_MODE === '1') return null;
  const rpm = Number(process.env.BB_RATE_LIMIT_RPM ?? 100);
  _rl = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(rpm, '60 s'),
    analytics: false,
    prefix: 'bb:rl',
  });
  return _rl;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'anon';
}

/** Extract JWT sub claim without verifying (verification happens in route handlers). */
function jwtSub(req: NextRequest): string {
  const auth = req.headers.get('authorization') ?? '';
  const clientIp = getClientIp(req);
  if (!auth.toLowerCase().startsWith('bearer ')) return clientIp;
  const token = auth.slice(7).trim();
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload?.sub === 'string' ? payload.sub : clientIp;
  } catch {
    return clientIp;
  }
}

export async function middleware(req: NextRequest) {
  const requestRid = req.headers.get('x-bb-request-id') ?? crypto.randomUUID();
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-bb-request-id', requestRid);

  // Rate limiting (gracefully skipped if Redis not configured)
  const rl = ratelimiter();
  if (rl) {
    const identifier = jwtSub(req);
    const { success, limit, remaining, reset } = await rl.limit(identifier);
    if (!success) {
      return new NextResponse(
        JSON.stringify({ error: 'rate_limit_exceeded', retry_after: Math.ceil((reset - Date.now()) / 1000) }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'x-bb-request-id': requestRid,
            'x-ratelimit-limit': String(limit),
            'x-ratelimit-remaining': String(remaining),
            'x-ratelimit-reset': String(reset),
          },
        }
      );
    }
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('x-bb-request-id', requestRid);
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
