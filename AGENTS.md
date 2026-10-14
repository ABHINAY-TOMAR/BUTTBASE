# Agent guide

Read [idea.md](./idea.md) FIRST — it is the single source of truth for B.U.T.T. Base: concept, architecture, core logics, problems/solutions, and the strict DOs & DON'Ts (§18). Obey §18 without exception.

- Decisions and research: [docs/adr/](./docs/adr/) and [docs/research-notes.md](./docs/research-notes.md)
- UI direction: [docs/DESIGN.md](./docs/DESIGN.md) (idea.md §14 pinned it — do not restyle)
- The three rules agents break most often:
  1. Route ONLY by Smart ID prefix — never query the Master DB to locate a record.
  2. Node URLs/service keys never reach the client — clients see only the gateway domain.
  3. Provision via the Management REST API (fetch) — never shell out to the Supabase CLI.

Monorepo map: `packages/shared-types` (Smart ID, registry types), `packages/encryption` (AES-256-GCM), `apps/gateway` (universal edge router), `apps/provisioner` (Management API worker + keep-alive), `apps/dashboard` (Supabase-styled control plane UI), `supabase/schema.sql` (Master DDL).
