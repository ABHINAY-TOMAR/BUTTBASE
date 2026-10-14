# Research Notes (v1 build)

Date: 2026-10-10 · Method: GitHub CLI (gh, authenticated) + direct fetches of `supabase/supabase` and `diegosouzapw/OmniRoute`. (agent-reach CLI was not on PATH/`.venv` on this machine; built-in web search was down — HTTP 402 on its endpoint. gh + raw fetches covered everything.)

## 1. Supabase Management API — confirmed facts

Source: [apps/docs/spec/api_v1_openapi.json](https://github.com/supabase/supabase/blob/master/apps/docs/spec/api_v1_openapi.json) (115 paths, title "Supabase API (v1)").

| Need | Endpoint | Body / notes |
|---|---|---|
| Create organization | `POST /v1/organizations` | **exists** (summary: "Create an organization"); required: `{ name }` (max 256). idea.md §8 validated. |
| List orgs | `GET /v1/organizations` | for capacity-aware org picker |
| Create project | `POST /v1/projects` | required: `db_pass, name, organization_slug`; region via `region_selection: { type: "specific", code }` (`region` is deprecated); `plan` deprecated (set on org). |
| Poll readiness | `GET /v1/projects/{ref}` | cold boot 2–5 min; poll ~20 s until ACTIVE |
| Keys | `GET /v1/projects/{ref}/api-keys` · `POST` (create key) · `GET/PUT /api-keys/legacy` | legacy endpoint only reports whether legacy (anon, service_role) keys are **enabled** (`{enabled:boolean}`) and "will be removed in the future". Exact list/create response shape needs one live-PAT verification → `TODO(live-verify)` in provisioner. |
| Health / keep-alive | `GET /v1/projects/{ref}/health` | "Gets project's service health status" |
| Pause / restore | `POST /v1/projects/{ref}/pause` · `GET,POST /restore` | auto-restore of paused nodes is possible |
| Capacity metrics | `GET /v1/projects` · `/analytics/endpoints/usage.api-requests-count` · `/config/disk/util` | feed the capacity manager |

The v2 spec (34 paths) has no org/project creation — provisioning stays on **v1**.

## 2. OmniRoute (the inspiration product)

- Repo: [diegosouzapw/OmniRoute](https://github.com/diegosouzapw/OmniRoute) · 74.7K stars · MIT · homepage https://omniroute.online · default branch `release/v3.8.52`.
- What it is: "one endpoint, 359 providers (150+ free)" AI gateway — multiple provider credentials behind one universal endpoint. Exactly the pattern ButtBase applies to Supabase projects.
- Dashboard views (from `docs/screenshots/`): providers, combos, **analytics**, health, translator, settings, cli-tools, **usage**, endpoint, free-tiers.
- Design takeaways adopted in our dashboard: analytics-first overview, honest "free-tier budget" cards (live used/remaining, deduped math), terminal-flavored internals, ⌘K-style ergonomics.

## 3. Supabase design language

- Brand green **#3ECF8E** confirmed in repo (e.g. `apps/kb/src/styles/globals.css`, `apps/studio/.../Charts.constants.ts`). Dashboard backgrounds from user's own screenshots: app `#111312`, panels `#1c1c1c` (idea.md §14).
- Current supabase.com font stack (from `apps/kb/src/styles/globals.css`): **Inter** (body) + **Manrope** (headings) + **Source Code Pro** (mono); docs type scale is deliberately dense (`text-sm: 0.8125rem` = 13px, `text-base: 0.9375rem`).
- The dashboard itself (`apps/studio`) and a design-system registry app (`apps/design-system`) are public Next.js apps — proof the "Supabase-style Next.js dashboard" target is their own stack.

## 4. Design-tool findings (ui-ux-pro-max)

Its `--design-system` generator (variance 4 / motion 3 / density 8) suggested glassmorphism + `#22C55E` + Fira fonts. **Rejected** — idea.md §14 pins Supabase-emerald on `#111312` and the frontend-design rule says the brief's pinned direction wins. Adopted from it: dense spacing scale, the pre-delivery checklist (SVG icons only, visible focus, 150–300 ms hovers, reduced-motion respect), and "Real-Time/Operations" pattern cues (pause controls on live streams, update-time labels).

## 5. Open items

- **api-keys response shape** — parsed defensively; needs one live PAT test (`TODO(live-verify)`).
- Full region enum list (spec truncation) — `BB_DEFAULT_REGION` defaults to `ap-south-1`.
- Image viewing was unavailable this session (model lacks image input), so OmniRoute screenshots were downloaded (`.tmp-research/`) but not visually inspected; textual structure was used instead.
