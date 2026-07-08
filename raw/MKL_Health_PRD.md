# MKL Health — Product Requirements Document
Version 1.0 · AI-Native Remote Care Platform for Diabetes, Kidney Disease & Medication Outcomes
Prepared For: Solo Founder / MKL Health
Version: 1.0 — Repositioning & UI Overhaul Release
Date: July 2026
Predecessor: CardioTrack (cardiac-only RPM MVP)
Clinical Focus: Diabetes, Chronic Kidney Disease, Medication Outcome Tracking
Entity: Other, LLC

> Transcribed verbatim from user-supplied PDF (MKL_Health_PRD.pdf) for wiki ingestion. Full 12-section PRD covering: executive summary, repositioning rationale, solo-operator business plan, compliance/legal (HIPAA), technical architecture, feature flags, navigation structure, feature specs (AI concierge chat, medication outcome tracking, RPM/PCM/CCM billing, diabetes/CKD modules, care programs), database schema, "Warm Clinical" design system, environment variables, a Claude Code build prompt, pre-launch checklist, and exit strategy.

## 1. Executive Summary
MKL Health is an AI-native remote care platform for solo and small-group practices managing patients with diabetes, chronic kidney disease (CKD), and complex medication regimens. It is the repositioning and UI overhaul of the CardioTrack MVP: same proven tech stack and clinical workflow engine, rebuilt around a broader, more defensible clinical thesis (Cardiovascular-Kidney-Metabolic / CKM syndrome) and a substantially improved patient- and prospect-facing experience.

### 1.1 Strategic Positioning (vs UPL.care)
- Condition Focus: Diabetes + CKD + medication outcomes (CKM cluster) vs all chronic conditions (broad, shallow)
- Check-in Channel: AI concierge chat (landing + in-app) + SMS vs SMS/phone/video/questionnaires
- Medicare Billing: RPM + PCM/CCM tracking with CSV export vs authenticated CPT codes (core)
- Outcome Tracking: Medication-to-lab-result outcome linkage (signature feature) vs adherence logging only
- Care Programs: RPM + CCM + PCM + TCM (BHI placeholder) vs RPM + CCM + TCM + BHI
- Tech Stack: React, Supabase, Stripe, Claude — modern vs managed service / closed platform
- Design: Warm Clinical — chat-first, approachable vs standard SaaS
- Sales Target: Endocrinology, nephrology, internal medicine, cardiology vs multi-specialty practices

### 1.2 Solo Operator Business Model
- Target customer: independent endocrinology, nephrology, internal medicine practices (2-8 physicians), plus cardiology with comorbid diabetes/CKD patients
- Pricing: per-enrolled-patient/month — $35-$55/patient, unchanged tiering logic from CardioTrack
- Revenue story: Medicare RPM/PCM reimbursement exceeds platform cost per patient across all three target specialties
- Operating entity: Other, LLC (existing)

## 2. Why MKL Health — Repositioning from CardioTrack
Underlying platform (codebase, database, integrations) preserved. Changes: clinical scope, brand, front-of-house experience.

| Area | CardioTrack (Predecessor) | MKL Health (This Release) |
|---|---|---|
| Product Name | CardioTrack | MKL Health |
| Clinical Scope | Heart failure only | Diabetes, CKD, medication outcome tracking (cardiac comorbidity supported, not primary) |
| Positioning Frame | Cardiac-specialist RPM vendor | CKM-cluster chronic care platform |
| Landing Page | Static marketing page, form-based lead capture | Chat-first landing experience — AI concierge replaces the lead form |
| Signature Feature | Medicare billing dashboard | Medication Outcome Tracking (labs/vitals linked to medication changes) + billing dashboard |
| Visual Identity | Precision Clinical Noir (dark, clinical) | Warm Clinical (light, approachable, editorial) |
| ICP | Cardiology practices only | Endocrinology, nephrology, internal medicine, cardiology |

