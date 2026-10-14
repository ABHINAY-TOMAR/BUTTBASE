// apps/dashboard/src/lib/supabase-connection.ts
/**
 * Supabase Account Connection Types
 * Handles OAuth and PAT-based connections to user's Supabase account
 */

export interface SupabaseCredentials {
  type: 'pat' | 'oauth';
  accessToken?: string;      // OAuth access token
  refreshToken?: string;     // OAuth refresh token
  pat?: string;              // Personal Access Token
  expiresAt?: number;        // Token expiration timestamp
}

export interface SupabaseOrganization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  createdAt: string;
  ownerId: string;
}

export interface SupabaseProject {
  id: string;
  ref: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'INITIALIZING';
  organizationId: string;
  organizationSlug: string;
  region: string;
  databasePassword?: string;  // Only available at creation
  createdAt: string;
  updatedAt: string;
  // Computed fields
  organizationName?: string;
  organizationSlug?: string;
}

export interface SupabaseProjectWithKeys extends SupabaseProject {
  anonKey: string;
  serviceRoleKey: string;
  apiUrl: string;
  graphqlUrl: string;
  restUrl: string;
  realtimeUrl: string;
  storageUrl: string;
}

export interface SupabaseApiKeys {
  anon: string;
  serviceRole: string;
}

export interface SupabaseRegion {
  code: string;
  name: string;
  provider: 'aws' | 'gcp';
  available: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  accountId?: string;
  email?: string;
  organizations?: SupabaseOrganization[];
  currentOrganization?: SupabaseOrganization;
  currentProject?: SupabaseProjectWithKeys;
  error?: string;
  lastSync?: string;
}

export interface ProvisionProjectRequest {
  name: string;
  organizationSlug: string;
  region: string;
  dataType: 'images' | 'text' | 'pdfs' | 'mixed';
  dbPassword?: string;  // Optional - will be generated if not provided
}

export interface ProvisionProjectResponse {
  success: boolean;
  project?: SupabaseProjectWithKeys;
  jobId?: string;
  error?: string;
  estimatedReadyTime?: number; // milliseconds
}

export interface DataFetchRequest {
  projectRef: string;
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  data?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
}

export interface DataFetchResponse<T = unknown> {
  success: boolean;
  data?: T[];
  error?: string;
  count?: number;
  pageInfo?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

export interface SupabaseTableSchema {
  name: string;
  schema: string;
  columns: SupabaseColumn[];
  primaryKeys: string[];
  foreignKeys: SupabaseForeignKey[];
  indexes: SupabaseIndex[];
  policies: SupabasePolicy[];
}

export interface SupabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: { table: string; column: string };
}

export interface SupabaseForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface SupabaseIndex {
  name: string;
  columns: string[];
  unique: boolean;
  method: 'btree' | 'hash' | 'gin' | 'gist';
}

export interface SupabasePolicy {
  name: string;
  command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  roles: string[];
  using?: string;
  withCheck?: string;
}
