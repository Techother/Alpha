---
title: Project Overview
source: .planning/PROJECT.md
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [architecture, stack, constraints]
status: current
---

# Project Overview

MKL Health is a clinical remote patient monitoring (RPM) web app for healthcare providers managing patients with cardiovascular and chronic conditions. Clinicians monitor vitals, track billing CPT codes, run clinical screenings, manage medications, and coordinate transitional care.

**Core value:** Sensitive API credentials never reach the browser or public internet.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Vite 8 |
| Routing | react-router-dom v7 (`createBrowserRouter`) |
| Auth | Supabase (email/password) |
| Data | Airtable (primary), Supabase (auth + RLS) |
| Serverless | Vercel Functions (Node.js ESM) |
| Testing | Vitest |
| SMS | Twilio via `api/send-sms.js` |
| Notifications | Slack via `api/proxy-slack.js` |
| Calendar | Google Calendar via `api/proxy-gcal.js` |
| Deploy | Vercel |

## Architecture Constraints (Non-Negotiable)

1. **No VITE_-prefixed credentials** — Airtable, Slack, Google Calendar, Anthropic, Twilio keys are server-only
2. **All proxy functions verify Supabase JWT** — return 401 for unauthenticated requests
3. **Follow `api/send-sms.js` pattern** for new serverless functions
4. **react-router-dom v7 `createBrowserRouter`** — not legacy BrowserRouter
5. **Vitest** (not Jest)
6. **`tsc --noEmit` must pass** after each component extraction step

## Serverless Functions

| File | Purpose |
|------|---------|
| `api/send-sms.js` | Twilio SMS patient check-ins |
| `api/proxy-airtable.js` | Airtable patient data |
| `api/proxy-slack.js` | Slack notifications |
| `api/proxy-gcal.js` | Google Calendar appointments |

## Clinical Routes (10)

Dashboard · Billing (CPT 99454/99457/99458) · PHQ-9 · GAD-7 · Medications · TCM · Vitals · Patients · Settings · Admin

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | 2023-line monolith (Phase 7 decomposes this) |
| `src/api/screening.ts` | PHQ-9 / GAD-7 scoring |
| `src/api/billing.ts` | CPT qualification logic |
| `src/api/tcm.ts` | TCM date arithmetic |
| `supabase/README.md` | v3 schema documentation |
| `.planning/STATE.md` | Live phase progress |

## Local Dev

| Command | Port | Use When |
|---------|------|----------|
| `npm run dev` | 5173 | UI-only, fast HMR |
| `npm run dev:vercel` | 3000 | Full stack (frontend + api/ functions) |

## See Also

- [[current-status]]
- [[sources-and-data]]
