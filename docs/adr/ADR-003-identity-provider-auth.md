# ADR-003: Centralized auth (identity-provider pattern)

**Status:** Accepted · **Date:** 2026-10-10

## Context
Every Supabase project has its own JWT secret; RLS cannot span projects (idea.md §7). Re-signing client tokens across projects was rejected early as an unacceptable security risk.

## Options Considered
1. **Master owns identity; gateway re-auths to nodes with service keys** ✅
2. Token re-signing per node (rejected: key sprawl + blast radius)
3. Per-node RLS with synced users (rejected: nodes must stay user-blind)

## Decision
**1.** Clients hold one Master JWT. The gateway verifies it once per request (Master `/auth/v1/user` via fetch — no SDK), then talks to nodes with each node's `service_role` key, decrypted server-side. Nodes carry no user data and no user-facing RLS; they are unreachable by clients.

## Consequences
- One token = universal access (the UX the owner asked for).
- Gateway is the single enforcement point — its logging is the audit trail.
- Node keys are crown jewels: AES-256-GCM at rest (`packages/encryption`), never logged, never returned, env-only.
- Dev mode (`BB_DEV_MODE=1`) accepts any bearer token and stamps responses — never on in prod.