Sections 4-9 (compliance, tech stack, feature flags, DB schema) = same architecture as CardioTrack v2, table/field names generalized cardiac-specific → condition-agnostic. Sections 6.1 and 8 are net-new: chat-first landing experience + Warm Clinical design system.

## 3. Solo Operator Business Plan

### 3.1 Ideal Customer Profile (ICP)
Target: independent US practices, 2-8 physicians, meaningful diabetes/CKD population, actively billing or interested in billing Medicare RPM/PCM/CCM.

| Attribute | Definition |
|---|---|
| Practice Type | Endocrinology, nephrology, internal medicine, cardiology (cardiometabolic focus) |
| Size | 2-8 physicians; 50-300 active chronic-disease patients |
| Payer Mix | Majority Medicare or Medicare Advantage |
| Tech Readiness | Uses EHR (Epic/Athena/eCW), open to web-based tools |
| Budget Authority | Physician-owner or practice administrator |
| Pain Points | Missed RPM/PCM billing revenue, manual check-ins, no visibility into medication efficacy |
| Decision Timeline | 4-8 weeks demo to contract |
| Excluded | Hospital systems, large multi-specialty groups, behavioral-health-only, pediatrics |

### 3.2 Pricing Model
Per-enrolled-patient monthly subscription via Stripe, unchanged from CardioTrack.

| Tier | Price/Patient | Est. Practice Earn | Includes |
|---|---|---|---|
| Starter | $35/mo | ~$117 net/mo | RPM, AI check-ins, web+SMS, billing dashboard |
| Growth | $45/mo | ~$112 net/mo | Starter + CCM/PCM time tracking, TCM module |
| Complete | $55/mo | ~$102 net/mo | Growth + medication outcome analytics, advanced reporting, priority support |

Disclaimer required: "Estimated practice earnings based on Medicare national average rates. Actual reimbursements vary by payer contract and geography."

### 3.3 Revenue Model & Milestones
| Milestone | Practices | Avg Enrolled Patients | MRR | ARR |
|---|---|---|---|---|
| Validation | 1-3 | 30/practice | $3,150-$4,500 | ~$50K |
| Early Traction | 5-10 | 50/practice | $8,750-$17,500 | ~$150K |
| Scale/Exit | 20-30 | 60/practice | $42,000-$63,000 | ~$600K |

### 3.4 Go-to-Market Strategy
- Direct outreach across 3 specialties (endocrinology, nephrology, internal medicine) — triples addressable list vs CardioTrack
- Partner with medical billing companies; referral fee on new enrollments
- Target conferences: ADA, ASN, ACP, plus ACC/HFSA for comorbid cardiac
- Content marketing anchored on CKM-syndrome framing

## 4. Compliance & Legal Foundation
PHI stored/transmitted — HIPAA compliance is a legal requirement. Unchanged from CardioTrack v2; no new obligations from broader clinical scope.

| # | Requirement | How to Complete | Status |
|---|---|---|---|
| 1 | BAA with Supabase | Upgrade to Business plan ($25/mo); execute BAA in dashboard | Required |
| 2 | BAA with Anthropic (Claude API) | Contact Anthropic enterprise sales | Required |
| 3 | BAA with Twilio | Enable HIPAA-eligible account; execute BAA online | Required |
| 4 | BAA with Vercel | Vercel Pro + BAA, or route PHI through Supabase Edge Functions | Required |
| 5 | Slack — remove PHI | Patient IDs only in Slack notifications | Required |
| 6 | HIPAA Security Risk Assessment | HHS free SRA Tool (ra.hhs.gov) | Required |
| 7 | Encryption at rest + in transit | Supabase + Vercel HTTPS; document both | Required |
| 8 | Audit logging | Log all PHI access events in Supabase | Build in v1 |
| 9 | Access controls | Row Level Security scoped to practice | Build in v1 |
| 10 | Workforce training documentation | One-page HIPAA training record, signed and dated | Required |

## 5. Technical Architecture

