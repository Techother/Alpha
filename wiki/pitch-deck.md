---
title: Pitch Deck — Market, Business Model & Financials
source: https://cardiotrack-three.vercel.app/pitch.html
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [investor, market, business-model, financials, team]
status: current
---

# Pitch Deck — Market, Business Model & Financials

Compiled from the MKL Health investor pitch deck. Internal reference for market context and business model decisions.

---

## Problem

- 121M Americans with cardiovascular disease
- 25% 30-day readmission rate for heart failure; $26B annual cost; $15K per readmission
- < 12% of eligible Medicare patients enrolled in RPM programs
- $9.2B in annual RPM reimbursements currently left unclaimed by eligible practices
- Existing solutions fail: hardware costs $150–$400/patient; app completion rates 38%; manual billing tracking leaves $2K–$6K/month uncaptured per practice

---

## Market Size

| Market | Value | Basis |
|--------|-------|-------|
| TAM | $17.6B by 2027 (16.3% CAGR) | Global RPM market |
| SAM | $4.2B | ~42,000 independent cardiology/primary care practices × $8,400 avg annual revenue |
| SOM | $420M | 10% SAM over 5 years; 4,200 practices, 210K patients, $33M ARR at scale |

**Tailwinds:** CMS permanently codified RPM billing (2019); COVID-driven telehealth normalization; 2024 CCM expansion + 8% fee increase; LLM-powered check-ins now viable (2025).

---

## Pricing Tiers

| Tier | Price | Patient Limit | Key Additions |
|------|-------|---------------|---------------|
| Starter | $599/mo | 25 patients | Platform, SMS, basic billing, email alerts |
| Growth | $999/mo | 75 patients | + AI triage, Slack/GCal, PHQ-9/GAD-7, TCM workflows |
| Enterprise | Custom | Unlimited | Multi-location, white-label, EHR integration, dedicated onboarding, SLA |

---

## Unit Economics

| Metric | Value |
|--------|-------|
| Average Contract Value (ACV) | $11,988/yr |
| Customer Acquisition Cost (CAC) | $2,200 |
| LTV (3-year avg contract) | $35,964 |
| LTV:CAC Ratio | 16.3× |
| Gross Margin (target) | 78% |
| Payback period | 2.2 months |
| Monthly churn (target) | < 1.5% |
| Average contract length | 3.1 years |

---

## Traction (as of pitch)

- 3 pilot clinics onboarded (Q1 2025)
- 147 patients actively monitored
- 83% average daily check-in completion rate
- $41K in CPT codes captured for pilot practices in 90 days
- 0 30-day readmissions among monitored patients (vs. 4 in 90-day pre-enrollment period, same patients)

**CPT qualification rates (pilot):**
- 99454: 94%
- 99457 (20 min): 87%
- 99458 (+20 min): 61%
- PHQ-9 monthly completion: 79%

**Pipeline:** 7 signed LOIs · 22 practices in active sales conversations · Expected Q3 ARR (signed): $83,916

**Patient growth:** 8 → 23 → 51 → 89 → 147 (Nov–Mar)

---

## Financial Projections

| Year | ARR | Practices | Patients |
|------|-----|-----------|---------|
| Year 1 | $720K | 60 | ~3,000 |
| Year 2 | $3.6M | 300 | ~15,000 |
| Year 3 | $12M | 1,000 | ~50,000 |
| Year 4 | $28M (projected) | — | — |

Break-even: Month 22. Gross margin at Y3: 78%.

**Key assumptions:** 5 practices added/month (Y1), 50 patients/practice avg, $999/mo avg sub, 1.2% monthly churn, 18% expansion revenue.

---

## Go-to-Market

| Phase | Timing | Focus | Goal |
|-------|--------|-------|------|
| 1 | Q2–Q3 2025 | Direct to independent cardiologists (TX, CA, FL) — conferences, LinkedIn, referrals | 15 paying practices |
| 2 | Q4 2025–Q2 2026 | MSO and medical group partnerships (1 deal = 20–100 practices) | 3 MSO contracts |
| 3 | 2026+ | EHR marketplace (Epic App Orchard, Athenahealth), billing company partners | Scale |

**Sales funnel:** Demo → ROI calculator → Pilot → Paid: 100% → 72% → 58% → 91% pilot conversion  
**Moat:** Patient data depth + billing history + care workflows → switching costs compound with every enrolled patient.

---

## Team

| Person | Role | Background |
|--------|------|-----------|
| Larry Ennis Goode | Founder & CEO | 15+ years healthcare/tech/defense; Kaiser Permanente (workforce strategy), Khan Academy, Trulia, UserTesting |
| Dr. Patricia Moore MD FACC | Advisor | Chief of Cardiology, Houston Methodist; 30+ years RPM research |
| Robert Kim | Advisor | Partner, General Catalyst; led Livongo, Accolade, Included Health investments |
| Linda Chao JD | Advisor | Former CMS Deputy Administrator; Medicare reimbursement policy |

---

## Technology (Investor-Facing)

- Zero credentials in browser bundle; all API keys server-side only
- Vercel serverless + Supabase JWT on every API call
- HIPAA-ready via Supabase RLS + BAAs from Supabase and Vercel
- **AI layer: Anthropic Claude Haiku** — serverless via Vercel, JWT-gated triage
- SMS via Twilio with delivery receipts (CMS documentation requirement)
- Defensibility: alert thresholds personalize to each patient's baseline after 6 months of data

---

## Seed Round

| Detail | Value |
|--------|-------|
| Amount | $2.5M |
| Structure | SAFE · $15M post-money cap · 20% discount |
| Pre-seed raised | $400K (friends & family) |
| Grant | $275K (SBIR Phase I, NIH) |

**Use of funds:**
| Allocation | Amount | Purpose |
|-----------|--------|---------|
| Sales & Marketing | 40% ($1.0M) | 2 enterprise AEs, ACC/AHA conferences, content marketing → ~450 new practices |
| Engineering & Product | 30% ($750K) | EHR integrations, mobile app, analytics dashboard, ISO 27001 |
| Customer Success | 18% ($450K) | Onboarding specialists, clinical implementation manager |
| Operations & Runway | 12% ($300K) | Legal (BAAs, contracts), infrastructure, 4-month runway buffer |

**18-month milestones:** 300 practices · 15K patients · $3.6M ARR · break-even · 3 MSO contracts · Series A at $30M+ valuation

---

## See Also

- [[landing-page]] — public ROI model and marketing claims
- [[clinical-reference]] — CPT codes and thresholds
- [[project-overview]] — tech stack
- [[training-guide]] — operational workflows
