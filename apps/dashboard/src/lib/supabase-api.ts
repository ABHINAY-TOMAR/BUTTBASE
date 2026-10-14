// apps/dashboard/src/lib/supabase-api.ts
/**
 * Supabase API Client
 * Real Supabase REST API client for fetching data from connected projects
 * Supports both anon and service role keys
 */

import type {
  SupabaseProjectWithKeys,
  SupabaseApiKeys,
  DataFetchRequest,
  DataFetchResponse,
  SupabaseTableSchema,
  SupabaseProject,
} from './supabase-connection';

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';

export class SupabaseApiClient {
  private project: SupabaseProjectWithKeys;
  private useServiceRole: boolean;

  constructor(project: SupabaseProjectWithKeys, useServiceRole = false) {
    this.project = project;
    this.useServiceRole = useServiceRole;
  }

  private getHeaders(): HeadersInit {
    const key = this.useServiceRole ? this.project.serviceRoleKey : this.project.anonKey;
    return {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  }

  private getRestUrl(path: string): string {
    return `${this.project.restUrl}${path}`;
  }

  // Generic request method
  private async request<T>(path: string, options: RequestInit = {}): Promise<DataFetchResponse<T>> {
    try {
      const url = this.getRestUrl(path);
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return { success: true, data: [] as unknown as T[] };
      }

      const data = await response.json();
      
      // Handle PostgREST response format
      const isArray = Array.isArray(data);
      const contentRange = response.headers.get('content-range');
      
      return {
        success: true,
        data: isArray ? data : [data],
        count: contentRange ? parseInt(contentRange.split('/').pop() || '0', 10) : (isArray ? data.length : 1),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ========================================================================
  // DATA OPERATIONS
  // ========================================================================

  /**
   * Select/query data from a table
   */
  async select<T = Record<string, unknown>>(request: {
    table: string;
    select?: string;
    filters?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending?: boolean };
  }): Promise<DataFetchResponse<T>> {
    const { table, select = '*', filters = {}, limit = 100, offset = 0, orderBy } = request;
    
    const params = new URLSearchParams();
    params.set('select', select);
    
    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        // Support operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is, isNot
        if (typeof value === 'object' && value !== null && 'operator' in value) {
          const { operator, value: val } = value as { operator: string; value: unknown };
          params.append(key, `${operator}.${val}`);
        } else {
          params.append(key, `eq.${value}`);
        }
      }
    }
    
    if (limit > 0) params.set('limit', String(limit));
    if (offset > 0) params.set('offset', String(offset));
    if (orderBy) {
      params.set('order', `${orderBy.column}.${orderBy.ascending !== false ? 'asc' : 'desc'}`);
    }

    return this.request(`/${table}?${params.toString()}`, { method: 'GET' });
  }

  /**
   * Insert new records
   */
  async insert<T = Record<string, unknown>>(table: string, data: Record<string, unknown> | Record<string, unknown>[]): Promise<DataFetchResponse<T>> {
    const body = Array.isArray(data) ? data : [data];
    return this.request(`/${table}`, {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(body),
    });
  }

