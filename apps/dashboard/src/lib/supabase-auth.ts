// apps/dashboard/src/lib/supabase-auth.ts
/**
 * Supabase Authentication
 * Handles OAuth and PAT-based authentication with Supabase
 */

import type { SupabaseCredentials, SupabaseOrganization, SupabaseProject, SupabaseProjectWithKeys, SupabaseApiKeys } from './supabase-connection';

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';

export interface SupabaseAccount {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'bearer';
  scope: string;
}

export class SupabaseAuth {
  private credentials: { pat?: string; accessToken?: string; refreshToken?: string } = {};

  setPat(pat: string) {
    this.credentials = { pat };
  }

  setOAuthTokens(tokens: OAuthTokens) {
    this.credentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  getPat(): string | undefined {
    return this.credentials.pat;
  }

  getAccessToken(): string | undefined {
    return this.credentials.accessToken;
  }

  isAuthenticated(): boolean {
    return !!(this.credentials.pat || this.credentials.accessToken);
  }

  getAuthHeaders(): HeadersInit {
    if (this.credentials.pat) {
      return { 'Authorization': `Bearer ${this.credentials.pat}` };
    }
    if (this.credentials.accessToken) {
      return { 'Authorization': `Bearer ${this.credentials.accessToken}` };
    }
    return {};
  }

  /**
   * Get user account info
   */
  async getAccount(): Promise<{ id: string; email: string; full_name?: string; avatar_url?: string } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch('https://api.supabase.com/v1/user', {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to get account: ${response.status}` };
      }

      return response.json();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * List all organizations for the authenticated user
   */
  async listOrganizations(): Promise<{ data: Array<{ id: string; name: string; slug: string; plan: string }> | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch('https://api.supabase.com/v1/organizations', {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to list organizations: ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get organization details
   */
  async getOrganization(slug: string): Promise<{ data: any } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/organizations/${slug}`, {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to get organization: ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * List projects in an organization
   */
  async listProjects(organizationSlug: string): Promise<{ data: any[] } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/organizations/${organizationSlug}/projects`, {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to list projects: ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get project details
   */
  async getProject(ref: string): Promise<{ data: any } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to get project: ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Create a new project
   */
  async createProject(params: {
    name: string;
    db_pass: string;
    organization_slug: string;
    region: string;
    plan?: 'free' | 'pro';
    kps_enabled?: boolean;
  }): Promise<{ data: any } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          db_pass: params.db_pass,
          organization_slug: params.organization_slug,
          region: params.region,
          plan: params.plan || 'free',
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { error: `Failed to create project: ${response.status} - ${text}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get API keys for a project
   */
  async getApiKeys(ref: string): Promise<{ data: any[] } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to get API keys: ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get legacy API keys (anon + service_role)
   */
  async getLegacyKeys(ref: string): Promise<{ data: { enabled: boolean; anon?: string; service_role?: string } } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys/legacy`, {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to get legacy keys: ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get project health status
   */
  async getProjectHealth(ref: string): Promise<{ data: any } | { error: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/health`, {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { error: `Failed to get health: ${response.status}` };
      }

      return { data: await response.json() };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Pause a project
   */
  async pauseProject(ref: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/pause`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      return { success: response.ok, error: response.ok ? undefined : `Failed: ${response.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Restore a paused project
   */
  async restoreProject(ref: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated()) return { error: 'Not authenticated' };

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/restore`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      return { success: response.ok, error: response.ok ? undefined : `Failed: ${response.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Pause project temporarily
   */
  async pauseProjectTemporarily(ref: string): Promise<{ success: boolean; error?: string }> {
    return this.pauseProject(ref);
  }

  /**
   * Get available regions
   */
  async getRegions(): Promise<string[]> {
    if (!this.isAuthenticated()) return ['ap-south-1', 'us-east-1', 'eu-west-1', 'ap-northeast-1'];

    try {
      const response = await fetch('https://api.supabase.com/v1/projects/available-regions', {
        headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      if (!response.ok) return ['ap-south-1', 'us-east-1', 'eu-west-1', 'ap-northeast-1'];
      const data = await response.json();
      return data.map((r: any) => r.code || r).filter(Boolean);
    } catch {
      return ['ap-south-1', 'us-east-1', 'eu-west-1', 'ap-northeast-1'];
    }
  }
}

// Singleton instance
export const supabaseAuth = new SupabaseAuth();

// OAuth flow helpers
export const SUPABASE_OAUTH_CONFIG = {
  clientId: process.env.SUPABASE_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.SUPABASE_OAUTH_CLIENT_SECRET || '',
  redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
  scope: 'read write',
  authUrl: 'https://supabase.com/dashboard/oauth/authorize',
  tokenUrl: 'https://api.supabase.com/v1/oauth/token',
};

export async function initiateOAuth(): Promise<string> {
  const params = new URLSearchParams({
    client_id: SUPABASE_OAUTH_CONFIG.clientId,
    redirect_uri: SUPABASE_OAUTH_CONFIG.redirectUri,
    scope: SUPABASE_OAUTH_CONFIG.scope,
    response_type: 'code',
    state: crypto.randomUUID(),
  });
  return `${SUPABASE_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

export async function handleOAuthCallback(code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | { error: string }> {
  try {
    const response = await fetch('https://api.supabase.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: SUPABASE_OAUTH_CONFIG.clientId,
        client_secret: SUPABASE_OAUTH_CONFIG.clientSecret,
        redirect_uri: SUPABASE_OAUTH_CONFIG.redirectUri,
      }),
    });

    if (!response.ok) {
      return { error: 'Failed to exchange code for tokens' };
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Singleton instance for app-wide use
export const supabaseAuthClient = {
  setPat: (pat: string) => supabaseAuth.setPat(pat),
  setOAuthTokens: (tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => supabaseAuth.setOAuthTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, tokenType: 'bearer', scope: 'read write' }),
  getAccount: () => supabaseAuth.getAccount(),
  listOrganizations: () => supabaseAuth.listOrganizations(),
  getOrganization: (slug: string) => supabaseAuth.getOrganization(slug),
  listProjects: (orgSlug: string) => supabaseAuth.listProjects(slug),
  getProject: (ref: string) => supabaseAuth.getProject(ref),
  createProject: (params: any) => supabaseAuth.createProject(params),
  getApiKeys: (ref: string) => supabaseAuth.getApiKeys(ref),
  getLegacyKeys: (ref: string) => supabaseAuth.getLegacyKeys(ref),
  getProjectHealth: (ref: string) => supabaseAuth.getProjectHealth(ref),
  pauseProject: (ref: string) => supabaseAuth.pauseProject(ref),
  restoreProject: (ref: string) => supabaseAuth.restoreProject(ref),
  getRegions: () => supabaseAuth.getRegions(),
  setPat: (pat: string) => supabaseAuth.setPat(pat),
  isAuthenticated: () => supabaseAuth.isAuthenticated(),
  initiateOAuth,
  handleOAuthCallback,
};
