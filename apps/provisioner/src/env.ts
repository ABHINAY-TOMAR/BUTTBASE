/** Provisioner environment — the provisioner only ever runs LIVE (no dev mocks). */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error('Missing env ' + name + ' — the provisioner needs the live Master + PAT (see .env.example)');
  return v;
}

export function pat(): string {
  return requireEnv('SUPABASE_MANAGEMENT_PAT');
}
export function masterUrl(): string {
  return requireEnv('MASTER_SUPABASE_URL').replace(/\/$/, '');
}
export function masterKey(): string {
  return requireEnv('MASTER_SERVICE_ROLE_KEY');
}
export function regionCode(): string {
  return process.env.BB_DEFAULT_REGION ?? 'ap-south-1';
}
export function maxPerDay(): number {
  return Math.max(1, Number(process.env.PROVISION_MAX_PER_DAY ?? 2));
}
export function encryptionKeyRaw(): string {
  return requireEnv('REGISTRY_ENCRYPTION_KEY');
}
export function pollIntervalMs(): number {
  return Number(process.env.BB_PROVISION_POLL_MS ?? 20_000);
}
export function keepaliveEveryMs(): number {
  return Number(process.env.BB_KEEPALIVE_EVERY_MS ?? 72 * 3_600_000); // 3 days (idea.md §9)
}
export function autoRestore(): boolean {
  return (process.env.BB_RESTORE_ON_PAUSE ?? '1') === '1';
}
