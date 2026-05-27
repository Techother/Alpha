# Alpha Health Track — GSD Workflow Guide

## Project

**Alpha Health Track — Security Hardening & Production Readiness**

Clinical RPM web app. This milestone hardens the app for production: moves all third-party API secrets server-side via Vercel proxy functions, adds clinical test coverage, resolves schema ambiguity, decomposes the monolithic App.tsx, wires up react-router-dom v7, and deploys to Vercel.

Planning: `.planning/`
State: `.planning/STATE.md`
Roadmap: `.planning/ROADMAP.md`

## GSD Workflow

### Phase Workflow
```
/gsd-discuss-phase <N>   → gather context, clarify approach
/gsd-plan-phase <N>      → create PLAN.md with task breakdown
/gsd-execute-phase <N>   → execute all plans in the phase
/gsd-verify-work <N>     → verify phase goals were met
```

### Navigation
```
/gsd-progress            → check current status, advance workflow
/gsd-resume-work         → resume after a break (reads STATE.md)
/gsd-map-codebase        → refresh codebase understanding
```

## Architecture Constraints

- **No VITE_-prefixed third-party credentials** — Airtable, Slack, Google Calendar, Anthropic keys are server-only
- **All proxy functions must verify Supabase JWT** — return 401 for unauthenticated requests
- **Follow `api/send-sms.js` pattern** for new Vercel serverless functions
- **react-router-dom v7 `createBrowserRouter`** — not legacy BrowserRouter
- **Vitest** (not Jest) — consistent with Vite ecosystem
- **`tsc --noEmit` must pass** after each component extraction step

## Phase Order

| # | Phase | Key Deliverable |
|---|-------|-----------------|
| 1 | Schema Clarity | `supabase/README.md`, archived stale schemas |
| 2 | Vercel Setup | `vercel.json`, env vars in dashboard, `vercel dev` working |
| 3 | API Proxy Functions | `api/proxy-airtable.js`, `api/proxy-slack.js`, `api/proxy-gcal.js`, `api/chat.js` |
| 4 | Credential Cleanup | Zero VITE_ third-party vars, bundle audit passes |
| 5 | Testing | Vitest, 100% branch coverage on PHQ-9/GAD-7/CPT billing |
| 6 | Routing Foundation | react-router-dom v7 wired, all setSection() replaced |
| 7 | Component Decomposition | App.tsx → 10 pages + layout, lazy-loaded |
| 8 | Production Deploy | `vercel deploy --prod`, smoke tests pass |

## Local Development

### Dev Workflows

| Command | Port | Use When |
|---------|------|----------|
| `npm run dev` | 5173 | UI-only work — fast Vite HMR, no API functions |
| `npm run dev:vercel` | **3000** | Full stack — frontend + all api/ functions together |

**Important:** When testing API proxy functions locally, always use `npm run dev:vercel`
and access the app at `http://localhost:3000`. Opening `localhost:5173` while `vercel dev`
is running will serve the Vite frontend but `/api/*` routes will 404 because they only
exist on the Vercel dev proxy port.

### Environment Variables

- `vercel dev` automatically loads Development env vars into memory — no manual pull needed.
- To get a local `.env.local` for `npm run dev` (Vite-only): run `vercel env pull .env.local`
  from inside `cardiotrack/`.
- `.env.local` is gitignored via the `*.local` pattern — never commit it.
- `.vercel/` is gitignored — never commit it (contains org/project IDs, not credentials,
  but should not be shared).

### Adding New API Functions

Follow the pattern in `api/send-sms.js`:
- ESM: `export default async function handler(req, res)`
- Access secrets via `process.env.VAR_NAME` (no VITE_ prefix)
- Return early with 500 if required env vars are missing
- Phase 3 adds JWT verification — all proxy functions must verify Supabase JWT

## Security Rules

1. Never add `VITE_` prefix to Airtable, Slack, Google Calendar, Anthropic, or Twilio keys
2. Every proxy function (`api/*.js`) must verify the Supabase JWT before forwarding
3. CORS: allow only known origins (localhost:5173, VERCEL_URL, PRODUCTION_URL)
4. The `.env.example` file is the authoritative list of required variables — keep it current

## Test Requirements

Clinical logic requires 100% branch coverage before any structural changes:
- `src/api/screening.ts` — `scorePHQ9`, `scoreGAD7`
- `src/api/billing.ts` — `cpt99454Met`, `cpt99457Met`, `cpt99458Count`
- `src/api/tcm.ts` — `addBusinessDays`, `addCalendarDays`

## Current Status

See `.planning/STATE.md` for live progress.
