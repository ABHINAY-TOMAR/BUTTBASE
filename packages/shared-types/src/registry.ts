/** Registry contracts (idea.md §4.2, §11) — column names match supabase/schema.sql. */
import type { NodeCategory } from './smart-id.js';

export interface RegistryNode {
  id: string;
  node_prefix: string;
  node_name: string;
  data_type: NodeCategory;
  supabase_url: string;
  organization_slug: string;
  project_ref: string;
  region: string | null;
  /** AES-256-GCM envelopes (packages/encryption). Decrypted server-side only, never serialized to clients. */
  service_role_key_encrypted: string;
  anon_key_encrypted: string;
  storage_used_mb: number;
  storage_limit_mb: number;
  egress_used_gb: number;
  egress_limit_gb: number;
  is_active: boolean;
  is_paused: boolean;
  last_keepalive_at: string | null;
  last_provisioned_at: string | null;
  created_at: string;
}

export interface ProvisionJob {
  id: string;
  requested_data_type: NodeCategory;
  requested_name: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  provisioning_project_ref?: string | null;
  result_node_prefix: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

/**
 * The one interface every registry adapter satisfies (codebase-design seam).
 * Two adapters ship in this repo: InMemoryRegistry (dev/mock) and the
 * PostgREST-backed Master registry (gateway cache source + dashboard/provisioner).
 */
export interface RegistryService {
  getByPrefix(prefix: string): Promise<RegistryNode | null>;
  listActive(dataType?: NodeCategory): Promise<RegistryNode[]>;
  listAll(): Promise<RegistryNode[]>;
}

/** In-memory adapter — dev mode, tests, dashboard seed. */
export class InMemoryRegistry implements RegistryService {
  constructor(private readonly nodes: RegistryNode[]) {}
  async getByPrefix(prefix: string): Promise<RegistryNode | null> {
    return this.nodes.find((n) => n.node_prefix === prefix) ?? null;
  }
  async listActive(dataType?: NodeCategory): Promise<RegistryNode[]> {
    return this.nodes.filter((n) => n.is_active && (dataType ? n.data_type === dataType : true));
  }
  async listAll(): Promise<RegistryNode[]> {
    return [...this.nodes];
  }
}

export const CAPACITY_WARN_PCT = 75;
export const CAPACITY_FULL_PCT = 90;

export function storagePct(node: Pick<RegistryNode, 'storage_used_mb' | 'storage_limit_mb'>): number {
  if (!node.storage_limit_mb) return 0;
  return (node.storage_used_mb / node.storage_limit_mb) * 100;
}

export function isNearlyFull(node: RegistryNode, thresholdPct: number = CAPACITY_FULL_PCT): boolean {
  return storagePct(node) >= thresholdPct;
}

/** Capacity manager (idea.md §6): most-free-space writable node for a category. */
export function pickWriteNode(nodes: readonly RegistryNode[], dataType: NodeCategory): RegistryNode | null {
  let best: RegistryNode | null = null;
  let bestFreeMb = -1;
  for (const n of nodes) {
    if (n.data_type !== dataType || !n.is_active || n.is_paused || isNearlyFull(n)) continue;
    const freeMb = n.storage_limit_mb - n.storage_used_mb;
    if (freeMb > bestFreeMb) {
      bestFreeMb = freeMb;
      best = n;
    }
  }
  return best;
}