### 5.1 Tech Stack — Unchanged from CardioTrack
Entire CardioTrack technical foundation reused. Only clinical content, data model labels, presentation layer change.

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | Single-page application, section-based state |
| Styling | CSS custom properties (no framework) | Warm Clinical design system (new) |
| Database + Auth | Supabase (PostgreSQL) | PHI storage, row-level security, auth, edge functions |
| AI Engine | Anthropic Claude API | Conversational check-ins, landing-page concierge chat, screening |
| Billing (Customer) | Stripe | Per-patient subscription billing, invoicing, customer portal |
| SMS | Twilio | Daily check-in SMS delivery to patients |
| Notifications | Slack Web API | Clinical team alerts (patient IDs only — no PHI) |
| Calendar | Google Calendar API | TCM deadlines, appointment scheduling, chat-booked demos |
| Backlog | Airtable REST API | Product backlog and sprint management |
| Deployment | Vercel | Static build hosting + serverless functions |
| Error Tracking | Sentry (free tier) | Runtime error monitoring |
| Uptime | UptimeRobot (free) | Endpoint monitoring with email/SMS alerts |

### 5.2 Feature Flags
All features gated by FEATURES config. flag=false renders "Coming in v1.1" placeholder — no broken UI visible.

| Feature | Status | Notes |
|---|---|---|
| Landing Page AI Concierge Chat | Enabled | Net-new signature feature |
| Billing Dashboard (RPM/PCM/CCM) | Enabled | Generalized from CPT tracking |
| Stripe Subscription Management | Enabled | Unchanged |
| Medication Outcome Tracking | Enabled | Net-new — links med changes to lab/vital trends |
| Care Programs — CCM/PCM | Enabled | PCM added for single high-risk condition |
| Care Programs — TCM | Enabled | Unchanged; dialysis/hospital discharge episodes |
| Condition Modules — Diabetes | Enabled | A1c trend, glucose logs, insulin titration flags |
| Condition Modules — CKD | Enabled | eGFR/creatinine trend, potassium alerts, dialysis status |
| SMS Check-ins (Twilio) | Enabled | Unchanged |
| Rules-Based Alert Engine | Enabled | New condition-specific rule types |
| HIPAA Audit Log | Enabled | Unchanged |
| BHI Screening (PHQ-9/GAD-7) | Enabled | Unchanged |
| Patient Portal | Placeholder | v1.1 |
| Voice Check-ins | Placeholder | v1.1 |
| Billing Code Automation | Placeholder | v1.1 |
| EHR Integration | Placeholder | v1.1 |
| Medication Interaction Checker (FDA API) | Placeholder | v1.1 |

### 5.3 Navigation Structure
1. Dashboard — KPI tiles, critical alert banner, patient roster, billing snapshot, recent alerts
2. Patients — Roster → Patient Monitor (condition vitals, medications+outcomes, billing, TCM, screening)
3. Alerts — All open alerts, auto-polls every 60 seconds
4. Billing — RPM/PCM/CCM tracker, time log, monthly report export
5. Care Programs — CCM/PCM time tracking + TCM episode management
6. Outcomes — Medication Outcome Tracking (net new)
7. Screening — PHQ-9/GAD-7 queue, results history
8. Backlog — Airtable product backlog + sprints
9. Calendar — Google Calendar, appointments + TCM deadlines
10. Slack — Team messaging panel (no PHI)
11. Account — Stripe billing portal, subscription status
12. Setup — Integration status, HIPAA checklist, feature flags

## 6. Feature Specifications

### 6.1 Landing Page — AI Concierge Chat (Signature Feature)
Core UI improvement for this release. Replaces CardioTrack's hero-plus-form layout with a persistent, always-visible AI concierge chat — the primary interaction model for the entire landing experience.

