# B.U.T.T. Base (Backend Universal Traffic & Topology Base)
### idea.md — the complete idea, architecture & agent context

**One Universal URL · Infinite free Supabase nodes · $0/month**

> **AI AGENT — READ THIS FIRST.** This file is the single source of truth for B.U.T.T. Base. Before writing any code (gateway, provisioner, dashboard, SQL, infra), read it fully and obey §18 (DOs & DON'Ts) without exception. Every decision here survived a full architecture grill — keep it as-is, and if a requirement is genuinely missing, stop and ask instead of inventing. Import this file into project knowledge (Cursor Docs, Claude project context, Trae rules) before any code-generation session.

---

## 1. The idea (elevator pitch)

**"The infinite free-tier cheat code."**

OmniRoute takes many LLM API keys from different providers and hands you one universal key. **B.U.T.T. Base is OmniRoute — but for Supabase databases instead of LLMs.**

- Plug many free-tier Supabase projects (spread across multiple free organizations) into ButtBase.
- ButtBase hands back **one Universal URL + one Universal Key** you can drop into any app.
- Your frontend believes it talks to a single, premium, unlimited database.
- Behind the scenes the Gateway shards your data across dozens of free Supabase nodes, auto-provisions new ones as they fill, and keeps every node awake.

**The three "Aha!" mechanisms:**

1. **Auto-scaling, zero cost** — the moment a node nears its 500 MB limit (~450 MB / 90%), the Gateway provisions a fresh free project and routes all new writes there. You never need the $25/mo Pro upgrade.
2. **Smart ID Routing** — every record is born with an ID like `img01_a9f8…`. The prefix *is* the address, so reads need zero lookup queries.
3. **The anti-sleep ping** — a cron pings every node every 3 days, so Supabase's 7-day inactivity pause never fires.

One line: **an API Gateway + Infrastructure Orchestrator that turns the Supabase free tier into an infinitely scalable, self-managing, $0 backend.**

---

## 2. The problem — the free-tier constraints being bypassed

| Resource | Free-tier limit | On exceed |
|---|---|---|
| Active projects | **2 per organization** (paused don't count) | 3rd project can't be created |
| Database size | 500 MB / project | DB goes **read-only** — writes fail |
| File storage | 1 GB / project (50 MB per file) | Uploads blocked |
| Egress | 5 GB / month (+5 GB cached) | Requests fail (402) |
| Auth | 50,000 MAUs | New signups blocked |
| Edge Functions | 500K invocations / month | Throttled / dropped |
| Realtime | 200 concurrent conns · 2M messages/mo | Refused / dropped |
| Compute | shared CPU, 500 MB RAM · 60 direct / 200 pooler conns | Latency, timeouts |
| Backups & logs | 7-day snapshots · 1-day API logs | No PITR |
| Support | community only | no SLA |

**Two operational catches drive the whole design:**

- **7-day inactivity pause** — a free project with no API traffic for 7 days auto-pauses; data survives but the DB goes offline until manually restored. → *this is why the Keep-Alive Engine exists (§9).*
- **Hard stops, never bills** — the free tier never charges overages; it blocks. No surprise $1,000 bills, but a hard ceiling. → *this is why auto-sharding exists (§6).*

**Free-tier perks we exploit:** full Postgres (joins, views, triggers, `pgvector`) · commercial use allowed · spend-cap predictability · no lock-in (export & self-host anytime — the escape hatch).

---

## 3. The payoff — aggregated capacity

N free nodes federated through ButtBase = one big virtual backend:

| Resource | 1 node | 4 nodes | 10 nodes |
|---|---|---|---|
| Database | 500 MB | 2 GB | 5 GB |
| File storage | 1 GB | 4 GB | 10 GB |
| Egress | 5 GB/mo | 20 GB/mo | 50 GB/mo |
| Edge invocations | 500K | 2M | 5M |
| Direct DB conns | 60 | 240 | 600 |

- **Infinite free storage** — a new node spins up *before* the 500 MB wall.
- **Nodes never sleep** — keep-alive beats the pause.
- **Load balancing** — no node ever hits egress/compute ceilings.
- **Zero financial risk** — spend caps mean scaling never touches a credit card.

---

## 4. Core architecture — hub-and-spoke gateway with stateless routing

```
CLIENT APP (any framework — holds ONLY the Universal URL + master JWT)
   │
   ▼
UNIVERSAL GATEWAY · api.buttbase.io/v1 · serverless EDGE ROUTER (stateless)
   │  1. verify the master JWT
   │  2. parse the Smart ID prefix  (a string split — no DB query)
   │  3. resolve the node from the REGISTRY CACHE (in-memory / Redis, 5–10 min TTL)
   │  4. proxy the request to that node with its service_role key
   ▼
NODE img01 · NODE img02 · NODE txt01 · NODE txt02 · NODE pdf01 · NODE mix01 …
(each node = one free Supabase project, spread across rotating free organizations)

CONTROL PLANE (never on the data path):
   Dashboard (Next.js) ──► Provisioning Engine ──► Supabase Management API
   (create org → create project → poll the 2–5 min cold boot → fetch keys
    → encrypt → register the node)          │
                                             ▼
   Keep-Alive Cron (every 3 days) ──► MASTER REGISTRY (metadata-only Supabase
                                       project: auth users + projects_registry
                                       + provisioning_queue)
```

The five components (details live in the Core Logic sections):

| Component | Role | Detail |
|---|---|---|
| Control plane — Dashboard + Provisioner | You type only a node name + data category; everything else is automatic | §8 |
| Master Registry & Auth Hub | One Supabase project holding users, the registry, the queue, the encrypted PAT | §7, §11 |
| Data plane — Universal Edge Router | Stateless proxy: JWT check → prefix parse → cache lookup → proxy | §5, §12 |
| Keep-Alive Worker | 3-day cron ping so nothing ever pauses | §9 |
| Provisioning Queue | Throttled jobs — max 1–2 projects/day | §8 |

**Request routing flow (30-second version):**

```
WRITE  client ── POST /v1/data ──► Gateway ──► pick the node with the most free
       capacity for that category (say img01) ──► write with img01's
       service_role key ──► return the Smart ID: img01_9f8e3c2a-…

READ   client ── GET /v1/data/img01_9f8e3c2a-… ──► Gateway splits at "_"
       ──► prefix img01 ──► cached URL+key lookup ──► proxy ──► data back
       (zero database lookups on the routing path)
```

---

## 5. Core logic 1 — Smart ID prefixing (stateless routing)

**Format:** `{node_prefix}_{uuid_v4}`

| Category | Prefixes | Example Smart ID |
|---|---|---|
| Images | `img01`, `img02`, … | `img01_a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Text / JSON | `txt01`, `txt02`, … | `txt03_f83h2k1l-9m4n-5o6p-q7r8-s9t0u1v2w3x4` |
| PDFs / docs | `pdf01`, `pdf02`, … | `pdf02_9z8y7x6w-5v4u-3t2s-1r0q-p9o8n7m6l5k4` |
| Mixed / general | `mix01`, `mix02`, … | `mix01_…` |

- **Write:** the Gateway picks the node (category + capacity) → stores the data → returns the node-prefixed ID.
- **Read:** the Gateway splits the ID at the first `_` → the prefix directly names the node → cached URL/key → proxy. **The routing decision is embedded in the data itself.**

```ts
export function parseSmartId(smartId: string): { prefix: string; uuid: string } | null {
  const idx = smartId.indexOf('_');
  if (idx < 1) return null;
  const prefix = smartId.slice(0, idx);
  const uuid = smartId.slice(idx + 1);
  if (!prefix || !uuid) return null;
  return { prefix, uuid };
}
```

**Decision on record:** a database-driven *routing ledger* (record_id → project_id lookup per fetch) was evaluated and **rejected** — it adds a Master-DB query to every request (latency + a hot table). The ledger returns only as an optional Phase-2 *owner-listing index* (§21) — never for per-record routing.

---

## 6. Core logic 2 — content-based sharding

- Every node is tagged with one **category** (`images` / `text` / `pdfs` / `mixed`); the client declares it per write. *"Which project holds the users table?"* is answered **by design** — never guessed, never merged.
- One logical dataset lives exclusively inside its category's nodes → no data collisions.
- **Capacity manager:** new writes go to the category's active node with the most free space. At **90% (450 MB)** the node is marked full → a provisioning job is enqueued → new writes shift to the fresh node. Reads keep flowing to every node (they are prefix-addressed).
- **Boundary:** every request targets exactly one node — no cross-node JOINs or merged SELECTs in Phase 1.

---

## 7. Core logic 3 — centralized auth (identity-provider pattern)

- The **Master project owns all identities.** Clients sign up / log in only against the Master and hold its JWT.
- The Gateway verifies that JWT **once per request**; one valid token = automatic approval on every routed request.
- The Gateway then talks to data nodes with **each node's `service_role` key**. Nodes run with service-key-only access (no user-facing RLS) — they never store or know about users.
- Nodes are unreachable by clients: only the Gateway holds their URLs and keys.

---

## 8. Core logic 4 — zero-touch provisioning (Management API, never the CLI)

**You should only ever be asked for a node name and a data category.**

1. Once, the operator feeds a **Supabase Personal Access Token (PAT)** into the control plane (stored encrypted).
2. A dashboard command ("Deploy: Image Storage 3, type: images") enqueues a provisioning job.
3. The worker picks or creates a **free organization** (orgs rotate — free orgs cap at 2 active projects) and calls `POST /v1/projects` on the Management API.
4. **Cold boot is 2–5 minutes** — the worker polls every ~20 s until the project reports `ACTIVE`. Keys never exist before this.
5. Fetch the project URL, `anon` key and `service_role` key via the Management API.
6. **Encrypt the keys** (AES-256-GCM app-layer, or Vault) → insert the `projects_registry` row → allocate the next prefix (`img03`).
7. Registry cache refresh → node live. The operator never opens the Supabase dashboard.

**Throttling (anti-ban):** the queue hard-caps automated creation at **1–2 projects/day, staggered** — mass-creating 5 orgs + 10 projects in a burst can get the whole account flagged as spam.

**Hard rule:** production provisioning uses the Supabase **Management REST API** (`https://api.supabase.com/v1/…`) via plain `fetch`. The Supabase CLI is for local development only and has no role inside the running product.

---

## 9. Core logic 5 — keep-alive engine (anti-pause)

- A cron (Vercel Cron endpoint or Cloudflare Scheduled Worker, guarded by `CRON_SECRET`) fires **every 3 days**.
- For every `is_active` node it sends the lightest possible authenticated request (a trivial PostgREST select) and stamps `last_keepalive_at`.
- A node that answers like a paused project gets `is_paused = true` → dashboard alert (optionally auto-request a restore via the Management API).
- 3-day cadence ⇒ two missed runs still land inside the 7-day pause window.

---

## 10. Problems → solutions matrix

| # | Problem | Solution (detail) |
|---|---|---|
| 1 | 500 MB DB / 1 GB storage / 5 GB egress hard limits | Auto-sharding: provision at 90%, shift new writes (§6) |
| 2 | 7-day inactivity pause | Keep-alive cron, every 3 days (§9) |
| 3 | Proxy adds a routing hop (latency) | Edge deployment + stateless Smart IDs — routing is a string split + cache hit (§5) |
| 4 | Every project has its own JWT secret; RLS can't span projects | Identity-provider pattern: Master owns users; nodes are service-key-only and user-blind (§7) |
| 5 | 2 active projects per org | Multi-org provisioning; registry tracks org_id + project_ref (§8) |
| 6 | Anti-abuse rate limits / ban risk | Throttled provisioning queue, 1–2/day (§8) |
| 7 | Realtime WebSockets are resource-heavy to proxy across shards | Phase 1 = REST + Storage only; Phase 2 = pub/sub broker (§21) |

---

## 11. Master database schema

```sql
-- Every connected free-tier Supabase project ("node")
create table public.projects_registry (
  id                         uuid primary key default gen_random_uuid(),
  node_prefix                varchar(20) unique not null,   -- 'img01', 'txt01', 'pdf01', 'mix01'
  node_name                  varchar(100) not null,        -- 'Image Storage Node 1'
  data_type                  varchar(20) not null
                             check (data_type in ('images','text','pdfs','mixed')),

  -- connection details (keys encrypted at rest)
  supabase_url               text not null,                -- https://xyz.supabase.co
  service_role_key_encrypted  text not null,                -- AES-256-GCM ciphertext
  anon_key_encrypted         text not null,                -- AES-256-GCM ciphertext

  -- for Management API operations (keep-alive, restore, retire)
  organization_id            varchar(50) not null,
  project_ref                varchar(50) not null,

  -- capacity & health
  storage_used_mb            decimal(10,2) default 0,
  storage_limit_mb           decimal(10,2) default 500,
  egress_used_gb             decimal(10,2) default 0,
  egress_limit_gb            decimal(10,2) default 5,
  is_active                  boolean default true,         -- false = full / retired
  is_paused                  boolean default false,        -- detected by keep-alive
  last_keepalive_at          timestamptz,
  last_provisioned_at        timestamptz default now(),

  created_at                 timestamptz default now(),
  updated_at                 timestamptz default now()
);

create index idx_projects_registry_prefix on public.projects_registry(node_prefix);
create index idx_projects_registry_type_active on public.projects_registry(data_type, is_active);

-- Throttled provisioning jobs (max 1–2 per day)
create table public.provisioning_queue (
  id                     uuid primary key default gen_random_uuid(),
  requested_data_type    varchar(20) not null,             -- images | text | pdfs | mixed
  requested_by          uuid references auth.users(id),
  status                varchar(20) default 'pending'
                        check (status in ('pending','processing','completed','failed')),
  result_node_prefix    varchar(20),                       -- set on success
  error_message         text,
  created_at            timestamptz default now(),
  processed_at          timestamptz
);
```

Hardening: enable RLS on both tables (service role / dashboard admin only); never select the encrypted-key columns into client-facing queries; never log them.

---

## 12. Universal API gateway contract

**Base URL:** `https://api.buttbase.io/v1` — edge-deployed. The client never sees a `*.supabase.co` URL.

| Method | Universal path | Proxied to |
|---|---|---|
| POST | `/v1/data?type=…&table=…` | `{node}/rest/v1/{table}` — Gateway picks the node by category & capacity |
| GET | `/v1/data/{smart_id}?table=…` | `{node}/rest/v1/{table}?id=eq.{uuid}` |
| PATCH | `/v1/data/{smart_id}?table=…` | `{node}/rest/v1/{table}?id=eq.{uuid}` |
| DELETE | `/v1/data/{smart_id}?table=…` | `{node}/rest/v1/{table}?id=eq.{uuid}` |
| POST | `/v1/storage/{bucket}` (multipart) | `{node}/storage/v1/object/{bucket}` — returns a Smart ID |
| GET | `/v1/storage/{bucket}/{smart_id}` | `{node}/storage/v1/object/{bucket}/{uuid}` |

**Auth flow:**
- Client → Gateway: `Authorization: Bearer <master_jwt>` (issued by the Master).
- Gateway → Node: `apikey: <node_service_role>` + `Authorization: Bearer <node_service_role>` (decrypted server-side, never logged, never returned).

**Errors:** on node 5xx/timeout → log to Edge Logs, return a clean JSON error (`{"error":"node_unavailable","node":"img01"}`). The underlying node URL must never leak.

**Illustrative client usage:**

```ts
const BB_URL = 'https://api.buttbase.io/v1';

// WRITE — the router picks the node (category: images)
const res = await fetch(BB_URL + '/data?type=images&table=profile_pics', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + masterJwt, 'Content-Type': 'application/json' },
  body: JSON.stringify({ owner: user.id, filename: 'me.png' }),
});
const { id } = await res.json();   // → { "id": "img01_9f8e3c2a-…" }

// READ — the prefix routes itself
const row = await fetch(BB_URL + '/data/' + id + '?table=profile_pics', {
  headers: { Authorization: 'Bearer ' + masterJwt },
});
```

---

## 13. End-to-end lifecycle (concrete example)

1. **Dev signs up** → gets a Master project + registry (control plane).
2. Dev clicks **"Add Image Storage"** → enqueues a provisioning job.
3. **Provisioner** creates org `buttbase-img-03` → project `img-node-03` → polls ~3 min → fetches keys.
4. **Registry** row: `img03 · images · url · keys(encrypted)`; the cache refresh makes it live.
5. Dev **uploads** → `POST /v1/storage/images` → Gateway picks `img03` (most free capacity) → returns `img03_abc123…`.
6. Dev **fetches** → `GET /v1/storage/images/img03_abc123…` → prefix `img03` → proxy → bytes.
7. `img03` crosses **450 MB** → marked full → job enqueued → `img04` provisioned → new writes shift.
8. **Cron, 3 days later** → pings every node → stamps `last_keepalive_at` → nothing ever pauses.
9. Dashboard **Logs view**: `[200 OK] POST /v1/storage/images → img03 (24ms)`.

---

## 14. UI/UX — final direction: "Supabase × OmniRoute"

The dashboard follows the **official Supabase dashboard** design language mixed with **OmniRoute's analytics vibe**. (Two earlier drafts were rejected: glassmorphism + neon purple/cyan = generic AI-slop; "Industrial Swiss" matte-black = clean but cold. Supabase emerald is familiar to exactly the target user — a Supabase developer.)

**Design tokens**

| Token | Value |
|---|---|
| App background | `#111312` |
| Panels / sidebar | `#1c1c1c` |
| Borders | `#2e2e2e`, thin & subtle |
| Accent | Supabase emerald `#3ECF8E` — primary buttons (green bg, black text), active states, metrics |
| Muted text | `#8b8d91` |
| UI font | Inter / Geist |
| Mono font | Roboto Mono / Geist Mono — node IDs, keys, logs |
| Shape | `rounded-md`, subtle modal shadows, crisp grids, no heavy blur |

**Layout**
- **Left sidebar** (fixed): ButtBase logo + green database-node icon · nav: `Overview` · `Databases (Nodes)` · `Omni-Router` · `Logs` · `Settings` · active link = green text + green tint · footer: user profile + `⌘K` hint.
- **Top header:** breadcrumbs (`Organizations / ButtBase-Org / Overview`) + emerald **"New Node"** button on the right.

**Views**
1. **Overview** (OmniRoute analytics): 3 metric cards — Total Requests · Avg Latency (ms) · Active Nodes — with green/red trend arrows (`+12%`); a traffic-over-time line chart; a **Quick Integration** card with the universal init snippet + copy icon.
2. **Databases:** a high-density **data table** (not cards): `Project Name` · `Node ID` (mono) · `Storage Used` (progress bar — red at ≥90%) · `Region` · `Status` (green pulsing dot) · `⋯` row actions.
3. **Omni-Router:** a visual **Rule Builder** (`IF request = image → ROUTE TO img01 | img02`) + **Universal Secrets** (Master URL + token, masked with a reveal toggle).
4. **Logs:** full-bleed terminal (`#0a0a0a`, mono) streaming proxy lines like `[200 OK] POST /v1/storage/images → img03 (24ms)`; status codes color-coded; a "Pause stream" toggle.

**Interactions:** `⌘K` global command palette doubling as the **AI command line** ("provision 2 more image nodes") — no floating chatbots or orbs. Snappy <150 ms transitions. Desktop power-users first.

> The 4-part UI vibe-coding prompt series (Master UI → Registry schema → Provisioning engine → Edge router → Keep-alive cron) exists as a separate companion doc — use it for frontend codegen.

---

## 15. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + Tailwind + shadcn/ui + Lucide | Supabase-dashboard look, rapid DX |
| Gateway (data plane) | Next.js Edge API routes or Cloudflare Workers | Global edge, no cold starts, no single server to crash |
| Master DB / auth | Supabase (PostgreSQL + GoTrue) | Dogfooding, built-in auth, Vault |
| Provisioner | Node.js/TypeScript worker + pg-boss/BullMQ | Reliable queue, retries, throttling |
| Registry cache | In-memory on edge + Upstash Redis, 5–10 min TTL | Sub-ms routing lookups; the Master DB stays off the hot path |
| Encryption | Web Crypto AES-256-GCM (or Vault) | Native, standard, dependency-free |
| Cron / keep-alive | Vercel Cron or Cloudflare Scheduled Workers | Managed, free |
| Analytics | Custom `edge_logs` table + platform analytics | Own the data, OmniRoute-style metrics |

---

## 16. Monorepo structure

```
buttbase/
├── apps/
│   ├── dashboard/                  # Control plane UI (Next.js)
│   │   └── src/
│   │       ├── app/(dashboard)/
│   │       │   ├── page.tsx        # Overview (metrics + chart + snippet)
│   │       │   ├── databases/      # Node table + Provision modal
│   │       │   ├── router/         # Omni-Router rules + Universal Secrets
│   │       │   ├── logs/           # Terminal-style traffic logs
│   │       │   └── settings/       # Master config (PAT, encryption key)
│   │       ├── components/         # Sidebar, Header/Breadcrumbs, ⌘K palette
│   │       └── lib/                # supabase.ts (master), registry-cache.ts
│   ├── gateway/                   # Data plane (edge router)
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── data/[...path].ts      # REST proxy
│   │       │   ├── storage/[...path].ts  # Storage proxy
│   │       │   └── health.ts             # Health check
│   │       ├── lib/
│   │       │   ├── smart-id.ts            # parse/validate Smart IDs
│   │       │   ├── registry-cache.ts     # memory + Redis, TTL refresh
│   │       │   ├── auth.ts                # master JWT verification
│   │       │   └── proxy.ts               # transparent HTTP proxy core
│   │       └── middleware.ts              # auth, rate limit, logging
│   └── provisioner/               # Background service
│       └── src/
│           ├── queue.ts                   # throttled job queue (1–2/day)
│           ├── supabase-management.ts     # Management API client (fetch)
│           ├── provision.ts               # org → project → poll → keys
│           ├── encryption.ts              # AES-256-GCM helpers
│           └── health-check.ts            # keep-alive pings
├── packages/
│   ├── shared-types/              # Registry, SmartId, API contracts
│   └── encryption/                 # Shared crypto utils
├── turbo.json
└── package.json
```

---

## 17. Environment variables

```bash
# Master Supabase (control plane + auth)
MASTER_SUPABASE_URL=https://master-project.supabase.co
MASTER_SUPABASE_SERVICE_ROLE_KEY=eyJ…
MASTER_SUPABASE_ANON_KEY=eyJ…

# Supabase Management API (provisioning)
SUPABASE_MANAGEMENT_PAT=sbp_…            # the operator's PAT — most sensitive secret

# Encryption (AES-256-GCM, 32-byte key, base64)
REGISTRY_ENCRYPTION_KEY=…

# Gateway
GATEWAY_BASE_URL=https://api.buttbase.io

# Keep-alive cron
CRON_SECRET=…                            # verifies cron invocations

# Registry cache (optional, cross-region)
REDIS_URL=…                              # e.g. Upstash
```

Never commit these. Rotate the PAT quarterly.

---

## 18. DOs & DON'Ts — strict rules (non-negotiable)

### ✅ DOs
1. **DO** deploy the Gateway on edge runtimes (Next.js Edge routes / Cloudflare Workers) — never a single long-running server.
2. **DO** cache the registry aggressively (in-memory + Redis/KV, 5–10 min TTL) — the Master DB is never queried on the per-request hot path.
3. **DO** encrypt every `service_role` key before it touches the database (AES-256-GCM or Vault).
4. **DO** proxy REST (`/rest/v1/…`) and Storage (`/storage/v1/…`) transparently — preserve method, headers, query params, body; stream responses.
5. **DO** handle node failures gracefully: log to Edge Logs, return a clean error, keep the node's URL out of it.
6. **DO** log every proxied request's metadata (node, latency, status) for the analytics dashboard.
7. **DO** use strict TypeScript; share registry / Smart-ID / API types from `packages/shared-types`.
8. **DO** keep the Master project metadata-only (users + registry + queue — never payload data).
9. **DO** throttle provisioning (max 1–2 projects/day) and poll project status every ~20 s through the 2–5 min cold boot.

### ❌ DON'Ts (each paired with the behavior to do instead)
1. **DON'T** use stateful routing (no DB query to locate a record) → route by parsing the Smart ID prefix only.
2. **DON'T** proxy WebSockets / Realtime in Phase 1 → ship REST + Storage; Realtime waits for the Phase-2 pub/sub broker.
3. **DON'T** run the Supabase CLI inside the product → provision via Management REST API `fetch` calls.
4. **DON'T** forward client JWTs to data nodes → the Gateway validates once and uses node service keys; nodes stay user-blind.
5. **DON'T** expose node URLs/keys to the frontend → the client sees only `api.buttbase.io`.
6. **DON'T** hardcode Supabase project references → everything resolves through the registry at runtime.
7. **DON'T** put plaintext secrets in code, logs, or error messages → env vars + encryption only.
8. **DON'T** burst-provision orgs/projects → stay inside the throttled queue (anti-ban).
9. **DON'T** attempt cross-node JOINs or merged SELECTs in Phase 1 → target exactly one node per request.

---

## 19. Implementation phases

- **Phase 1 — Foundation (wk 1–2):** Master project + `projects_registry` schema → dashboard UI (Supabase-emerald, ⌘K) → edge-router skeleton (parse Smart ID → cache lookup → proxy) → 60 s registry sync.
- **Phase 2 — Provisioning engine (wk 2–3):** Management API client (org → project → poll → keys) → encryption service → throttled queue → "Provision Node" button wired to it.
- **Phase 3 — Keep-alive & monitoring (wk 3):** 3-day cron → ping all nodes → update `last_keepalive_at` / `is_paused` → node-health cards with capacity bars.
- **Phase 4 — Storage proxy & polish (wk 4):** `/storage/` endpoints → upload → node pick → Smart ID → OmniRoute-style logs/analytics → ⌘K AI commands ("provision image node", "show node health").
- **Phase 5 — Hardening (ongoing):** gateway rate limiting → circuit breaker + failover for dead nodes → observability → key rotation.

---

## 20. Security model

1. **Service keys** — encrypted at rest, decrypted only inside Gateway/Provisioner, never logged, never sent to any client.
2. **Management PAT** — the single most dangerous credential: encrypted config/Vault only, quarterly rotation, provisioning worker only.
3. **Client isolation** — clients hold only the Universal URL + master JWT; nodes are unreachable from the internet-facing app.
4. **Registry protection** — RLS on Master tables (service role / dashboard admin only); key columns never selected into client-facing queries.
5. **Audit trail** — every provisioning action and every proxied request's metadata is logged.
6. **CORS** — strict allowlist at the Gateway; nodes carry no client-facing CORS at all.

---

## 21. Known gaps, risks & Phase-2 ideas (honest engineering)

1. **ToS / anti-abuse risk — the big one.** Mass-creating free orgs/projects to aggregate capacity can be judged free-tier abuse. Throttling + human pacing reduce but cannot eliminate it; worst case = account termination. Mitigations: keep volumes modest (5–10 nodes), real usage only, and never store irreplaceable data solely on farmed nodes — the Postgres export / self-host escape hatch is the backup plan. For context: one $25/mo Pro project includes 8 GB DB — ButtBase is the zero-dollar path, not the lazy path; build it because building it is the point.
2. **The Master is itself a free project** — keep it metadata-only and it lives easily inside 500 MB; payload data never passes through it.
3. **"List all my X" queries fan out** — pure prefix routing has no reverse index, so owner-scoped listings must query every node of a category in parallel (fine at N ≤ 10) — or add an optional Phase-2 **owner index** for listings only (never per-record routing).
4. **Realtime** — Phase 2: a pub/sub broker; the Gateway holds one Realtime listener per node and fans changes out to subscribed clients.
5. **No cross-node queries in v1** — per-record, per-node by design; a federated query engine is out of scope.
6. **SPOF is mitigated, not eliminated** — edge/serverless removes the single machine; the Gateway is still a logical dependency of every request. Keep it boring and managed.
7. **Cold boot is slow (2–5 min)** — that is why provisioning triggers at 90% capacity, never at 100%.

---

## 22. Glossary (canonical terms — use these everywhere)

| Term | Meaning |
|---|---|
| **Node** | One free-tier Supabase project, registered in the registry and used as a shard |
| **Master** | The single Supabase project holding auth users + registry + queue (metadata-only) |
| **Gateway / Edge Router** | The stateless serverless proxy clients talk to (`api.buttbase.io/v1`) |
| **Smart ID** | `{node_prefix}_{uuid}` — the self-routing identifier the Gateway returns |
| **Prefix** | The routing token embedded in a Smart ID (`img01`, `txt03`) naming the target node |
| **Registry** | The `projects_registry` table: URLs, encrypted keys, prefixes, capacity, health |
| **Control plane** | Dashboard + Provisioner + Keep-Alive — manages infra, never sees request data |
| **Data plane** | The Gateway itself — the hot path |
| **PAT** | Supabase Personal Access Token used against the Management API |
| **Category** | A node's data type: `images` / `text` / `pdfs` / `mixed` |
| **Keep-Alive** | The 3-day cron ping that prevents the 7-day pause |
| **Provisioning queue** | Throttled job queue that creates nodes (max 1–2/day) |

---

## 23. The manifesto

> Supabase's free tier is generous but fragmented: 500 MB here, 1 GB there, 5 GB of egress, a 7-day pause, 2 projects per org. Individually, they're limits. Orchestrated together, they're an infinite free backend.
>
> B.U.T.T. Base turns fragmentation into federation.
>
> **One URL. One key. Infinite scale. Zero dollars.**

---

*idea.md v1.0 — agent-ready master context for B.U.T.T. Base. Import into project knowledge before generating any code.*
