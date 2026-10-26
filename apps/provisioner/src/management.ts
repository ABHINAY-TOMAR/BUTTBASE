/**
 * Supabase Management API client (plain fetch — §18 DON'T-3: never the CLI).
 * Endpoints verified against api_v1_openapi.json — see docs/research-notes.md SS1.
 */
const BASE = 'https://api.supabase.com';

export interface MgmtOrganization {
  id: string;
  name: string;
  slug?: string;
}

export interface MgmtProject {
  id: string;
  ref?: string;
  name: string;
  status: string;
  organization_id?: string;
  organization_slug?: string;
  region?: string;
}

export interface CreateProjectBody {
  name: string;
  db_pass: string;
  organization_slug: string;
  region_selection: { type: 'specific'; code: string };
}

export class ManagementApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string
  ) {
    super('Management API ' + path + ' → HTTP ' + status + ': ' + message);
    this.name = 'ManagementApiError';
  }
}

/** Project responses carry the ref in `ref` or `id` depending on API vintage. */
export function projectRef(p: MgmtProject): string {
  return p.ref ?? p.id;
}

export class SupabaseManagement {
  constructor(private readonly personalAccessToken: string) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(BASE + path, {
      ...init,
      headers: {
        authorization: 'Bearer ' + this.personalAccessToken,
        'content-type': 'application/json',
        ...((init.headers as Record<string, string>) ?? {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ManagementApiError(res.status, path, text.slice(0, 400));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  listOrganizations(): Promise<MgmtOrganization[]> {
    return this.call<MgmtOrganization[]>('/v1/organizations');
  }

  createOrganization(name: string): Promise<MgmtOrganization> {
    return this.call<MgmtOrganization>('/v1/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  listProjects(): Promise<MgmtProject[]> {
    return this.call<MgmtProject[]>('/v1/projects');
  }

  createProject(body: CreateProjectBody): Promise<MgmtProject> {
    return this.call<MgmtProject>('/v1/projects', { method: 'POST', body: JSON.stringify(body) });
  }

  getProject(ref: string): Promise<MgmtProject> {
    return this.call<MgmtProject>('/v1/projects/' + encodeURIComponent(ref));
  }

  /** TODO(live-verify): response shape still needs one live-PAT run (docs/research-notes.md SS5). */
  listApiKeys(ref: string): Promise<unknown> {
    return this.call<unknown>('/v1/projects/' + encodeURIComponent(ref) + '/api-keys');
  }

  legacyKeysEnabled(ref: string): Promise<{ enabled: boolean }> {
    return this.call<{ enabled: boolean }>('/v1/projects/' + encodeURIComponent(ref) + '/api-keys/legacy');
  }

  projectHealth(ref: string): Promise<unknown> {
    return this.call<unknown>('/v1/projects/' + encodeURIComponent(ref) + '/health');
  }

  pauseProject(ref: string): Promise<void> {
    return this.call<void>('/v1/projects/' + encodeURIComponent(ref) + '/pause', { method: 'POST' });
  }

  restoreProject(ref: string): Promise<void> {
    return this.call<void>('/v1/projects/' + encodeURIComponent(ref) + '/restore', { method: 'POST' });
  }

  deleteProject(ref: string): Promise<void> {
    return this.call<void>('/v1/projects/' + encodeURIComponent(ref), { method: 'DELETE' });
  }
}
