# ADR-002: Gateway runtime and registry cache

**Status:** Accepted · **Date:** 2026-10-10

## Context
idea.md §18: edge runtime, no long-running server, Master DB never on the hot path, latency minimal, no SPOF single machine.

## Options Considered
1. **Next.js route handlers (edge-capable), zero-dep fetch** ✅
2. Cloudflare Worker (separate toolchain)
3. Long-running Node/Express (violates §18 DO-1)

## Decision
**1.** `apps/gateway` is a pages-less Next.js app: `app/api/v1/**` route handlers with `runtime = 'edge'`, plain `fetch` only (no supabase-js in the gateway), a 60 s in-memory TTL registry cache (Redis slot for cross-region later), and Web Crypto (via `@buttbase/encryption`) for keys.

## Consequences
- Deploy = Vercel (or any Next host); dev parity with `next dev`.
- Transparent proxying must stream bodies (`duplex: 'half'` in Node, native in edge).
- If an edge-specific API breaks in verification, the documented fallback is switching `runtime` to `nodejs` per route — a one-line change, not a redesign.
