/**
 * Keep-Alive Engine (idea.md §9): ping every active node every 3 days so the
 * 7-day free-tier inactivity pause NEVER fires. Direct REST pings with the node's
 * own service key count as real API traffic; Management health is the secondary signal.
 *
 * FLAW-11 FIX: Retry up to 3 times before marking a node unhealthy to prevent
 * false-positive pause marking due to transient network hiccups.
 */
import { decryptText, deriveKey } from '@buttbase/encryption';
import type { RegistryNode } from '@buttbase/shared-types';
import { autoRestore, encryptionKeyRaw } from './env';
import type { SupabaseManagement } from './management';
import type { MasterDb } from './master';

async function nodeServiceKey(node: RegistryNode): Promise<string> {
  if (node.service_role_key_encrypted.startsWith('dev:')) return node.service_role_key_encrypted.slice(4);
  return decryptText(node.service_role_key_encrypted, await deriveKey(encryptionKeyRaw()));
}

async function pingWithRetry(
  node: RegistryNode,
  serviceKey: string,
  mgmt: SupabaseManagement,
  maxAttempts = 3
): Promise<{ healthy: boolean; note: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(node.supabase_url + '/rest/v1/', {
        headers: { apikey: serviceKey, authorization: 'Bearer ' + serviceKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return { healthy: true, note: 'rest/' + res.status };
      // 503 from Supabase = paused; don't retry
      if (res.status === 503) break;
    } catch {
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
  }
  // Secondary: Management health endpoint
  try {
    await mgmt.projectHealth(node.project_ref);
    return { healthy: true, note: 'mgmt-health' };
  } catch (e) {
    return { healthy: false, note: 'down: ' + (e instanceof Error ? e.message.slice(0, 120) : String(e)) };
  }
}

export async function runKeepAlive(mgmt: SupabaseManagement, master: MasterDb): Promise<string> {
  const nodes = await master.listRegistry();
  const active = nodes.filter((n) => n.is_active);
  let okCount = 0;
  let pausedCount = 0;

  for (const node of active) {
    const sr = await nodeServiceKey(node);
    const { healthy, note } = await pingWithRetry(node, sr, mgmt);

    await master.updateRegistry(node.id, {
      last_keepalive_at: new Date().toISOString(),
      is_paused: !healthy,
    });

    if (healthy) {
      okCount++;
      console.log('[keepalive] ' + node.node_prefix + ' OK (' + note + ')');
    } else {
      pausedCount++;
      console.warn('[keepalive] ' + node.node_prefix + ' UNHEALTHY after 3 attempts (' + note + ')');
      if (autoRestore()) {
        try {
          await mgmt.restoreProject(node.project_ref);
          console.log('[keepalive] ' + node.node_prefix + ' → restore requested');
        } catch (e) {
          console.warn(
            '[keepalive] restore failed for ' +
              node.node_prefix +
              ': ' +
              (e instanceof Error ? e.message.slice(0, 120) : String(e))
          );
        }
      }
    }
  }

  return 'keepalive: ' + okCount + ' ok, ' + pausedCount + ' unhealthy of ' + active.length + ' active nodes';
}
