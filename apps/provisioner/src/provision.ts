/**
 * Zero-touch provisioning (idea.md §8, ADR-004 — verified against the Management API).
 * You only ever type a node name + category; this module does the rest:
 * pick/create org → create project → poll cold boot → keys → encrypt → register.
 */
import { deriveKey, encryptText } from '@buttbase/encryption';
import { suggestPrefix, type ProvisionJob } from '@buttbase/shared-types';
import { encryptionKeyRaw, regionCode } from './env';
import { fetchNodeKeys } from './keys';
import { projectRef, type MgmtOrganization, type SupabaseManagement } from './management';
import type { MasterDb } from './master';

/** Free orgs cap at 2 ACTIVE projects — rotate orgs when full. */
const FREE_ACTIVE_PROJECTS_PER_ORG = 2;
const COLD_BOOT_TIMEOUT_MS = 15 * 60_000;
const COLD_BOOT_POLL_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDbPassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(28));
  let out = 'Bb1!';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function waitUntilActive(
  mgmt: SupabaseManagement,
  ref: string,
  timeoutMs = COLD_BOOT_TIMEOUT_MS,
  pollMs = COLD_BOOT_POLL_MS
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const project = await mgmt.getProject(ref);
    const status = (project.status ?? '').toUpperCase();
    if (status === 'ACTIVE') return;
    if (status === 'PAUSED' || status === 'DELETED' || Date.now() > deadline) {
      throw new Error('project ' + ref + ' never became ACTIVE (last status: ' + status + ')');
    }
    await sleep(pollMs);
  }
}

async function pickOrg(mgmt: SupabaseManagement): Promise<MgmtOrganization> {
  const [orgs, projects] = await Promise.all([mgmt.listOrganizations(), mgmt.listProjects()]);
  const activePerOrg = new Map<string, number>();
  for (const p of projects) {
    if (!p.organization_id) continue;
    if ((p.status ?? '').toUpperCase() === 'ACTIVE') {
      activePerOrg.set(p.organization_id, (activePerOrg.get(p.organization_id) ?? 0) + 1);
    }
  }
  const withCapacity = orgs.find((o) => (activePerOrg.get(o.id) ?? 0) < FREE_ACTIVE_PROJECTS_PER_ORG);
  if (withCapacity) return withCapacity;
  // All orgs full → create a fresh free org (research-verified: POST /v1/organizations)
  const created = await mgmt.createOrganization('buttbase-org-' + Date.now().toString(36));
  console.log('[provision] all orgs full → created org ' + created.name);
  return created;
}

export async function provisionNode(job: ProvisionJob, mgmt: SupabaseManagement, master: MasterDb): Promise<string> {
  const category = job.requested_data_type;

  // 1) org with capacity (rotate free orgs)
  const org = await pickOrg(mgmt);
  const orgSlug = org.slug ?? org.id;

  // 2) next prefix from the registry
  const registry = await master.listRegistry();
  const prefix = suggestPrefix(category, registry.map((n) => n.node_prefix));
  const name = (job.requested_name ?? 'buttbase-' + prefix).slice(0, 60);

  // 3) create project (db_pass generated, region via region_selection — deprecated 'region' avoided)
  const project = await mgmt.createProject({
    name,
    db_pass: randomDbPassword(),
    organization_slug: orgSlug,
    region_selection: { type: 'specific', code: regionCode() },
  });
  const ref = projectRef(project);
  console.log('[provision] created project ' + name + ' (' + ref + ') in org ' + org.name);

  // 4) cold boot is 2–5 min → poll every 20 s
  await waitUntilActive(mgmt, ref);
  console.log('[provision] project ACTIVE — fetching keys');

  // 5) keys → encrypt at rest (AES-256-GCM)
  const keys = await fetchNodeKeys(mgmt, ref);
  const encKey = await deriveKey(encryptionKeyRaw());
  const [serviceRoleEncrypted, anonEncrypted] = await Promise.all([
    encryptText(keys.serviceRole, encKey),
    encryptText(keys.anon, encKey),
  ]);

  // 6) register in the Master registry → node goes live for the gateway cache
  const row = await master.insertRegistry({
    node_prefix: prefix,
    node_name: name,
    data_type: category,
    supabase_url: 'https://' + ref + '.supabase.co',
    service_role_key_encrypted: serviceRoleEncrypted,
    anon_key_encrypted: anonEncrypted,
    organization_slug: orgSlug,
    project_ref: ref,
    region: regionCode(),
    storage_limit_mb: 500,
    egress_limit_gb: 5,
  });
  const finalPrefix = row?.node_prefix ?? prefix;
  console.log('[provision] registered node ' + finalPrefix + ' → ' + (row?.supabase_url ?? ''));
  return finalPrefix;
}
