# ADR-001: Stateless Smart-ID routing for the universal gateway

**Status:** Accepted · **Date:** 2026-10-10 · **Deciders:** owner + architect session

## Context
Many Supabase nodes hold the data; every read must find the right one. idea.md §5 requires zero database lookups on the hot path.

## Options Considered

### Option A: Routing ledger (DB lookup per fetch)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | +1 Master query on EVERY request; hot table |
| Scalability | Master becomes a query bottleneck |
| Team familiarity | High |

### Option B: Smart ID prefixing (stateless) ✅
| Dimension | Assessment |
|---|---|
| Complexity | Low (string split) |
| Cost | Zero per-request lookups; registry served from TTL cache |
| Scalability | Infinite — adding img05 changes nothing |
| Team familiarity | Medium (Stripe/Discord-style IDs) |

## Decision
**B.** IDs are \`{prefix}_{uuid}\`; the prefix IS the route. Gateway holds a TTL-cached registry (URLs + decrypted keys) and never queries the Master DB per request.

## Consequences
- Faster: prefix parse + cache hit only.
- IDs are node-bound and opaque — migrations must keep prefix→node mapping forever (prefixes are never reused).
- Owner-scoped "list all" queries fan out across a category's nodes (accepted; optional owner index is a Phase-2 idea, listings only).
