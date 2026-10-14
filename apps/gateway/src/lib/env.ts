/** Gateway environment. BB_DEV_MODE=1 (or missing Master env) → mock registry + open auth. */
export function masterUrl(): string {
  return (process.env.MASTER_SUPABASE_URL ?? '').replace(/\/$/, '');
}
export function masterKey(): string {
  return process.env.MASTER_SERVICE_ROLE_KEY ?? '';
}
export function isDevMode(): boolean {
  if (process.env.BB_DEV_MODE === '1') return true;
  if (process.env.BB_DEV_MODE === '0') return false;
  return !masterUrl() || !masterKey();
}
