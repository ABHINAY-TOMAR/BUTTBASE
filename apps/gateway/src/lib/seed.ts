/** Dev-mode fixtures: seed registry so the gateway runs with zero credentials.
 *  Dev CRUD is a STATELESS echo — production edge builds isolate each route sandbox,
 *  so nothing is stored; live mode proxies to real nodes (which is the point). */
import type { RegistryNode } from '@buttbase/shared-types';

function seedNode(partial: Partial<RegistryNode>): RegistryNode {
  return {
    id: 'dev-' + partial.node_prefix,
    node_prefix: 'img01',
    node_name: 'Dev node',
    data_type: 'images',
    supabase_url: 'https://' + partial.node_prefix + '.buttbase.dev',
    organization_slug: 'buttbase-dev-org',
    project_ref: 'devref' + (partial.node_prefix ?? ''),
    region: 'ap-south-1',
    service_role_key_encrypted: 'dev:dev-service-role-key',
    anon_key_encrypted: 'dev:dev-anon-key',
    storage_used_mb: 100,
    storage_limit_mb: 500,
    egress_used_gb: 0.5,
    egress_limit_gb: 5,
    is_active: true,
    is_paused: false,
    last_keepalive_at: new Date().toISOString(),
    last_provisioned_at: new Date(Date.now() - 864e5).toISOString(),
    created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
    ...partial,
  } as RegistryNode;
}

export function seedNodes(): RegistryNode[] {
  return [
    seedNode({ node_prefix: 'img01', node_name: 'Image Storage Node 1', data_type: 'images', storage_used_mb: 128 }),
    seedNode({ node_prefix: 'img02', node_name: 'Image Storage Node 2', data_type: 'images', storage_used_mb: 455 }),
    seedNode({ node_prefix: 'txt01', node_name: 'Text Data Node 1', data_type: 'text', storage_used_mb: 64 }),
    seedNode({ node_prefix: 'pdf01', node_name: 'PDF Vault 1', data_type: 'pdfs', storage_used_mb: 12 }),
    seedNode({ node_prefix: 'mix01', node_name: 'General Node 1', data_type: 'mixed', storage_used_mb: 30 }),
  ];
}
