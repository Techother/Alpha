---
title: Sources and Data
source: session
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [data, integrations, airtable, supabase]
status: current
---

# Sources and Data

## Data Layer

### Airtable (Primary Store)

All patient records and vitals live in Airtable. Accessed exclusively through `api/proxy-airtable.js` — no direct browser-to-Airtable calls.

### Supabase (Auth + RLS)

Authentication and row-level security. Active schema is **v3**, documented in `supabase/README.md`.

Migrations:
- `supabase/migrations/001_v3_foundation.sql` — core tables
- `supabase/migrations/003_v3_extension.sql` — v3 extensions
- `supabase/migrations/004_fix_rls.sql` — RLS policy corrections

Archived (superseded):
- `supabase/archive/schema.sql` (v1)
- `supabase/archive/schema_v2.sql` (v2)

## Integrations

| Service | Proxy | Credential Location |
|---------|-------|---------------------|
| Airtable | `api/proxy-airtable.js` | Vercel env (server-only) |
| Slack | `api/proxy-slack.js` | Vercel env (server-only) |
| Google Calendar | `api/proxy-gcal.js` | Vercel env (server-only) |
| Twilio SMS | `api/send-sms.js` | Vercel env (server-only) |
| Supabase | Direct (anon key) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Note: Supabase anon key is intentionally VITE_-prefixed — it is public by design; RLS enforces access control.

## Raw Sources

Raw files (PDFs, exports, screenshots) stay outside Git. The manifest at `manifests/raw_sources.csv` is the index. Before using any external file, verify it is registered there.

## Environment Variables (Vercel — server-only)

Source: [[training-guide]] Section C2. All stored in Vercel dashboard. Never in code or Slack.

| Variable | Service | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side JWT verification |
| `SUPABASE_JWT_SECRET` | Supabase | Auth token validation |
| `AIRTABLE_API_KEY` | Airtable | Backlog/sprint management |
| `AIRTABLE_BASE_ID` | Airtable | Backlog/sprint management |
| `SLACK_BOT_TOKEN` | Slack | Team alerts & messaging |
| `SLACK_CHANNEL_ID` | Slack | Default care team channel |
| `TWILIO_ACCOUNT_SID` | Twilio | Patient SMS check-ins |
| `TWILIO_AUTH_TOKEN` | Twilio | Patient SMS check-ins |
| `TWILIO_FROM_NUMBER` | Twilio | Outbound SMS phone number |
| `GCAL_SERVICE_ACCOUNT_JSON` | Google Calendar | Appointment sync |
| `GCAL_CALENDAR_ID` | Google Calendar | Appointment sync |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only intentionally client-exposed vars (anon key is public by design; RLS enforces access).

## See Also

- [[project-overview]]
- [[current-status]]
