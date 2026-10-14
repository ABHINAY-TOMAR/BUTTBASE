/**
 * B.U.T.T. Base — AES-256-GCM envelope for service keys at rest (idea.md §18 DO-3).
 * Envelope format: v1:<base64(iv)>:<base64(ciphertext+tag)>
 * Web Crypto only — runs in Node 18+ and on edge runtimes. No dependencies.
 */
const VERSION = 'v1';

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as unknown as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Accepts a 32-byte base64 key (recommended — see .env.example) or derives one from any secret via SHA-256. */
export async function deriveKey(secret: string): Promise<CryptoKey> {
  const trimmed = secret.trim();
  try {
    const raw = fromB64(trimmed);
    if (raw.length === 32) return importKey(raw);
  } catch {
    /* not base64 — derive instead */
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trimmed));
  return importKey(new Uint8Array(digest));
}

export async function encryptText(plain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return VERSION + ':' + toB64(iv) + ':' + toB64(new Uint8Array(ct));
}

export async function decryptText(payload: string, key: CryptoKey): Promise<string> {
  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== VERSION) throw new Error('bad ciphertext envelope');
  // Cast for BufferSource variance across TS lib versions (Uint8Array<ArrayBufferLike>).
  const iv = fromB64(parts[1]) as unknown as ArrayBuffer;
  const ct = fromB64(parts[2]) as unknown as ArrayBuffer;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export async function keyFromEnv(envValue: string | undefined): Promise<CryptoKey> {
  if (!envValue) throw new Error('REGISTRY_ENCRYPTION_KEY is missing — see .env.example');
  return deriveKey(envValue);
}
