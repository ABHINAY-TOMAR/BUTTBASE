# B.U.T.T. Base
### Backend Universal Traffic & Topology Base

**One Universal URL · Infinite free Supabase nodes · $0/month.**

B.U.T.T. Base is an API Gateway + Infrastructure Orchestrator that federates many free-tier Supabase projects into what looks like a single, infinitely scalable backend. OmniRoute does this for LLM APIs; ButtBase does it for Supabase. Full vision, architecture and rules: **[idea.md](./idea.md)** (read it first).

## What is in this repo (v1)

| Piece | Path | What it does |
|---|---|---|
| Shared types & Smart ID | `packages/shared-types` | `{prefix}_{uuid}` parse/build, registry types, capacity math |
| Encryption | `packages/encryption` | AES-256-GCM helpers for service keys at rest |
| Universal Gateway | `apps/gateway` | Stateless edge router: JWT check → prefix parse → cache → transparent proxy (REST + Storage) |
| Provisioner | `apps/provisioner` | Management API worker: create org → project → poll → keys → encrypt → register; + 3-day keep-alive |
| Dashboard | `apps/dashboard` | Supabase-styled control plane: Overview, Databases, Omni-Router, Logs, Settings + ⌘K palette |
| Master DDL | `supabase/schema.sql` | `projects_registry` + `provisioning_queue` with RLS |

## Quick start (dev mode, no credentials needed)

```bash
pnpm install
pnpm build:packages
pnpm dev:dashboard   # http://localhost:3000  (mock registry + mock logs)
pnpm dev:gateway     # http://localhost:8787  (dev mode: accepts any bearer token)
```

Smoke-test the gateway in dev mode:

```bash
curl -X POST "http://localhost:8787/api/v1/data?type=text&table=notes" \
  -H "Authorization: Bearer dev-token" -H "Content-Type: application/json" \
  -d '{"title":"hello buttbase"}'
# → {"id":"txt01_<uuid>"}   (routed to the txt01 node by prefix)

curl "http://localhost:8787/api/v1/data/txt01_<uuid>?table=notes" -H "Authorization: Bearer dev-token"
```

Dev mode is a **stateless echo**: writes return real Smart IDs and route by prefix, but nothing is persisted (production edge builds isolate route sandboxes). Live mode (`BB_DEV_MODE=0` + Master credentials) proxies everything to the real nodes.

## Going live (real Supabase)

1. Create one free **Master** project at supabase.com; run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` → `.env.local` and fill `MASTER_SUPABASE_URL`, `MASTER_SERVICE_ROLE_KEY`, `REGISTRY_ENCRYPTION_KEY` (32-byte base64), and set `BB_DEV_MODE=0`.
3. For auto-provisioning: create a Personal Access Token (supabase.com/dashboard/account/tokens) → `SUPABASE_MANAGEMENT_PAT`, then run `pnpm dev:provisioner` and enqueue nodes from the dashboard.
4. Deploy the gateway anywhere Next.js runs (Vercel) — keep the Master service key server-side only.

## Verified by research (docs/research-notes.md)

- `POST /v1/organizations` **exists** in the Management API — zero-touch org creation is real.
- `POST /v1/projects` needs `db_pass, name, organization_slug` (+ region via `region_selection`).
- Keys via `GET /v1/projects/{ref}/api-keys`; health via `GET /health`; pause/restore endpoints exist for the keep-alive engine.

## Honest caveats (before you farm 50 orgs)

- **ToS risk:** mass-creating free orgs/projects can be judged free-tier abuse; worst case is account termination. Keep volumes modest (5–10 nodes), stay throttled (`PROVISION_MAX_PER_DAY`), never keep irreplaceable data only on farmed nodes — export/self-host is the escape hatch (idea.md §21).
- The **api-keys response shape** is parsed defensively and still needs one live verification against a real PAT (marked `TODO(live-verify)` in `apps/provisioner/src/management.ts`).