  /**
   * Update records
   */
  async update<T = Record<string, unknown>>(table: string, filters: Record<string, unknown>, data: Record<string, unknown>): Promise<DataFetchResponse<T>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      params.append(key, `eq.${value}`);
    }
    return this.request(`/${table}?${params.toString()}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete records
   */
  async delete(table: string, filters: Record<string, unknown>): Promise<DataFetchResponse<unknown>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      params.append(key, `eq.${value}`);
    }
    return this.request(`/${table}?${params.toString()}`, { method: 'DELETE' });
  }

  /**
   * Upsert (insert or update)
   */
  async upsert<T = Record<string, unknown>>(table: string, data: Record<string, unknown> | Record<string, unknown>[], onConflict: string): Promise<DataFetchResponse<T>> {
    const body = Array.isArray(data) ? data : [data];
    return this.request(`/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { 
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(body),
    });
  }

  // ========================================================================
  // STORAGE OPERATIONS
  // ========================================================================

  /**
   * Upload file to storage bucket
   */
  async uploadFile(bucket: string, path: string, file: Blob | ArrayBuffer, contentType?: string): Promise<{ path: string; fullPath: string } | { error: string }> {
    try {
      const body = file instanceof Blob ? file : new Blob([file], { type: contentType });
      const response = await fetch(`${this.project.storageUrl}/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': contentType || 'application/octet-stream',
        },
        body,
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        return { error: `Upload failed: ${response.status} - ${error}` };
      }

      return await response.json();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Download file from storage
   */
  async downloadFile(bucket: string, path: string): Promise<Blob | { error: string }> {
    try {
      const response = await fetch(`${this.project.storageUrl}/object/${bucket}/${path}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.text().catch(() => '');
        return { error: `Download failed: ${response.status} - ${error}` };
      }

      return response.blob();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.project.storageUrl}/object/${bucket}/${path}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return { success: response.ok, error: response.ok ? undefined : `Delete failed: ${response.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // ========================================================================
  // SCHEMA / METADATA
  // ========================================================================

  /**
   * Get table schema
   */
  async getTableSchema(table: string): Promise<SupabaseTableSchema | { error: string }> {
    // Use information_schema or Supabase's pg_catalog
    const result = await this.select({
      table: 'information_schema.columns',
      filters: { table_name: { operator: 'eq', value: table } },
      select: 'column_name,data_type,is_nullable,column_default,ordinal_position',
      orderBy: { column: 'ordinal_position', ascending: true },
    });

    if (!result.success || !result.data) {
      return { error: 'Failed to fetch schema' };
    }

    // Also fetch primary keys
    const pkResult = await this.select({
      table: 'information_schema.table_constraints tc'
        + ' JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name',
      filters: { table_name: { operator: 'eq', value: table }, constraint_type: { operator: 'eq', value: 'PRIMARY KEY' } },
      select: 'kcu.column_name',
    });

    // Fetch indexes
    const idxResult = await this.select({
      table: 'pg_indexes',
      filters: { tablename: { operator: 'eq', value: table } },
      select: 'indexname,indexdef',
    });

    return {
      name: table,
      schema: 'public',
      columns: result.data?.map(c => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        default: c.column_default,
        isPrimaryKey: false, // Will be set below
        isForeignKey: false,
      })) || [],
      primaryKeys: pkResult.data?.map(p => p.column_name) || [],
      foreignKeys: [],
      indexes: idxResult.data?.map(i => {
        const match = i.indexdef.match(/USINGs+(w+)/i);
        return {
          name: i.indexname,
          columns: i.indexdef.match(/\((.*?)\)/)?.[1].split(',').map(c => c.trim()) || [],
          unique: i.indexdef.includes('UNIQUE'),
          method: (match?.[1]?.toLowerCase() as 'btree' | 'hash' | 'gin' | 'gist') || 'btree',
        };
      }) || [],
      policies: [],
    };
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const result = await this.select({ table: 'pg_tables', limit: 1 });
      return { success: true, latencyMs: Date.now() - start };
    } catch (error) {
      return { success: false, latencyMs: Date.now() - start, error: String(error) };
    }
  }
}

/**
 * Factory function to create client from project credentials
 */
export function createSupabaseClient(project: { 
  restUrl: string; 
  anonKey: string; 
  serviceRoleKey: string; 
  storageUrl: string;
  graphqlUrl: string;
  realtimeUrl: string;
}, useServiceRole = false): SupabaseApiClient {
  return new SupabaseApiClient({
    ...project,
    restUrl: project.restUrl || `https://${project.restUrl?.replace('https://', '').split('.')[0]}.supabase.co/rest/v1`,
    storageUrl: project.storageUrl || `https://${project.storageUrl?.replace('https://', '').split('.')[0]}.supabase.co/storage/v1`,
    graphqlUrl: project.graphqlUrl || `https://${project.graphqlUrl?.replace('https://', '').split('.')[0]}.supabase.co/graphql/v1`,
    realtimeUrl: project.realtimeUrl || `wss://${project.realtimeUrl?.replace('https://', '').split('.')[0]}.supabase.co/realtime/v1`,
  } as any, false);
}

/**
 * Create client from project with keys
 */
export function createClientFromProject(project: {
  ref: string;
  region: string;
  anonKey: string;
  serviceRoleKey: string;
}, useServiceRole = false): SupabaseApiClient {
  const baseUrl = `https://${project.ref}.supabase.co`;
  return new SupabaseApiClient({
    ref: project.ref,
    region: project.region,
    anonKey: project.anonKey,
    serviceRoleKey: project.serviceRoleKey,
    restUrl: `${baseUrl}/rest/v1`,
    storageUrl: `${baseUrl}/storage/v1`,
    graphqlUrl: `${baseUrl}/graphql/v1`,
    realtimeUrl: `wss://${project.ref}.supabase.co/realtime/v1`,
    apiUrl: `https://${project.ref}.supabase.co`,
  } as any, false);
}
