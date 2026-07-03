---
title: Current Status
source: .planning/STATE.md
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [status, progress]
status: current
---

# Current Status

## What's Done

- Phase 1: Schema Clarity — VERIFIED ✓ (v3 RLS schema authoritative, stale files archived)
- Phase 2: Vercel Setup — VERIFIED ✓ (vercel.json, env vars, dev:vercel script working)
- Phase 3: API Proxy Functions — VERIFIED ✓ (proxy-airtable, proxy-slack, proxy-gcal, send-sms; JWT auth enforced on all)
- Phase 4: Credential Cleanup — VERIFIED ✓ (zero VITE_-prefixed third-party keys in bundle)
- Phase 5: Testing — VERIFIED ✓ (42 Vitest tests, 100% branch coverage on PHQ-9/GAD-7/CPT billing)
- Phase 6: Routing Foundation — VERIFIED ✓ (createBrowserRouter, 12 routes, NotFound catch-all, zero setSection calls)

## What's Next

**Phase 7: Component Decomposition** — Active, not started
- Plan 07-01: Extract pages from App.tsx (`src/pages/` + `src/components/layout/`)
- App.tsx is a 2023-line monolith — decompose with lazy loading, `tsc --noEmit` after each extraction
- No new features during decomposition — pure structural refactor
- Column duality gap RESOLVED (2026-05-29): all query sites in `supabase.ts` and `App.tsx` now use v3 column names (`breathlessness`, `swelling`, `medications`, `free_text`, `checked_in_at`); v1-style aliases from migration 003 are dead weight, pendng a cleanup migration

**After Phase 7 → Phase 8: Production Deploy**
- `vercel deploy --prod`, smoke test all proxy endpoints

## What's Blocked

- DEPL-03: Development env vars not yet added to Vercel dashboard (noted Phase 2 — needed before Phase 8)

## Key Numbers

- 8 total phases | 6 complete | 2 remaining (7, 8)
- 18 total plans | 16 complete
- 42 tests passing | 100% branch coverage on clinical logic

## See Also

- [[project-overview]]
- [[sources-and-data]]
