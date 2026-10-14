# ButtBase Design System (v1)

Pinned by idea.md §14 — "Supabase × OmniRoute". Do not restyle without updating that section first.

## Tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#111312` | app background |
| `panel` | `#1c1c1c` | sidebar, cards, modals |
| `panel-2` | `#232323` | hover rows, input backgrounds |
| `line` | `#2e2e2e` | 1px borders |
| `brand` | `#3ECF8E` | primary actions, active states, metrics (Supabase emerald) |
| `brand-hover` | `#36ba80` | button hover |
| `brand-tint` | `rgba(62,207,142,0.12)` | active nav bg, badges |
| `fg` | `#ededed` | primary text |
| `muted` | `#8b8d91` | secondary text |
| `danger` | `#ef4444` | ≥90% storage bars, 5xx, revoke |
| `warn` | `#f5a623` | paused state, throttled warnings |
| `ok-text` | `#0d1f17` | text on brand buttons |

Contrast (vs `#111312`): `#3ECF8E` ≈ 10.9:1 ✓ · `#ededed` ≈ 13.6:1 ✓ · `#8b8d91` ≈ 4.6:1 ✓ (AA for muted, large use only for body-muted).

## Typography

- Sans: **Inter** (idea.md §14; Supabase's own body font). Headings: Inter 600 — Manrope noted as supabase.com's current heading face, deliberately not adopted in v1 (brief wins).
- Mono: **Roboto Mono** — node IDs, keys, logs, Smart IDs.
- Dense scale (from Supabase docs): `text-sm 13px` is the table body default; base 15px; mono 12–13px in terminal.
- Line length: content column ≤ 80ch; terminal full-bleed.

## Layout

```
┌──────────┬────────────────────────────────────────────────┐
│ SIDEBAR  │  breadcrumbs / organizations / page      [New Node]│
│ 240px    ├────────────────────────────────────────────────┤
│ logo     │                                                │
│ Overview │   view content (dense, 8/10 density)           │
│ Databases│                                                │
│ Router   │                                                │
│ Logs     │                                                │
│ Settings │                                                │
│ ── user  │                                                │
│ ⌘K hint  │                                                │
└──────────┴────────────────────────────────────────────────┘
```

## Components

| Component | Variants | States | A11y |
|---|---|---|---|
| Button | primary (brand bg / ok-text), ghost (panel/line), danger | hover, focus-visible ring, disabled, loading | ≥36px hit area, `cursor-pointer` |
| StatusDot | active (brand, pulse), paused (warn), full (danger), offline (muted) | — | color + text label (never color alone) |
| ProgressBar | normal, warn ≥75%, danger ≥90% | — | has visible % text |
| NodeTable | high-density rows 13px | hover `#1a1a1a`, row menu | keyboard focusable, menu labeled |
| CommandPalette | overlay | open/closed, arrow selection | role=dialog, Escape closes, focus trapped in input |
| TerminalLog | full-bleed mono | streaming / paused | aria-live=polite while streaming |
| SecretsPanel | masked/revealed | reveal toggle | never logs values; copies via clipboard |
| Modal (Provision) | glass-free panel | open/close | Escape closes, focus ring |

## Motion

Snappy <150 ms; no scroll-reveal choreography; pulse animation on StatusDot only; `prefers-reduced-motion` kills the pulse and streaming autoscroll.

## Self-review (frontend-design pass)

- Deliberately NOT generic: emerald-on-#111312 is Supabase's identity (target user is a Supabase dev); terminal Logs view is a product surface, not decoration; "B.U.T.T." stays a restrained wordmark — no cheeky visuals in v1.
- Rejected: ui-ux-pro-max's glassmorphism/#22C55E/Fira (database-match ≠ brand-match; earlier glassmorphism round was already voted down by the user).
- Numbered markers appear only in phase lists (real sequences). No ALL-CAPS eyebrows, no gradient washes, one border-radius family (`rounded-md`).
