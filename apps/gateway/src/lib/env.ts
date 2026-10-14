/**
 * Gateway environment.
 * FLAW-13 FIX: Emit a loud warning when dev mode activates via missing env vars.
 * BB_DEV_MODE=1 → mock registry + open auth (dev only).
 * BB_DEV_MODE=0 → always production, even without Master env vars.
 * Unset + Master env present → production. Unset + Master env absent → dev with warning.
 */
export function masterUrl(): string {
  return (process.env.MASTER_SUPABASE_URL ?? '').replace(/\/$/, '');
}
export function masterKey(): string {
  return process.env.MASTER_SERVICE_ROLE_KEY ?? '';
}
/**
 * Supabase project JWT secret (HS256 projects) or leave blank to use JWKS (RS256).
 * Found at: Supabase Dashboard → Project Settings → API → JWT Secret.
 */
export function masterJwtSecret(): string {
  return process.env.MASTER_SUPABASE_JWT_SECRET ?? '';
}
export function isDevMode(): boolean {
  if (process.env.BB_DEV_MODE === '1') return true;
  if (process.env.BB_DEV_MODE === '0') return false;
  const devFallback = !masterUrl() || !masterKey();
  if (devFallback) {
    // Only warn once (module is cached in the edge runtime)
    console.warn(
      '[buttbase] ⚠️  DEV MODE ACTIVE — auth is OPEN, no data is persisted. ' +
      'Set BB_DEV_MODE=0 and provide MASTER_SUPABASE_URL + MASTER_SERVICE_ROLE_KEY for production.'
    );
  }
  return devFallback;
}
