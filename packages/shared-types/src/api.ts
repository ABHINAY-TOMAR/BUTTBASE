/** Universal gateway API contracts (idea.md §12). Client-visible only — node URLs never appear here. */
import type { NodeCategory } from './smart-id.js';

export interface GatewayErrorBody {
  error: string;
  node?: string;
  request_id?: string;
}

export interface GatewayErrorResponse {
  status: number;
  body: GatewayErrorBody;
}

export const ERR = {
  UNAUTHORIZED: { status: 401, code: 'unauthorized' },
  BAD_TABLE: { status: 400, code: 'bad_table' },
  BAD_TYPE: { status: 400, code: 'bad_data_type' },
  BAD_SMART_ID: { status: 400, code: 'bad_smart_id' },
  NO_NODE: { status: 503, code: 'no_node_for_category' },
  NODE_PAUSED: { status: 503, code: 'node_paused' },
  NODE_UNAVAILABLE: { status: 502, code: 'node_unavailable' },
} as const;

export function gatewayError(status: number, code: string, node?: string): GatewayErrorResponse {
  return { status, body: { error: code, node } };
}

export function dataReadPath(smartId: string, table: string): string {
  return '/api/v1/data/' + smartId + '?table=' + encodeURIComponent(table);
}

export function dataWritePath(type: NodeCategory, table: string): string {
  return '/api/v1/data?type=' + type + '&table=' + encodeURIComponent(table);
}

export function storageObjectPath(bucket: string, smartId: string): string {
  return '/api/v1/storage/' + bucket + '/' + smartId;
}

export function storageUploadPath(bucket: string): string {
  return '/api/v1/storage/' + bucket;
}
