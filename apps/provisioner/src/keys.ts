/**
 * Node key extraction — defensive by design.
 * TODO(live-verify): the exact api-keys response shape needs one live-PAT run
 * (docs/research-notes.md SS5). If heuristics miss, we fail LOUDLY (queue job → failed)
 * instead of storing empty keys.
 */
import type { SupabaseManagement } from './management';

export interface NodeKeys {
  anon: string;
  serviceRole: string;
}

function pickSecret(entry: Record<string, unknown>): string | undefined {
  if (typeof entry.secret === 'string') return entry.secret;
  if (typeof entry.api_key === 'string') return entry.api_key;
  if (typeof entry.value === 'string') return entry.value;
  return undefined;
}

export async function fetchNodeKeys(mgmt: SupabaseManagement, ref: string): Promise<NodeKeys> {
  const raw = await mgmt.listApiKeys(ref);
  const entries = Array.isArray(raw) ? (raw as unknown[]) : [];

  let anon: string | undefined;
  let serviceRole: string | undefined;

  for (const item of entries) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const secret = pickSecret(e);
    if (!secret) continue;
    const label = String(e.name ?? e.description ?? '').toLowerCase();
    const role = String(e.role ?? '').toLowerCase();

    if (
      role.includes('service') ||
      label.includes('service_role') ||
      label.includes('service role')
    ) {
      serviceRole ??= secret;
    } else if (
      label.includes('anon') ||
      role === 'anon' ||
      label.includes('publishable')
    ) {
      anon ??= secret;
    }
  }

  if (!anon || !serviceRole) {
    throw new Error(
      'fetchNodeKeys: could not extract anon + service_role from Management API response.\n' +
        'Raw entry count: ' +
        entries.length +
        '\n' +
        'Entry keys seen: ' +
        JSON.stringify(entries.map((e) => (e && typeof e === 'object' ? Object.keys(e as Record<string, unknown>) : typeof e))).slice(0, 500) +
        '\n' +
        'Full response (first 1000 chars): ' +
        JSON.stringify(entries).slice(0, 1000) +
        '\n' +
        'Docs: docs/research-notes.md §5 — run `tsx src/index.ts queue-once` with a real PAT to verify.'
    );
  }

  // Sanity check: keys must look like JWTs (three segments separated by dots)
  const JWT_RE = /^[\w-]+\.[\w-]+\.[\w-]+$/;
  if (!JWT_RE.test(serviceRole)) {
    throw new Error('fetchNodeKeys: service_role key does not look like a JWT — value starts with: ' + serviceRole.slice(0, 20));
  }
  if (!JWT_RE.test(anon)) {
    throw new Error('fetchNodeKeys: anon key does not look like a JWT — value starts with: ' + anon.slice(0, 20));
  }

  return { anon, serviceRole };
}
