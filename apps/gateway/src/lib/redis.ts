/**
 * Shared Upstash Redis client — registry L1 cache + rate limiting.
 * HTTP-native: works on Vercel Edge and Cloudflare Workers without TCP sockets.
 * Returns null when UPSTASH_REDIS_REST_URL is absent → graceful in-memory fallback.
 * FLAW-02 / FLAW-05 FIX.
 */
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

export function redisClient(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // graceful degradation: in-memory only
  _redis = new Redis({ url, token });
  return _redis;
}

/** Shared key for the serialised registry node list (encrypted keys safe to cache). */
export const REGISTRY_KEY = 'bb:registry:nodes';
