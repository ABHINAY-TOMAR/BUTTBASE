import { describe, expect, it } from 'vitest';
import { InMemoryRegistry, isNearlyFull, pickWriteNode, storagePct } from './registry.js';
import type { RegistryNode } from './registry.js';

function node(partial: Partial<RegistryNode>): RegistryNode {
  return {
    id: 'n-' + Math.random().toString(36).slice(2),
    node_prefix: 'img01',
    node_name: 'Test',
    data_type: 'images',
    supabase_url: 'https://img01.supabase.co',
    organization_slug: 'org-1',
    project_ref: 'ref000001',
    region: 'ap-south-1',
    service_role_key_encrypted: 'v1:xx:yy',
    anon_key_encrypted: 'v1:xx:yy',
    storage_used_mb: 0,
    storage_limit_mb: 500,
    egress_used_gb: 0,
    egress_limit_gb: 5,
    is_active: true,
    is_paused: false,
    last_keepalive_at: null,
    last_provisioned_at: null,
    created_at: new Date(0).toISOString(),
    ...partial,
  };
}

describe('pickWriteNode (capacity manager)', () => {
  const nodes = [
    node({ node_prefix: 'img01', storage_used_mb: 450 }),
    node({ node_prefix: 'img02', storage_used_mb: 100 }),
    node({ node_prefix: 'img03', storage_used_mb: 300, is_paused: true }),
    node({ node_prefix: 'txt01', data_type: 'text', storage_used_mb: 10 }),
  ];

  it('picks the writable image node with the most free space', () => {
    const picked = pickWriteNode(nodes, 'images');
    expect(picked?.node_prefix).toBe('img02');
  });
  it('skips paused, full and wrong-category nodes', () => {
    expect(pickWriteNode([nodes[0], nodes[2]], 'images')).toBeNull();
  });
  it('returns null when the category has no node', () => {
    expect(pickWriteNode(nodes, 'pdfs')).toBeNull();
  });
});

describe('capacity math', () => {
  it('computes storage percent and near-full', () => {
    const n = node({ storage_used_mb: 455, storage_limit_mb: 500 });
    expect(storagePct(n)).toBe(91);
    expect(isNearlyFull(n)).toBe(true);
    expect(isNearlyFull(n, 95)).toBe(false);
  });
});

describe('InMemoryRegistry', () => {
  const nodes = [node({ node_prefix: 'img01' }), node({ node_prefix: 'txt01', data_type: 'text' })];
  it('serves by prefix and lists active', async () => {
    const reg = new InMemoryRegistry(nodes);
    expect((await reg.getByPrefix('img01'))?.node_prefix).toBe('img01');
    expect(await reg.getByPrefix('nope')).toBeNull();
    expect((await reg.listActive('text')).length).toBe(1);
    expect((await reg.listAll()).length).toBe(2);
  });
});
