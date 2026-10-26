/**
 * Registry access for the gateway — Redis L1 + in-memory L2 + Master DB as source of truth.
 *
 * FLAW-02 FIX: Shared Upstash Redis cache eliminates per-instance Master DB hammering.
 *   100 Vercel edge instances → 1 shared cache, not 100 independent Master DB queries/min.
 *
 * FLAW-09 FIX: Scoped column select — anon_key_encrypted never fetched by the gateway
 *   (gateway only ever needs service_role key; anon key blob is unnecessary log exposure).
 *
 * Keys are decrypted once per local cache refresh and live only in process memory
 * (never written to Redis — encrypted blobs are written, decrypted strings are not).
 * idea.md §18 DO-2: Master DB NEVER on the per-request hot path.
 */
import {
  pickWriteNode,
  type NodeCategory,
  type RegistryNode,
} from '@buttbase/shared-types';
import { decryptText, keyFromEnv } from '@buttbase/encryption';
import { isDevMode, masterKey, masterUrl } from './env';
import { redisClient, REGISTRY_KEY } from './redis';
import { seedNodes } from './seed';

export interface NodeConnection {
  prefix: string;
  supabase_url: string;
  serviceRoleKey: string;
  data_type: NodeCategory;
  is_paused: boolean;
}

// In-memory L2 cache (per-instance, short TTL)
let cachedNodes: RegistryNode[] = [];
let cachedAt = 0;
const keyCache = new Map<string, string>();

function ttlMs(): number {
  return Number(process.env.BB_REGISTRY_TTL_MS ?? 60_000);
}
function redisTtlSec(): number {
  return Math.ceil(ttlMs() / 1000);
}

// Columns the gateway actually needs — anon_key_encrypted deliberately excluded (FLAW-09)
const SELECT_COLS = [
  'id', 'node_prefix', 'node_name', 'data_type', 'supabase_url',
  'service_role_key_encrypted', 'is_active', 'is_paused',
  'storage_used_mb', 'storage_limit_mb', 'egress_used_gb', 'egress_limit_gb',
  'organization_slug', 'project_ref', 'region',
  'last_keepalive_at', 'last_provisioned_at', 'created_at',
].join(',');

async function fetchMasterNodes(): Promise<RegistryNode[]> {
  const url = masterUrl() + '/rest/v1/projects_registry?select=' + SELECT_COLS;
  const res = await fetch(url, {
    headers: { apikey: masterKey(), authorization: 'Bearer ' + masterKey() },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('master registry fetch failed: HTTP ' + res.status);
  return (await res.json()) as RegistryNode[];
}

async function refreshFromMaster(): Promise<RegistryNode[]> {
  const nodes = await fetchMasterNodes();
  // Write encrypted blobs to Redis — safe to cache, never decrypt in Redis layer
  const redis = redisClient();
  if (redis) {
    await redis.set(REGISTRY_KEY, JSON.stringify(nodes), { ex: redisTtlSec() }).catch((e) => {
      console.warn('[registry] redis write failed (non-fatal): ' + String(e));
    });
  }
  return nodes;
}

export async function listNodes(force = false): Promise<RegistryNode[]> {
  // L2: in-memory hit (fastest path)
  if (!force && cachedNodes.length && Date.now() - cachedAt < ttlMs()) return cachedNodes;

  if (isDevMode()) {
    cachedNodes = seedNodes();
    cachedAt = Date.now();
    keyCache.clear();
    return cachedNodes;
  }

  // L1: Redis hit (shared across all edge instances)
  const redis = redisClient();
  if (!force && redis) {
    try {
      const raw = await redis.get<string>(REGISTRY_KEY);
      if (raw) {
        const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as RegistryNode[];
        if (Array.isArray(parsed) && parsed.length) {
          cachedNodes = parsed;
          cachedAt = Date.now();
          keyCache.clear();
          return cachedNodes;
        }
      }
    } catch (e) {
      console.warn('[registry] redis read failed, falling back to Master DB: ' + String(e));
    }
  }

  // Source of truth: Master DB
  cachedNodes = await refreshFromMaster();
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
