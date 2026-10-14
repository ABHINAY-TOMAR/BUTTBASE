# ADR-004: Zero-touch provisioning via the Supabase Management API

**Status:** Accepted (api-keys fetch marked live-verify) · **Date:** 2026-10-10

## Context
idea.md §8: operator only ever types a node name + data category. Research (docs/research-notes.md) confirmed the Management API v1 supports it end-to-end.

## Verified capabilities (api_v1_openapi.json)
- `POST /v1/organizations` — create-org EXISTS (`{name}`)
- `POST /v1/projects` — required `db_pass, name, organization_slug`; region via `region_selection`
- `GET /v1/projects/{ref}` — status polling (cold boot 2–5 min → poll 20 s)
- `GET /v1/projects/{ref}/api-keys` + `POST` (create), legacy check endpoint
- `GET /health`, `POST /pause`, `POST /restore`

## Decision
The provisioner (Node worker, plain fetch, PAT bearer):
1. pick org: fewest active free projects (<2) else `createOrganization`
2. `createProject` with generated `db_pass` + `BB_DEFAULT_REGION`
3. poll to ACTIVE; fetch keys (list → fallback create; `TODO(live-verify)` on response shape)
4. encrypt keys → insert `projects_registry` row → allocate next prefix per category
5. throttled queue: max `PROVISION_MAX_PER_DAY` (default 2/day) — anti-ban pacing
6. CLI not used anywhere (§18 DON'T-3)

## Consequences
- Org rotation is fully automatable — the "2 active projects per org" wall is soft.
- Keys fetch is the one unverified live path; parser is defensive and the failure mode is a clear queue error, not silent bad data.
- ToS risk stands regardless (idea.md §21) — throttling reduces but does not eliminate it.
