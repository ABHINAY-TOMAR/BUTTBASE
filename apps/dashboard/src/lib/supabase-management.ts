// apps/dashboard/src/lib/supabase-management.ts
/**
 * Supabase Management API Client
 * Handles organization and project provisioning via Supabase Management API
 */

import type { 
  SupabaseOrganization, 
  SupabaseProject, 
  SupabaseProjectWithKeys,
  SupabaseApiKeys,
  ProvisionProjectRequest,
  ProvisionProjectResponse 
} from './supabase-connection';

const MANAGEMENT_API_BASE = 'https://api.supabase.com/v1';

export interface CreateProjectParams {
  name: string;
  db_pass: string;
  organization_slug: string;
  region: string;
  plan?: 'free' | 'pro';
  region_selection?: { type: 'specific'; code: string };
  kps_enabled?: boolean;
  postgres_engine?: string;
  postgres_version?: string;
}

export interface SupabaseMgmtOrganization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  billing_email?: string;
  created_at: string;
}

export interface SupabaseMgmtProject {
  id: string;
  ref: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'INITIALIZING' | 'PENDING';
  organization_id: string;
  organization_slug: string;
  region: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectBody {
  name: string;
  db_pass: string;
  organization_slug: string;
  region_selection?: { type: 'specific'; code: string };
  region?: string;
  plan?: 'free' | 'pro';
  kps_enabled?: boolean;
  postgres_engine?: string;
  postgres_version?: string;
}

export interface SupabaseApiKeysResponse {
  data: Array<{
    id: string;
    name: string;
    secret: string;
    role: string;
    created_at: string;
  }>;
}

export interface LegacyKeysResponse {
  enabled: boolean;
  anon?: string;
  service_role?: string;
}

export class SupabaseManagementClient {
  private accessToken: string;
  private baseUrl = 'https://api.supabase.com/v1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error('Management API ' + path + ' -> HTTP ' + response.status + ': ' + errorText);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async listOrganizations(): Promise<Array<{ id: string; name: string; slug: string; plan: string }>> {
    return this.request('/v1/organizations');
  }

  async getOrganization(slug: string) {
    return this.request('/v1/organizations/' + slug);
  }

  async createOrganization(name: string) {
    return this.request('/v1/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async listProjects(): Promise<Array<{
    id: string;
    ref: string;
    name: string;
    status: string;
    organization_id: string;
    organization_slug: string;
    region: string;
  }>> {
    return this.request('/v1/projects');
  }

  async getProject(ref: string) {
    return this.request('/v1/projects/' + ref);
  }

  async createProject(params: {
    name: string;
    db_pass: string;
    organization_slug: string;
    region_selection: { type: 'specific'; code: string };
    plan?: 'free' | 'pro';
  }) {
    return this.request('/v1/projects', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getProject(ref: string) {
    return this.request('/v1/projects/' + ref);
  }

  async pauseProject(ref: string) {
    return this.request('/v1/projects/' + ref + '/pause', { method: 'POST' });
  }

  async restoreProject(ref: string) {
    return this.request('/v1/projects/' + ref + '/restore', { method: 'POST' });
  }

  async getProjectHealth(ref: string) {
    return this.request('/v1/projects/' + ref + '/health');
  }

  async listApiKeys(ref: string) {
    return this.request('/v1/projects/' + ref + '/api-keys');
  }

  async getLegacyKeys(ref: string): Promise<{ enabled: boolean; anon?: string; service_role?: string }> {
    return this.request('/v1/projects/' + ref + '/api-keys/legacy');
  }

  async provisionProject(params: {
    name: string;
    organizationSlug: string;
    region: string;
    dbPassword: string;
    dataType: 'images' | 'text' | 'pdfs' | 'mixed';
  }): Promise<{ project: any; keys: { anon: string; serviceRole: string } }> {
    const dbPassword = crypto.randomUUID() + crypto.randomUUID();

    const project = await this.request('/v1/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        db_pass: params.dbPassword,
        organization_slug: params.organizationSlug,
        region_selection: { type: 'specific', code: params.region },
        plan: 'free',
      }),
    });

    const ref = project.ref || project.id;
    
    await this.waitForProjectActive(ref);
    console.log('[provision] project ACTIVE - fetching keys');

    const keys = await this.getProjectKeys(ref);

    return { project, keys };
  }

  async waitForProjectActive(ref: string, maxWaitMs = 300000): Promise<void> {
    const startTime = Date.now();
    const timeout = 300000;

    while (Date.now() - startTime < timeout) {
      const project = await this.getProject(ref);
      const status = (project.status ?? '').toUpperCase();

      if (status === 'ACTIVE') {
        return;
      }

      if (['PAUSED', 'DELETED', 'FAILED'].includes(status)) {
        throw new Error('project ' + ref + ' never became ACTIVE (last status: ' + status + ')');
      }

      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    throw new Error('project ' + ref + ' never became ACTIVE');
  }

  async getProjectKeys(ref: string): Promise<{ anon: string; serviceRole: string }> {
    try {
      const legacy = await this.getLegacyKeys(ref);
      if (legacy.enabled && legacy.anon && legacy.service_role) {
        return { anon: legacy.anon, serviceRole: legacy.service_role };
      }
    } catch (e) {
      // Legacy keys might not be available
    }

    throw new Error('Could not extract API keys - needs live verification');
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        'Authorization': 'Bearer ' + this.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error('Management API ' + path + ' -> HTTP ' + response.status + ': ' + text);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }
}

export function createManagementClient(accessToken: string) {
  return new SupabaseManagementClient(accessToken);
}

export function createManagementClientFromPat(pat: string) {
  return new SupabaseManagementClient(pat);
}
