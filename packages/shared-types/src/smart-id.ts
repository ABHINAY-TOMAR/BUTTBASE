/**
 * B.U.T.T. Base — Smart ID (idea.md §5)
 * Format: {node_prefix}_{uuid} — the routing decision is embedded in the data itself.
 * Statelessness rule (§18 DON'T-1): never query a database to locate a record.
 */
export const NODE_CATEGORIES = ['images', 'text', 'pdfs', 'mixed'] as const;
export type NodeCategory = (typeof NODE_CATEGORIES)[number];

export const CATEGORY_CODE: Record<NodeCategory, string> = {
  images: 'img',
  text: 'txt',
  pdfs: 'pdf',
  mixed: 'mix',
};

export const PREFIX_RE = /^(img|txt|pdf|mix)\d{2,3}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedSmartId {
  prefix: string;
  uuid: string;
}

export function isNodePrefix(prefix: string): boolean {
  return PREFIX_RE.test(prefix);
}

export function buildSmartId(prefix: string, uuid: string): string {
  return prefix + '_' + uuid;
}

/** Split at the FIRST underscore — zero allocations beyond two slices, zero DB lookups. */
export function parseSmartId(smartId: string): ParsedSmartId | null {
  if (typeof smartId !== 'string' || smartId.length > 128) return null;
  const idx = smartId.indexOf('_');
  if (idx < 1) return null;
  const prefix = smartId.slice(0, idx);
  const uuid = smartId.slice(idx + 1);
  if (!prefix || !uuid) return null;
  return { prefix, uuid };
}

export function isSmartId(smartId: string): boolean {
  const parsed = parseSmartId(smartId);
  return parsed !== null && isNodePrefix(parsed.prefix) && UUID_RE.test(parsed.uuid);
}

export function categoryOfPrefix(prefix: string): NodeCategory | null {
  const code = prefix.slice(0, 3);
  const entry = (Object.entries(CATEGORY_CODE) as Array<[NodeCategory, string]>).find(([, c]) => c === code);
  return entry ? entry[0] : null;
}

/** Next free prefix for a category given the existing registry. images with img01+img02 → img03. */
export function suggestPrefix(category: NodeCategory, existingPrefixes: readonly string[]): string {
  const code = CATEGORY_CODE[category];
  const used = new Set(existingPrefixes.map((p) => p.toLowerCase()));
  for (let n = 1; n <= 999; n++) {
    const candidate = code + String(n).padStart(n < 100 ? 2 : 3, '0');
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error(
    'PREFIX_SPACE_EXHAUSTED: all 999 prefixes used for category ' +
      category +
      '. This is ~499 GB of storage — time for a new category or a migration.'
  );
}