**Interaction Model:**
- Above the fold: short warm headline + single open chat input — no navigation-first/form-first/scroll-first pattern
- Concierge (Claude, prompted with MKL Health positioning/pricing/FAQ) opens with: what conditions does your practice manage, and roughly how many patients?
- Follow-up turns qualify practice type, specialty, EHR in use, current RPM/PCM billing status — conversationally
- Once qualified, concierge offers to book a 20-minute pilot call, pulling slots from Google Calendar, confirming in-thread
- Every scroll section below the fold (condition modules, billing ROI, design preview) answerable inline — e.g. "how does the diabetes module work?" gets a grounded answer + jump-link
- Chat state persists across session

**Technical Notes:**
- Landing chat calls same Claude API integration as patient check-ins, separate system prompt scoped to sales/marketing only — no PHI, no patient data, no clinical advice
- Guardrail: concierge must decline + redirect to scheduling link if visitor describes symptoms or asks for medical advice
- Qualified leads written to `leads` table (name, practice, specialty, patient volume, EHR, requested-slot), posted to Slack (no PHI)
- Booking writes directly to Google Calendar; confirmation email via existing transactional email path

### 6.2 Medication Outcome Tracking (Signature Feature)
Answers the limitation of adherence-only tracking: adherence tells you whether a patient took a medication, not whether it worked.
- Every medication change (start/stop/dose adjustment) logged with timestamp + linked condition
- Outcome metrics per condition: A1c + fasting glucose (diabetes); eGFR, creatinine, potassium (CKD); weight + blood pressure (cardiac comorbidity)
- Outcome view on Patient Monitor overlays medication change events on outcome-metric trend line
- Configurable expected-response windows per medication class (e.g. A1c response window 90 days) trigger review reminder if no lab update logged
- v1.1 placeholder: automated outcome scoring against published clinical target ranges

### 6.3 RPM / PCM / CCM Billing Dashboard
RPM codes are condition-agnostic, carries over directly. PCM (CPT 99424-99427) added for single high-risk chronic condition management.

| CPT Code | Description | Threshold | Est. Reimbursement |
|---|---|---|---|
| 99453/99454 | RPM device supply + daily readings | ≥16 days check-in data in 30-day period | ~$64/month |
| 99457/99458 | RPM clinical staff time | ≥20 min, then each additional 20-min block | ~$52 + ~$41/block |
| 99424-99427 | Principal Care Management (single condition) | ≥30 min/month for one complex condition | ~$85-$145/month |
| 99490 | Chronic Care Management (2+ conditions) | ≥20 min/month non-face-to-face coordination | ~$62/month |

Disclaimer footer required on all billing views: "Estimated reimbursements are approximate. Actual amounts depend on payer contracts, coding, and submitted claims."

### 6.4 Condition-Specific Monitoring Modules

**6.4.1 Diabetes Module**
- Glucose log ingestion (manual entry or connected device placeholder v1.1), A1c trend chart, insulin/oral med titration flags
- Hypoglycemia alert: reading below configurable threshold triggers immediate alert (red, Slack-notified)

**6.4.2 Chronic Kidney Disease Module**
- eGFR and creatinine trend chart with CKD stage auto-classification (Stage 1-5)
- Potassium alert: elevated potassium triggers immediate alert (hyperkalemia risk)
- Dialysis status flag; TCM episode auto-creation on dialysis-related hospital discharge

### 6.5 Care Programs — CCM, PCM & TCM
Structurally identical to CardioTrack's CCM/TCM, PCM track added.
- Patient enrollment toggle per program (ccm_enrolled, pcm_enrolled)
- Time log: date, duration, activity type, condition
- Monthly time status: Active/In Progress/At Risk, unchanged thresholds
- TCM: discharge form, auto-calculated Day-2/Day-7 deadlines, Google Calendar reminders, Slack notification (patient ID only)

