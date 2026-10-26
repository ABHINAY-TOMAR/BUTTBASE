/** PostgREST client for the Master project (registry + queue). Service-role only. */
import type { ProvisionJob, RegistryNode } from '@buttbase/shared-types';

export class MasterDb {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string
  ) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      apikey: this.serviceKey,
      authorization: 'Bearer ' + this.serviceKey,
      'content-type': 'application/json',
      ...(extra ?? {}),
    };
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(this.url + path, {
      ...init,
      headers: this.headers((init.headers as Record<string, string>) ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('Master ' + path + ' → HTTP ' + res.status + ': ' + text.slice(0, 300));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  listRegistry(): Promise<RegistryNode[]> {
    return this.call<RegistryNode[]>(
      '/rest/v1/projects_registry?select=id,node_prefix,node_name,data_type,supabase_url,service_role_key_encrypted,organization_slug,project_ref,region,storage_used_mb,storage_limit_mb,egress_used_gb,egress_limit_gb,is_active,is_paused,last_keepalive_at,last_provisioned_at,created_at'
    );
  }

  /** Jobs that have a project_ref but are still in failed/processing state (potential orphans). */
  listOrphanedJobs(): Promise<ProvisionJob[]> {
    return this.call<ProvisionJob[]>(
      '/rest/v1/provisioning_queue?select=*&provisioning_project_ref=not.is.null&status=in.(failed,processing)&order=created_at.desc&limit=50'
    );
  }

  async insertRegistry(row: Record<string, unknown>): Promise<RegistryNode> {
    const res = await this.call<RegistryNode[]>('/rest/v1/projects_registry', {
      method: 'POST',
      body: JSON.stringify(row),
      headers: { prefer: 'return=representation' },
    });
    return Array.isArray(res) ? res[0] : (res as unknown as RegistryNode);
  }

  updateRegistry(id: string, patch: Record<string, unknown>): Promise<void> {
    return this.call<void>(
      '/rest/v1/projects_registry?id=eq.' + encodeURIComponent(id),
      { method: 'PATCH', body: JSON.stringify(patch) }
    );
  }

  nextPendingJob(): Promise<ProvisionJob | null> {
    return this.call<ProvisionJob[]>(
      '/rest/v1/provisioning_queue?select=*&status=eq.pending&order=created_at.asc&limit=1'
    ).then((r) => (Array.isArray(r) && r.length ? r[0] : null));
  }

  markJob(id: string, patch: Record<string, unknown>): Promise<void> {
    return this.call<void>(
      '/rest/v1/provisioning_queue?id=eq.' + encodeURIComponent(id),
      { method: 'PATCH', body: JSON.stringify(patch) }
    );
  }

  async completedTodayCount(): Promise<number> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const r = await this.call<unknown[]>(
      '/rest/v1/provisioning_queue?select=id&status=eq.completed&processed_at=gte.' + since.toISOString()
    );
    return Array.isArray(r) ? r.length : 0;
  }
}
