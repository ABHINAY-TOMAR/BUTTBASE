/**
 * Identity-provider pattern (idea.md §7, ADR-003): verify the MASTER JWT once per request.
 *
 * FLAW-01 FIX: replaced the per-request /auth/v1/user network call with local JWT verification.
 *   - HS256 projects (most): verify with MASTER_SUPABASE_JWT_SECRET — zero network calls.
 *   - RS256 projects: verify via JWKS endpoint — fetched once and cached in-memory by jose.
 *
 * Either way the Master DB is never hit on the per-request hot path (idea.md §18 DO-2).
 * Dev mode accepts any bearer token and stamps the response — never enable in prod.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ERR } from '@buttbase/shared-types';
import { isDevMode, masterJwtSecret, masterUrl } from './env';
import { errorResponse, rid } from './http';

// JWKS set — fetched once, cached in-memory per edge instance lifetime.
// jose auto-refreshes on RS256 key rotation (respects cache-control headers).
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    // Supabase exposes a standard JWKS at /auth/v1/.well-known/jwks.json
    _jwks = createRemoteJWKSet(
      new URL(masterUrl() + '/auth/v1/.well-known/jwks.json')
    );
  }
  return _jwks;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Returns null when authorized, or a 401 Response when not. */
export async function requireAuth(req: Request): Promise<Response | null> {
  if (isDevMode()) return null;

  const token = bearerToken(req);
  if (!token) {
    return errorResponse({ status: ERR.UNAUTHORIZED.status, body: { error: ERR.UNAUTHORIZED.code } }, rid(req));
  }

  try {
    const secret = masterJwtSecret();
    if (secret) {
      // HS256 path: verify with shared secret — no network call whatsoever
      await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    } else {
      // RS256 path: verify via JWKS (first request fetches + caches, all subsequent are local)
      await jwtVerify(token, getJwks(), {
        issuer: masterUrl() + '/auth/v1',
      });
    }
    return null; // authorized ✓
  } catch (e) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        kind: 'bb.gateway.auth_fail',
        reason: e instanceof Error ? e.message.slice(0, 200) : String(e),
      })
    );
    return errorResponse({ status: ERR.UNAUTHORIZED.status, body: { error: ERR.UNAUTHORIZED.code } }, rid(req));
  }
}