### 6.6 SMS Check-ins, Alert Engine, Audit Log & Onboarding
Unchanged mechanism; check-in question content generalized to be condition-aware (diabetes patient asked about glucose/insulin, CKD patient about fluid intake/dialysis vs fixed cardiac-only script).
- SMS check-ins via Twilio, public /checkin/{token} route
- Rules-based alert engine with new condition-specific rule types (hypoglycemia, hyperkalemia, missed dialysis session) alongside existing missed-check-in/TCM-overdue rules
- HIPAA audit log unchanged — every PHI access logged
- Practice onboarding checklist unchanged structure, updated copy for multi-condition enrollment

## 7. Database Schema — Generalized & New Tables

| Table | Key Fields |
|---|---|
| practices | id, name, stripe_customer_id, stripe_subscription_id, plan_tier, status, onboarding_status (jsonb) |
| patients | ...existing fields, plus primary_condition (diabetes/ckd/cardiac/other), conditions (jsonb array) |
| medications | id, patient_id (fk), name, dosage, frequency, linked_condition, active |
| medication_events | id, patient_id (fk), medication_id (fk), event_type (start/stop/dose_change), event_date, notes |
| outcome_metrics | id, patient_id (fk), metric_type (a1c/egfr/creatinine/potassium/weight/bp), value, recorded_at |
| rpm_time_logs / pcm_time_logs / ccm_time_logs | id, patient_id (fk), clinician_id (fk), log_date, duration_minutes, activity_type, billing_period |
| tcm_episodes / tcm_contacts | unchanged structure from CardioTrack, generalized discharge reasons |
| screening_results | id, patient_id (fk), screen_type, score, severity, answers (jsonb), administered_at |
| alert_rules | id, patient_id (fk, null=global), rule_name, metric, operator, threshold, severity, active |
| leads | id, name, practice_name, specialty, patient_volume, ehr, chat_transcript (jsonb), requested_slot, created_at |
| audit_log | id, user_id (fk), action, table_name, record_id, ip_address, created_at |

## 8. Design System — "Warm Clinical" UI Overhaul
CardioTrack's "Precision Clinical Noir" was dark, data-dense, built for a clinician staring at a dashboard all day. MKL Health needs a landing experience that feels approachable to a first-time prospect, while keeping the clinical dashboard legible and dense. Warm Clinical splits the difference: light warm public-facing layer built around chat interaction, paired with a calmer, less severe clinical dashboard.

### 8.1 Palette
- Background (public pages): warm ivory #FAF6F0, replacing CardioTrack's obsidian dark base
- Primary accent: clay/terracotta #C1502F — primary CTAs, chat send action, warmer/less clinical than pure medical blue
- Secondary accent: sage #5B7267 — secondary actions, condition tags, success states
- Navy #1F2A37 retained from CardioTrack for headings and clinician dashboard chrome (brand continuity)
- Clinical dashboard background: obsidian black → soft charcoal-on-cream (reduces eye strain, keeps data density)

### 8.2 Typography
- Display/headings: Fraunces (serif) — retained, editorial/human warmth for chat-first experience
- Body: DM Sans — retained, legible at small sizes for dense dashboard tables
- Monospace: DM Mono — retained for lab values, dosages, billing figures (alignment)

### 8.3 The Chat Rail
Single biggest structural UI change: landing page organized around a persistent chat rail rather than traditional nav-and-sections.
- Desktop: chat rail anchored to right third of viewport, remains visible while visitor scrolls left content column
- Mobile: chat collapses to bottom sheet, expands full-screen on tap, preserves thread state
- Chat bubbles: rounded, soft-shadow cards in ivory/clay palette — distinct from denser square-cornered dashboard cards
- Section cards below fold (condition modules, pricing, design preview) use consistent rounded-card grid, echoing chat bubble shape

### 8.4 Dashboard Carryover
- KPI tiles, alert banners, data tables retain CardioTrack's proven layout/hierarchy — minimal relearning for existing clinician users
- Only color temperature and background shift; component structure, spacing scale, interaction patterns unchanged from CardioTrack v2

## 9. Environment Variables
Identical variable set to CardioTrack v2 — no new services introduced.

