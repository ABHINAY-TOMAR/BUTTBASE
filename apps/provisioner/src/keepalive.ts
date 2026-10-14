/**
 * Keep-Alive Engine (idea.md §9): ping every active node every 3 days so the
 * 7-day free-tier inactivity pause NEVER fires. Direct REST pings with the node's
 * own service key count as real API traffic; Management health is the secondary signal.
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

export async function runKeepAlive(mgmt: SupabaseManagement, master: MasterDb): Promise<string> {
  const nodes = await master.listRegistry();
  const active = nodes.filter((n) => n.is_active);
  let okCount = 0;
  let pausedCount = 0;

  for (const node of active) {
    let healthy = false;
    let note = '';
    try {
      // 1) direct REST ping — the actual anti-pause signal
      const sr = await nodeServiceKey(node);
      const res = await fetch(node.supabase_url + '/rest/v1/', {
        headers: { apikey: sr, authorization: 'Bearer ' + sr },
        signal: AbortSignal.timeout(10_000),
      });
      healthy = res.ok;
      note = 'rest/' + res.status;
    } catch {
      // 2) secondary signal: Management health endpoint
      try {
        await mgmt.projectHealth(node.project_ref);
        healthy = true;
        note = 'mgmt-health';
      } catch (e) {
        note = 'down: ' + (e instanceof Error ? e.message.slice(0, 120) : String(e));
      }
    }

    await master.updateRegistry(node.id, {
      last_keepalive_at: new Date().toISOString(),
      is_paused: !healthy,
    });

    if (healthy) {
      okCount++;
      console.log('[keepalive] ' + node.node_prefix + ' OK (' + note + ')');
    } else {
      pausedCount++;
      console.warn('[keepalive] ' + node.node_prefix + ' UNHEALTHY (' + note + ')');
      if (autoRestore()) {
        try {
          await mgmt.restoreProject(node.project_ref);
          console.log('[keepalive] ' + node.node_prefix + ' → restore requested');
        } catch (e) {
          console.warn('[keepalive] restore failed for ' + node.node_prefix + ': ' + (e instanceof Error ? e.message.slice(0, 120) : String(e)));
        }
      }
    }
  }

  return 'keepalive: ' + okCount + ' ok, ' + pausedCount + ' unhealthy of ' + active.length + ' active nodes';
}
