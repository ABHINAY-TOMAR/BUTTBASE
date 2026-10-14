/**
 * Registry access for the gateway — TTL-cached, Master DB NEVER on the per-request hot path
 * (idea.md §18 DO-2). Keys are decrypted once per cache refresh and live only in memory.
 */
import {
  pickWriteNode,
  type NodeCategory,
  type RegistryNode,
} from '@buttbase/shared-types';
import { decryptText, keyFromEnv } from '@buttbase/encryption';
import { isDevMode, masterKey, masterUrl } from './env';
import { seedNodes } from './seed';

export interface NodeConnection {
  prefix: string;
  supabase_url: string;
  serviceRoleKey: string;
  data_type: NodeCategory;
  is_paused: boolean;
}

let cachedNodes: RegistryNode[] = [];
let cachedAt = 0;
const keyCache = new Map<string, string>();

function ttlMs(): number {
  return Number(process.env.BB_REGISTRY_TTL_MS ?? 60000);
}

async function fetchMasterNodes(): Promise<RegistryNode[]> {
  const url = masterUrl() + '/rest/v1/projects_registry?select=*';
  const res = await fetch(url, {
    headers: { apikey: masterKey(), authorization: 'Bearer ' + masterKey() },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('master registry fetch failed: HTTP ' + res.status);
  return (await res.json()) as RegistryNode[];
}

export async function listNodes(force = false): Promise<RegistryNode[]> {
  if (!force && cachedNodes.length && Date.now() - cachedAt < ttlMs()) return cachedNodes;
  cachedNodes = isDevMode() ? seedNodes() : await fetchMasterNodes();
  cachedAt = Date.now();
  keyCache.clear();
  return cachedNodes;
}

async function serviceKeyFor(node: RegistryNode): Promise<string> {
  const hit = keyCache.get(node.node_prefix);
  if (hit) return hit;
  const envelope = node.service_role_key_encrypted;
  const key = envelope.startsWith('dev:')
    ? envelope.slice(4)
    : await decryptText(envelope, await keyFromEnv(process.env.REGISTRY_ENCRYPTION_KEY));
  keyCache.set(node.node_prefix, key);
  return key;
}

export async function resolveByPrefix(prefix: string): Promise<RegistryNode | null> {
  const nodes = await listNodes();
  return nodes.find((n) => n.node_prefix === prefix) ?? null;
}

export async function connectionOf(node: RegistryNode): Promise<NodeConnection> {
  return {
    prefix: node.node_prefix,
    supabase_url: node.supabase_url.replace(/\/$/, ''),
    serviceRoleKey: await serviceKeyFor(node),
    data_type: node.data_type,
    is_paused: node.is_paused,
  };
}

/** Capacity manager (idea.md §6): writable node with the most free space for a category. */
export async function pickWriteConnection(dataType: NodeCategory): Promise<NodeConnection | null> {
  const nodes = await listNodes();
  const picked = pickWriteNode(nodes, dataType);
  return picked ? connectionOf(picked) : null;
}
