/**
 * Identity-provider pattern (idea.md §7, ADR-003): verify the MASTER JWT once per request.
 * Dev mode accepts any bearer token and stamps the response — never enable in prod.
 */
import { ERR } from '@buttbase/shared-types';
import { isDevMode, masterKey, masterUrl } from './env';
import { errorResponse, rid } from './http';

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Returns null when authorized, or a 401 Response when not. */
export async function requireAuth(req: Request): Promise<Response | null> {
  if (isDevMode()) return null;
  const token = bearerToken(req);
  if (!token) return errorResponse({ status: ERR.UNAUTHORIZED.status, body: { error: ERR.UNAUTHORIZED.code } }, rid(req));
  try {
    const res = await fetch(masterUrl() + '/auth/v1/user', {
      headers: { apikey: masterKey(), authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 200) return null;
  } catch {
    /* master unreachable → fail closed */
  }
  return errorResponse({ status: ERR.UNAUTHORIZED.status, body: { error: ERR.UNAUTHORIZED.code } }, rid(req));
}
