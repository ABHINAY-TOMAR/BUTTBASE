/** Dev-mode fixtures — the dashboard runs with zero credentials (idea.md SS3 data-mode decision). */
import type { RegistryNode } from '@buttbase/shared-types';

export interface LogLine {
  ts: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  node: string;
}

const HOUR = 3_600_000;

function node(partial: Partial<RegistryNode>): RegistryNode {
  return {
    id: 'dev-' + partial.node_prefix,
    node_prefix: 'img01',
    node_name: 'Dev node',
    data_type: 'images',
    supabase_url: 'https://img01.buttbase.dev',
    organization_slug: 'buttbase-dev-org',
    project_ref: 'devrefimg01',
    region: 'ap-south-1',
    service_role_key_encrypted: 'dev:dev-service-role-key',
    anon_key_encrypted: 'dev:dev-anon-key',
    storage_used_mb: 100,
    storage_limit_mb: 500,
    egress_used_gb: 0.5,
    egress_limit_gb: 5,
    is_active: true,
    is_paused: false,
    last_keepalive_at: new Date(Date.now() - 5 * HOUR).toISOString(),
    last_provisioned_at: new Date(Date.now() - 26 * HOUR).toISOString(),
    created_at: new Date(Date.now() - 48 * HOUR).toISOString(),
    ...partial,
  } as RegistryNode;
}

export function mockNodes(): RegistryNode[] {
  return [
    node({ node_prefix: 'img01', node_name: 'Image Storage Node 1', data_type: 'images', storage_used_mb: 128, egress_used_gb: 1.2 }),
    node({ node_prefix: 'img02', node_name: 'Image Storage Node 2', data_type: 'images', storage_used_mb: 455, egress_used_gb: 3.9 }),
    node({ node_prefix: 'txt01', node_name: 'Text Data Node 1', data_type: 'text', storage_used_mb: 64 }),
    node({ node_prefix: 'pdf01', node_name: 'PDF Vault 1', data_type: 'pdfs', storage_used_mb: 12 }),
    node({ node_prefix: 'mix01', node_name: 'General Node 1', data_type: 'mixed', storage_used_mb: 30, is_paused: false }),
  ];
}

export function mockMetrics(): {
  totalRequests: number;
  avgLatencyMs: number;
  activeNodes: number;
  trends: { requests: number; latency: number; nodes: number };
} {
  return {
    totalRequests: 128_904,
    avgLatencyMs: 18,
    activeNodes: 5,
    trends: { requests: 12.4, latency: -2.1, nodes: 1 },
  };
}

export function mockTrafficSeries(): number[] {
  return [
    3.1, 2.8, 2.4, 2.6, 3.4, 4.2, 5.1, 6.4, 7.8, 8.9, 9.6, 10.2,
    11.4, 10.8, 9.9, 10.6, 11.8, 12.4, 13.1, 14.6, 15.2, 14.1, 12.9, 11.7,
  ];
}

const METHODS = ['GET', 'GET', 'GET', 'POST', 'POST', 'PATCH', 'DELETE'];
const STATUSES = [200, 200, 200, 200, 201, 204, 404, 500, 503];

export function randomLogLine(): LogLine {
  const nodes = mockNodes();
  const n = nodes[Math.floor(Math.random() * nodes.length)];
  const method = METHODS[Math.floor(Math.random() * METHODS.length)];
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  const uuid = crypto.randomUUID();
  const isData = Math.random() > 0.4;
  const path = isData
    ? '/api/v1/data/' + n.node_prefix + '_' + uuid.slice(0, 8) + '…?table=' + (n.data_type === 'images' ? 'profile_pics' : 'notes')
    : '/api/v1/storage/' + (n.data_type === 'images' ? 'images' : 'docs') + '/' + n.node_prefix + '_' + uuid.slice(0, 8) + '…';
  return {
    ts: new Date().toISOString(),
    method,
    path,
    status,
    ms: 8 + Math.floor(Math.random() * 40),
    node: n.node_prefix,
  };
}

export function mockLogs(count: number): LogLine[] {
  const out: LogLine[] = [];
  for (let i = 0; i < count; i++) {
    const line = randomLogLine();
    line.ts = new Date(Date.now() - (count - i) * 9_000).toISOString();
    out.push(line);
  }
  return out;
}
