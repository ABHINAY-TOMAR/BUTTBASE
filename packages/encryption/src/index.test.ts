import { describe, expect, it } from 'vitest';
import { decryptText, deriveKey, encryptText } from './index.js';

describe('AES-256-GCM envelope', () => {
  it('roundtrips a service key', async () => {
    const key = await deriveKey('unit-test-secret');
    const ct = await encryptText('eyJ-service-role-super-secret-01', key);
    expect(ct.startsWith('v1:')).toBe(true);
    expect(ct).not.toContain('service-role');
    expect(await decryptText(ct, key)).toBe('eyJ-service-role-super-secret-01');
  });

  it('accepts a raw 32-byte base64 key', async () => {
    const b64key = btoa('0123456789abcdef0123456789abcdef'); // 32 ASCII bytes → 32-byte key
    const key = await deriveKey(b64key);
    const ct = await encryptText('x', key);
    await expect(decryptText(ct, key)).resolves.toBe('x');
  });

  it('rejects the wrong key and malformed envelopes', async () => {
    const k1 = await deriveKey('key-one');
    const k2 = await deriveKey('key-two');
    const ct = await encryptText('secret', k1);
    await expect(decryptText(ct, k2)).rejects.toThrow();
    await expect(decryptText('v9:xx:yy', k1)).rejects.toThrow();
  });
});