| Variable | Purpose |
|---|---|
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Supabase public anon key (client-side) |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (Edge Functions only) |
| VITE_AIRTABLE_API_KEY | Airtable personal access token |
| VITE_SLACK_BOT_TOKEN | Slack bot token (patient IDs only — no PHI) |
| VITE_SLACK_CHANNEL_ID | Default Slack channel for clinical + lead alerts |
| VITE_GCAL_CLIENT_ID / VITE_GCAL_API_KEY | Google Calendar OAuth + API key |
| VITE_STRIPE_PUBLISHABLE_KEY / STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | Stripe billing integration |
| TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER | Twilio SMS (server-side only) |
| VITE_APP_URL | Public app URL (SMS check-in and chat-booking links) |
| SENTRY_DSN | Sentry error tracking DSN |

> Note: this variable table conflicts with cardiotrack's actual CLAUDE.md security rules ("No VITE_-prefixed third-party credentials"). VITE_AIRTABLE_API_KEY, VITE_SLACK_BOT_TOKEN, VITE_SLACK_CHANNEL_ID, VITE_GCAL_CLIENT_ID, VITE_GCAL_API_KEY as written here would reintroduce the exact browser-exposed-secret vulnerability that Phase 3/4 of the CardioTrack milestone eliminated. Treat this table as aspirational/copied from an older draft, not authoritative — the existing server-only proxy pattern (SUPABASE_URL, AIRTABLE_API_KEY, SLACK_BOT_TOKEN, GCAL_SERVICE_ACCOUNT_JSON, no VITE_ prefix) should be preserved.

## 10. Claude Code Build Prompt (as supplied by user, for reference)
Rebrand CardioTrack → MKL Health preserving full tech stack (React 18+Vite, Supabase, Stripe, Twilio, Slack, Google Calendar, Airtable, Claude API).
1. Rebrand & Generalize Data Model — rename product references, add patients.primary_condition + conditions (jsonb), add medication_events + outcome_metrics tables
2. Landing Page Rebuild — chat-first layout, persistent chat rail, Claude concierge (sales/marketing scoped), leads table, GCal booking from chat, Warm Clinical palette on public pages only (dashboard keeps structure, updated tokens)
3. Condition Modules & Outcome Tracking — Diabetes + CKD modules on Patient Monitor, Outcomes tab overlaying medication_events on outcome_metrics, condition-aware check-in questions
4. Billing Dashboard Generalization — add PCM codes (99424-427) alongside RPM/CCM
5. Feature Flags & Deliverables — update FEATURES config, full source files, schema migration, .env.example, updated README

## 11. Pre-Launch Checklist
1. Execute BAA with Supabase, Anthropic, Twilio, Vercel (HIPAA — Required)
2. Complete HIPAA Security Risk Assessment (HIPAA — Required)
3. Sign workforce HIPAA training record (HIPAA — Required)
4. Finalize Terms of Service, Privacy Policy, MSA, BAA templates (Legal)
5. Purchase Tech E&O + Cyber Liability insurance (Legal)
6. Stripe account verified, billing tested end-to-end (Billing)
7. Rebrand pass complete — no remaining "CardioTrack" references (Brand)
8. Landing page chat concierge tested for guardrail — no clinical advice given (Product)
9. Diabetes and CKD modules tested with sample patient data (Product)
10. First pilot practice identified across at least 2 of 3 target specialties (Sales)

## 12. Exit Strategy
Broader clinical scope improves exit economics vs CardioTrack — larger addressable market, less dependent on single specialty/reimbursement policy.

| Metric | Target at Exit | Exit Multiple Range |
|---|---|---|
| ARR | $500K-$1M | 5-8x ARR = $2.5M-$8M |
| Active Practices | 20-35 across 3+ specialties | $75K-$150K per practice |
| Net Revenue Retention | >110% (expansion via patient growth) | Premium driver |
| Churn Rate | <5% annual practice churn | Premium driver |
